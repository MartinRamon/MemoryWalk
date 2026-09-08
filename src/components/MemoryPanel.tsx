import { formatDistance } from '../lib/geo.ts'
import type { Memory, Place } from '../types/models.ts'

type MemoryPanelProps = {
  memory: Memory
  previewUrl?: string
  nearbyPlaces: Array<{ place: Place; distance: number }>
  onClose: () => void
  onOpenPlace: (id: string) => void
  onDelete: () => void
  onCaption: (caption: string) => void
}

function formatTakenAt(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function MemoryPanel({
  memory,
  previewUrl,
  nearbyPlaces,
  onClose,
  onOpenPlace,
  onDelete,
  onCaption,
}: MemoryPanelProps) {
  const taken = formatTakenAt(memory.takenAt)

  return (
    <aside className="panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Recuerdo</p>
          <h2 className="font-display text-2xl leading-tight text-ink">
            {memory.caption || memory.filename}
          </h2>
          {taken ? <p className="mt-1 text-sm text-ink-soft">{taken}</p> : null}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-sm bg-paper-dark">
        {previewUrl && memory.type === 'photo' ? (
          <img src={previewUrl} alt={memory.caption || memory.filename} className="max-h-64 w-full object-cover" />
        ) : null}
        {previewUrl && memory.type === 'video' ? (
          <video src={previewUrl} controls className="max-h-64 w-full" />
        ) : null}
      </div>

      <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-ink-soft">
        Nota
        <input
          className="mt-1 w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-clay"
          defaultValue={memory.caption ?? ''}
          placeholder="Qué recuerdas de este momento"
          onBlur={(event) => onCaption(event.target.value.trim())}
        />
      </label>

      {!memory.hasGps ? (
        <p className="mt-3 text-sm text-ink-soft">
          Este archivo no traía GPS. La ubicación es la que anclaste en el mapa.
        </p>
      ) : null}

      {nearbyPlaces.length > 0 ? (
        <div className="mt-5">
          <p className="kicker">Sitios del corpus cerca</p>
          <ul className="mt-2 space-y-2">
            {nearbyPlaces.map(({ place, distance }) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="w-full text-left text-sm text-ink hover:text-clay"
                  onClick={() => onOpenPlace(place.id)}
                >
                  {place.name}
                  <span className="ml-2 text-ink-soft">{formatDistance(distance)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink-soft">Ningún restaurante del corpus a menos de 180 m.</p>
      )}

      <button type="button" className="btn-danger mt-6" onClick={onDelete}>
        Eliminar recuerdo
      </button>
    </aside>
  )
}
