import { MemoryTile } from './MemoryTile.tsx'
import { fetchWikiSnippet } from '../lib/api.ts'
import { CITY_KIND_META } from '../lib/city.ts'
import type { CityPoi, WikiSnippet } from '../types/city.ts'
import type { Memory } from '../types/models.ts'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

type CityPanelProps = {
  poi: CityPoi
  nearbyMemories: Memory[]
  memoryUrls: Record<string, string>
  onClose: () => void
  onOpenMemory: (id: string) => void
}

export function CityPanel({ poi, nearbyMemories, memoryUrls, onClose, onOpenMemory }: CityPanelProps) {
  const meta = CITY_KIND_META[poi.kind]
  const [snippet, setSnippet] = useState<WikiSnippet | null>(null)
  const [wikiStatus, setWikiStatus] = useState<'loading' | 'ready' | 'none'>('loading')

  useEffect(() => {
    let cancelled = false
    setSnippet(null)
    if (!poi.wikipedia && !poi.wikidata) {
      setWikiStatus('none')
      return
    }
    setWikiStatus('loading')
    void fetchWikiSnippet({ wikipedia: poi.wikipedia, wikidata: poi.wikidata })
      .then((next) => {
        if (cancelled) return
        setSnippet(next)
        setWikiStatus(next ? 'ready' : 'none')
      })
      .catch(() => {
        if (!cancelled) setWikiStatus('none')
      })
    return () => {
      cancelled = true
    }
  }, [poi.id, poi.wikidata, poi.wikipedia])

  const osmUrl = `https://www.openstreetmap.org/${poi.id.replace(/^osm\//, '')}`

  return (
    <aside className="panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">{meta.label}</p>
          <h2 className="font-display text-2xl leading-tight text-ink">{poi.name}</h2>
          <p className="mt-1 text-sm text-ink-soft">OpenStreetMap · Roma</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="tag" style={{ '--chip': meta.color } as CSSProperties}>
          {meta.shortLabel}
        </span>
        {poi.wikipedia || poi.wikidata ? <span className="tag">Wikipedia</span> : null}
      </div>

      {snippet?.thumbnail ? (
        <div className="city-panel__photo mt-4">
          <img src={snippet.thumbnail} alt="" />
        </div>
      ) : null}

      {wikiStatus === 'loading' ? (
        <p className="mt-4 text-sm text-ink-soft">Buscando ficha en Wikipedia…</p>
      ) : null}
      {snippet ? <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">{snippet.extract}</p> : null}
      {wikiStatus === 'none' ? (
        <p className="mt-4 text-sm text-ink-soft">
          Punto de la ciudad desde OpenStreetMap. No hay un extracto de Wikipedia para este sitio.
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        {snippet ? (
          <a className="btn-link inline-flex" href={snippet.url} target="_blank" rel="noreferrer">
            Leer en Wikipedia
          </a>
        ) : null}
        <a className="btn-link inline-flex" href={osmUrl} target="_blank" rel="noreferrer">
          Ver en OpenStreetMap
        </a>
      </div>

      {nearbyMemories.length > 0 ? (
        <div className="mt-6">
          <p className="kicker">Recuerdos cerca</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {nearbyMemories.map((memory) => (
              <MemoryTile
                key={memory.id}
                memory={memory}
                url={memoryUrls[memory.id]}
                compact
                onOpen={() => onOpenMemory(memory.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
