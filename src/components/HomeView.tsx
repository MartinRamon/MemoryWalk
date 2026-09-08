import { ConfirmDelete } from './ConfirmDelete.tsx'
import { Importer } from './Importer.tsx'
import { MemoryTile } from './MemoryTile.tsx'
import { PlaceCard } from './PlaceCard.tsx'
import { CATEGORY_META, FILTER_ORDER } from '../lib/categories.ts'
import type { Memory, Place, PlaceCategory } from '../types/models.ts'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'

type HomeViewProps = {
  places: Place[]
  memories: Memory[]
  memoryUrls: Record<string, string>
  importBusy: boolean
  onOpenMap: (placeId?: string, options?: { city?: boolean }) => void
  onOpenIngest: () => void
  onOpenMemory: (id: string) => void
  onImportFiles: (files: FileList) => void
  onDeleteMemory: (id: string) => Promise<void>
}

export function HomeView({
  places,
  memories,
  memoryUrls,
  importBusy,
  onOpenMap,
  onOpenIngest,
  onOpenMemory,
  onImportFiles,
  onDeleteMemory,
}: HomeViewProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<PlaceCategory | 'all'>('all')
  const [deleteTarget, setDeleteTarget] = useState<Memory | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return places.filter((place) => {
      if (category !== 'all' && place.category !== category) return false
      if (!needle) return true
      return (
        place.name.toLowerCase().includes(needle) ||
        place.note.toLowerCase().includes(needle) ||
        (place.neighborhood ?? '').toLowerCase().includes(needle)
      )
    })
  }, [category, places, query])

  const grouped = useMemo(() => {
    return FILTER_ORDER.map((id) => ({
      id,
      items: filtered.filter((place) => place.category === id),
    })).filter((group) => group.items.length > 0)
  }, [filtered])

  return (
    <div className="home-shell">
      <header className="home-hero">
        <div className="home-hero__copy">
          <p className="kicker">Roma · guía personal</p>
          <h1 className="font-display text-[2.6rem] leading-[0.95] tracking-tight text-ink md:text-6xl">
            Viaj
          </h1>
          <p className="mt-4 max-w-lg text-[1.05rem] leading-relaxed text-ink-soft">
            Recomendaciones de comida, recuerdos anclados donde los viviste, y la ciudad:
            museos, fuentes, iglesias y esculturas.
          </p>
        </div>
        <div className="home-hero__actions">
          <button type="button" className="btn-solid btn-solid--lg" onClick={() => onOpenMap()}>
            Abrir mapa
          </button>
          <button type="button" className="chip" onClick={() => onOpenMap(undefined, { city: true })}>
            Ver la ciudad
          </button>
          <button type="button" className="chip" onClick={onOpenIngest}>
            Añadir desde un enlace
          </button>
          <Importer busy={importBusy} onFiles={onImportFiles} tone="chip" />
        </div>
      </header>

      <section className="home-section">
        <div className="section-head">
          <div>
            <p className="kicker">Recuerdos</p>
            <h2 className="font-display text-3xl text-ink">Fotos del viaje</h2>
          </div>
          {memories.length > 0 ? (
            <p className="section-meta">
              {memories.length === 1 ? '1 archivo' : `${memories.length} archivos`}
            </p>
          ) : null}
        </div>

        {memories.length > 0 ? (
          <div className="memory-grid">
            {memories.map((memory, index) => (
              <MemoryTile
                key={memory.id}
                memory={memory}
                url={memoryUrls[memory.id]}
                featured={index === 0 && memories.length > 2}
                onOpen={() => onOpenMemory(memory.id)}
                onDelete={() => setDeleteTarget(memory)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-block">
            <p className="max-w-lg text-sm leading-relaxed text-ink-soft">
              Añade fotos o vídeos. Si tienen GPS, caen solos en el mapa. Si WhatsApp se lo ha
              comido, los anclas tú con un clic. Puedes eliminarlos cuando quieras.
            </p>
            <Importer busy={importBusy} onFiles={onImportFiles} />
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <p className="kicker">Corpus</p>
            <h2 className="font-display text-3xl text-ink">
              {places.length} lugares en Roma
            </h2>
          </div>
          <label className="sr-only" htmlFor="home-search">
            Buscar lugares
          </label>
          <input
            id="home-search"
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar un sitio, un barrio, un plato…"
          />
        </div>

        <div className="filter-row">
          <button
            type="button"
            className={`chip ${category === 'all' ? 'chip-active' : ''}`}
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            Todas
          </button>
          {FILTER_ORDER.map((id) => {
            const count = places.filter((place) => place.category === id).length
            if (count === 0) return null
            return (
              <button
                key={id}
                type="button"
                className={`chip ${category === id ? 'chip-active' : ''}`}
                style={{ '--chip': CATEGORY_META[id].color } as CSSProperties}
                aria-pressed={category === id}
                onClick={() => setCategory(id)}
              >
                <span className="chip-dot" />
                {CATEGORY_META[id].shortLabel}
                <span className="chip-count">{count}</span>
              </button>
            )
          })}
        </div>

        {grouped.map((group) => (
          <div key={group.id} className="category-block">
            <h3 className="category-block__title">{CATEGORY_META[group.id].label}</h3>
            <div className="place-grid">
              {group.items.map((place) => (
                <PlaceCard key={place.id} place={place} onOpenMap={onOpenMap} />
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 ? (
          <p className="mt-8 text-sm text-ink-soft">Ningún lugar coincide con esa búsqueda.</p>
        ) : null}
      </section>

      <ConfirmDelete
        open={deleteTarget != null}
        title="¿Eliminar este recuerdo?"
        description="Se borra de este navegador: el archivo y su ancla en el mapa. No se puede deshacer."
        previewUrl={deleteTarget ? memoryUrls[deleteTarget.id] : undefined}
        previewAlt={deleteTarget?.caption || deleteTarget?.filename}
        isVideo={deleteTarget?.type === 'video'}
        confirmLabel="Eliminar recuerdo"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          const id = deleteTarget.id
          setDeleteTarget(null)
          void onDeleteMemory(id)
        }}
      />
    </div>
  )
}
