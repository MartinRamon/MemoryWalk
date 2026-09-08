import type { GeoPoint } from '../types/models.ts'

export type LocatedPhoto = { takenAt: string; lat: number; lng: number }

/**
 * Hereda ubicación para un vídeo sin GPS a partir de la foto más cercana en el
 * tiempo (dentro de una ventana). Los vídeos de mensajería suelen perder el GPS,
 * pero se graban junto a fotos que sí lo tienen. Función pura para poder testearla.
 */
export function nearestPhotoLocation(
  videoTakenAt: string | undefined,
  photos: LocatedPhoto[],
  windowMs = 10 * 60_000,
): GeoPoint | null {
  if (!videoTakenAt) return null
  const target = Date.parse(videoTakenAt)
  if (Number.isNaN(target)) return null

  let best: { dist: number; loc: GeoPoint } | null = null
  for (const photo of photos) {
    const t = Date.parse(photo.takenAt)
    if (Number.isNaN(t)) continue
    const dist = Math.abs(t - target)
    if (dist > windowMs) continue
    if (!best || dist < best.dist) best = { dist, loc: { lat: photo.lat, lng: photo.lng } }
  }
  return best?.loc ?? null
}
