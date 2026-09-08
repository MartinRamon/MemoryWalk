import { geocodePlace, getIngestStatus, startIngest } from '../lib/api.ts'
import { geocodeInRome, wait } from '../lib/geocode.ts'
import { parseRecommendations, slugifyPlaceName } from '../lib/parseRecommendations.ts'
import { CATEGORY_META } from '../lib/categories.ts'
import { ROME, ROME_FOOD_COLLECTION } from '../data/catalog.ts'
import { LOCAL_USER_ID, type Place } from '../types/models.ts'
import type { IngestStage, UrlIngestDraft } from '../types/ingest.ts'
import { useMemo, useState } from 'react'

const STAGE_LABEL: Record<IngestStage, string> = {
  reading: 'Leyendo el enlace…',
  transcribing: 'Transcribiendo el audio…',
  extracting: 'Extrayendo el local…',
  locating: 'Buscando en Roma…',
  done: 'Listo',
  error: 'Error',
}

const MAX_POLLS = 180

type IngestViewProps = {
  existingNames: Set<string>
  onBack: () => void
  onImported: (places: Place[]) => Promise<void>
}

function emptyDraft(): UrlIngestDraft {
  return {
    sourceUrl: '',
    sourceKind: 'web',
    caption: '',
    name: '',
    note: '',
    dishes: [],
    category: 'trattoria',
    location: null,
    extractor: 'heuristic',
  }
}

export function IngestView({ existingNames, onBack, onImported }: IngestViewProps) {
  const [url, setUrl] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [textBusy, setTextBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<UrlIngestDraft | null>(null)
  const [stage, setStage] = useState<IngestStage | null>(null)
  const [text, setText] = useState('')
  const [log, setLog] = useState<string[]>([])

  const textDrafts = useMemo(() => parseRecommendations(text), [text])
  const alreadyKnown = draft ? existingNames.has(draft.name.trim().toLowerCase()) : false

  async function readLink() {
    const value = url.trim()
    if (!value) return
    setUrlBusy(true)
    setError(null)
    setDraft(null)
    setStage('reading')
    try {
      const jobId = await startIngest(value)
      for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
        await wait(1000)
        const status = await getIngestStatus(jobId)
        setStage(status.stage)
        if (status.status === 'done' && status.draft) {
          setDraft({ ...emptyDraft(), ...status.draft })
          return
        }
        if (status.status === 'error') {
          setError(status.error ?? 'No se pudo leer el enlace')
          return
        }
      }
      setError('La lectura está tardando demasiado. Inténtalo otra vez.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo leer el enlace')
    } finally {
      setUrlBusy(false)
      setStage(null)
    }
  }

  async function confirmDraft() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      setError('Ponle un nombre al local.')
      return
    }
    setUrlBusy(true)
    setError(null)
    try {
      let location = draft.location
      let geocodeSource = draft.geocodeSource
      // Las coordenadas que vienen de un enlace de Maps son precisas; no las
      // tiramos volviendo a geocodificar. Solo pedimos a Nominatim cuando no
      // tenemos punto o el punto no venía de Maps (nombre corregido por el usuario).
      if (geocodeSource !== 'maps' || !location) {
        try {
          const geo = await geocodePlace(name, draft.neighborhood)
          location = geo.location
          geocodeSource = geo.geocodeSource
        } catch (geoError) {
          // Si ya teníamos un punto del borrador, seguimos con él; si no, avisamos.
          if (!location) throw geoError
        }
      }
      if (!location) {
        setError('No encontramos el punto en Roma. Corrige el nombre e inténtalo otra vez.')
        return
      }
      const place: Place = {
        id: `ingest-${slugifyPlaceName(name)}-${crypto.randomUUID().slice(0, 8)}`,
        userId: LOCAL_USER_ID,
        collectionId: ROME_FOOD_COLLECTION.id,
        cityId: ROME.id,
        name,
        category: draft.category,
        note: draft.note.trim(),
        mapsUrl: draft.mapsUrl,
        sourceUrl: draft.sourceUrl,
        location,
        neighborhood: draft.neighborhood,
        tags: ['ingesta', draft.sourceKind],
        dishes: draft.dishes,
        geocodeSource,
        origin: 'ingest',
      }
      await onImported([place])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo confirmar')
    } finally {
      setUrlBusy(false)
    }
  }

  async function importTextDrafts() {
    if (textDrafts.length === 0) return
    setTextBusy(true)
    setLog([])
    const created: Place[] = []
    try {
      for (const [index, item] of textDrafts.entries()) {
        setLog((current) => [...current, `${item.name}…`])
        if (existingNames.has(item.name.toLowerCase()) && !item.mapsUrl) {
          setLog((current) => {
            const next = [...current]
            next[next.length - 1] = `${item.name}: ya estaba`
            return next
          })
          continue
        }
        const location = await geocodeInRome(item.query)
        if (!location) {
          setLog((current) => {
            const next = [...current]
            next[next.length - 1] = `${item.name}: sin coordenadas`
            return next
          })
          continue
        }
        created.push({
          id: `ingest-${slugifyPlaceName(item.name) || index}-${crypto.randomUUID().slice(0, 8)}`,
          userId: LOCAL_USER_ID,
          collectionId: ROME_FOOD_COLLECTION.id,
          cityId: ROME.id,
          name: item.name,
          category: item.category,
          note: item.note,
          mapsUrl: item.mapsUrl,
          location,
          tags: ['ingesta'],
          dishes: [],
          geocodeSource: 'nominatim',
          origin: 'ingest',
        })
        setLog((current) => {
          const next = [...current]
          next[next.length - 1] = `${item.name}: listo`
          return next
        })
        if (index < textDrafts.length - 1) await wait(400)
      }
      if (created.length > 0) await onImported(created)
    } finally {
      setTextBusy(false)
    }
  }

  return (
    <div className="home-shell max-w-3xl">
      <button type="button" className="btn-ghost text-sm" onClick={onBack}>
        ← Inicio
      </button>
      <p className="kicker mt-8">Ingestor</p>
      <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">Añadir desde un enlace</h1>
      <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-ink-soft">
        Pega un TikTok o un Reel. Viaj lee el pie de foto, propone el local y lo busca en Roma.
        Tú revisas el nombre y la nota, y confirmas para pintarlo.
      </p>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void readLink()
        }}
      >
        <label className="sr-only" htmlFor="ingest-url">
          Enlace
        </label>
        <input
          id="ingest-url"
          className="search-input search-input--full"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.tiktok.com/… o https://www.instagram.com/reel/…"
          inputMode="url"
          autoComplete="off"
        />
        <button type="submit" className="btn-solid btn-solid--lg shrink-0" disabled={urlBusy || !url.trim()}>
          {urlBusy && !draft ? 'Leyendo…' : 'Leer enlace'}
        </button>
      </form>

      {urlBusy && stage ? (
        <p className="mt-4 text-sm text-ink-soft" role="status">
          {STAGE_LABEL[stage]}
          {stage === 'transcribing' ? ' Esto puede tardar unos segundos.' : ''}
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p> : null}

      {draft ? (
        <section className="draft-card mt-8">
          <p className="kicker">Borrador</p>
          <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">
            {draft.sourceKind} · {draft.extractor === 'grok' ? 'Grok' : 'sin clave Grok'}
            {draft.transcribed ? ' · audio transcrito' : ''}
          </p>

          <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-ink-soft">
            Nombre del local
            <input
              className="search-input search-input--full mt-1"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>

          <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-ink-soft">
            Descripción
            <textarea
              className="ingest-area mt-1"
              rows={5}
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="Añade el plato, el barrio, por qué merece la pena…"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-ink-soft">
            <span className="tag">{CATEGORY_META[draft.category].shortLabel}</span>
            {draft.neighborhood ? <span className="tag">{draft.neighborhood}</span> : null}
            {draft.location ? (
              <span className="tag">
                {draft.location.lat.toFixed(4)}, {draft.location.lng.toFixed(4)}
              </span>
            ) : (
              <span className="tag">Sin punto todavía</span>
            )}
          </div>

          {draft.dishes.length > 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Platos: {draft.dishes.join(', ')}</p>
          ) : null}

          {draft.transcript ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              <span className="kicker">Transcripción del audio</span>
              {draft.transcript}
            </p>
          ) : null}

          {draft.caption ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              <span className="kicker">Texto leído</span>
              {draft.caption}
            </p>
          ) : null}

          {draft.warning ? <p className="mt-3 text-sm text-ink-soft">{draft.warning}</p> : null}
          {alreadyKnown ? (
            <p className="mt-3 text-sm text-ink-soft">Ese nombre ya está en tu lista. Puedes confirmarlo igual.</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-solid" disabled={urlBusy || !draft.name.trim()} onClick={() => void confirmDraft()}>
              {urlBusy ? 'Buscando…' : 'Confirmar y pintar'}
            </button>
            <button type="button" className="btn-ghost px-3 py-2 text-sm" disabled={urlBusy} onClick={() => setDraft(null)}>
              Descartar
            </button>
          </div>
        </section>
      ) : null}

      <details className="mt-12">
        <summary className="cursor-pointer text-sm text-ink-soft">O pegar un texto de WhatsApp</summary>
        <textarea
          className="ingest-area mt-4"
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Pizzerías recomendadas\n\nPizza Re in Trastevere: https://maps.app.goo.gl/…`}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-solid"
            disabled={textBusy || textDrafts.length === 0}
            onClick={() => void importTextDrafts()}
          >
            {textBusy ? 'Geocodificando…' : `Importar ${textDrafts.length}`}
          </button>
          <p className="text-sm text-ink-soft">
            {textDrafts.length === 1 ? '1 sitio detectado' : `${textDrafts.length} sitios detectados`}
          </p>
        </div>
        {log.length > 0 ? (
          <ol className="mt-4 space-y-1 text-sm text-ink-soft">
            {log.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ol>
        ) : null}
      </details>
    </div>
  )
}
