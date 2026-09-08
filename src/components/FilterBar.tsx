import { CATEGORY_META, FILTER_ORDER } from '../lib/categories.ts'
import type { PlaceCategory } from '../types/models.ts'
import type { CSSProperties } from 'react'

type FilterBarProps = {
  counts: Partial<Record<PlaceCategory, number>>
  active: Set<PlaceCategory>
  onToggle: (category: PlaceCategory) => void
  onShowAll: () => void
}

export function FilterBar({ counts, active, onToggle, onShowAll }: FilterBarProps) {
  const allOn = active.size === 0 || active.size === FILTER_ORDER.length

  return (
    <div className="pointer-events-auto flex max-w-[min(100%,52rem)] flex-wrap gap-1.5">
      <button
        type="button"
        className={`chip ${allOn ? 'chip-active' : ''}`}
        aria-pressed={allOn}
        onClick={onShowAll}
      >
        Todas
      </button>
      {FILTER_ORDER.map((id) => {
        const meta = CATEGORY_META[id]
        const count = counts[id] ?? 0
        if (count === 0) return null
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
            <span className="chip-count">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
