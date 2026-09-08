import { CATEGORY_META } from '../lib/categories.ts'
import type { Place } from '../types/models.ts'
import type { CSSProperties } from 'react'

const PRICE_LABEL = {
  budget: 'Asequible',
  moderate: 'Moderado',
  expensive: 'Caro',
  luxury: 'Lujo',
} as const

type PlaceCardProps = {
  place: Place
  onOpenMap: (id: string) => void
}

export function PlaceCard({ place, onOpenMap }: PlaceCardProps) {
  const meta = CATEGORY_META[place.category]

  return (
    <article className="place-card">
      <span className="place-card__bar" style={{ background: meta.color } as CSSProperties} />
      <div className="min-w-0 flex-1">
        <p className="kicker">{meta.label}</p>
        <h3 className="font-display text-[1.35rem] leading-tight text-ink">{place.name}</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {[place.neighborhood, place.priceLevel ? PRICE_LABEL[place.priceLevel] : null]
            .filter(Boolean)
            .join(' · ') || 'Roma'}
        </p>
        {place.note ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-soft">{place.note}</p>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">Sin nota todavía.</p>
        )}
        <button type="button" className="btn-link mt-4" onClick={() => onOpenMap(place.id)}>
          Ver en el mapa
        </button>
      </div>
    </article>
  )
}
