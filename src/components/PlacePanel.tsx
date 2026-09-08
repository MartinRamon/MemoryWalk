import { CATEGORY_META } from '../lib/categories.ts'
import { MemoryTile } from './MemoryTile.tsx'
import type { Memory, Place } from '../types/models.ts'
import type { CSSProperties } from 'react'

const PRICE_LABEL = {
  budget: 'Asequible',
  moderate: 'Moderado',
  expensive: 'Caro',
  luxury: 'Lujo',
} as const

type PlacePanelProps = {
  place: Place
  nearbyMemories: Memory[]
  memoryUrls: Record<string, string>
  onClose: () => void
  onOpenMemory: (id: string) => void
}

export function PlacePanel({
  place,
  nearbyMemories,
  memoryUrls,
  onClose,
  onOpenMemory,
}: PlacePanelProps) {
  const meta = CATEGORY_META[place.category]

  return (
    <aside className="panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">{meta.label}</p>
          <h2 className="font-display text-2xl leading-tight text-ink">{place.name}</h2>
          {place.neighborhood ? (
            <p className="mt-1 text-sm text-ink-soft">{place.neighborhood}</p>
          ) : null}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="tag" style={{ '--chip': meta.color } as CSSProperties}>
          {meta.shortLabel}
        </span>
        {place.priceLevel ? <span className="tag">{PRICE_LABEL[place.priceLevel]}</span> : null}
        {place.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag.replaceAll('-', ' ')}
          </span>
        ))}
      </div>

      {place.note ? <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">{place.note}</p> : null}

      {place.dishes.length > 0 ? (
        <div className="mt-5">
          <p className="kicker">Platos</p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {place.dishes.map((dish) => (
              <li key={dish}>{dish}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        {place.mapsUrl ? (
          <a className="btn-link inline-flex" href={place.mapsUrl} target="_blank" rel="noreferrer">
            Abrir en Google Maps
          </a>
        ) : null}
        {place.sourceUrl ? (
          <a className="btn-link inline-flex" href={place.sourceUrl} target="_blank" rel="noreferrer">
            Ver el origen
          </a>
        ) : null}
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
