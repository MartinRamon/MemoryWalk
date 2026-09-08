import { MemoryTile } from './MemoryTile.tsx'
import type { Memory } from '../types/models.ts'

type PinTrayProps = {
  pending: Memory[]
  urls: Record<string, string>
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (memory: Memory) => void
}

export function PinTray({ pending, urls, activeId, onSelect, onDelete }: PinTrayProps) {
  if (pending.length === 0) return null

  return (
    <div className="pin-tray">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">
        {pending.length === 1
          ? '1 recuerdo sin GPS — elige y pulsa el mapa'
          : `${pending.length} recuerdos sin GPS — elige uno y pulsa el mapa`}
      </p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
        {pending.map((memory) => {
          const active = memory.id === activeId
          return (
            <div key={memory.id} className={`pin-tray__item ${active ? 'is-active' : ''}`}>
              <MemoryTile
                memory={memory}
                url={urls[memory.id]}
                compact
                onOpen={() => onSelect(memory.id)}
                onDelete={() => onDelete(memory)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
