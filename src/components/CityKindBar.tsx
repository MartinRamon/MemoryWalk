import { CITY_KIND_META, CITY_KIND_ORDER } from '../lib/city.ts'
import type { CityKind } from '../types/city.ts'
import type { CSSProperties } from 'react'

type CityKindBarProps = {
  counts: Partial<Record<CityKind, number>>
  active: Set<CityKind>
  onToggle: (kind: CityKind) => void
  onShowAll: () => void
}

export function CityKindBar({ counts, active, onToggle, onShowAll }: CityKindBarProps) {
  const allOn = active.size === 0 || active.size === CITY_KIND_ORDER.length

  return (
    <div className="pointer-events-auto flex max-w-[min(100%,52rem)] flex-wrap gap-1.5">
      <button type="button" className={`chip ${allOn ? 'chip-active' : ''}`} aria-pressed={allOn} onClick={onShowAll}>
        Toda la ciudad
      </button>
      {CITY_KIND_ORDER.map((id) => {
        const meta = CITY_KIND_META[id]
        const count = counts[id] ?? 0
        const isOn = allOn || active.has(id)
        return (
          <button
            key={id}
            type="button"
            className={`chip ${isOn && !allOn ? 'chip-active' : ''}`}
            style={{ '--chip': meta.color } as CSSProperties}
            aria-pressed={isOn && !allOn}
            onClick={() => onToggle(id)}
          >
            <span className="chip-dot" />
            {meta.shortLabel}
            {count > 0 ? <span className="chip-count">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
