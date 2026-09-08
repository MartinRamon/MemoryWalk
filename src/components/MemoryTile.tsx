import type { Memory } from '../types/models.ts'

type MemoryTileProps = {
  memory: Memory
  url?: string
  featured?: boolean
  compact?: boolean
  onOpen: () => void
  onDelete?: () => void
}

export function MemoryTile({ memory, url, featured, compact, onOpen, onDelete }: MemoryTileProps) {
  const label = memory.caption || memory.filename

  return (
    <div className={`memory-tile ${featured ? 'is-featured' : ''} ${compact ? 'is-compact' : ''}`}>
      <button type="button" className="memory-tile__open" onClick={onOpen} aria-label={label}>
        {url && memory.type === 'photo' ? (
          <img src={url} alt="" />
        ) : (
          <span className="memory-tile__fallback">{memory.type === 'video' ? 'Vídeo' : 'Archivo'}</span>
        )}
      </button>
      {onDelete ? (
        <button
          type="button"
          className="memory-tile__delete"
          aria-label={`Eliminar ${label}`}
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
