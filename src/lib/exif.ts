import exifr from 'exifr'
import type { GeoPoint } from '../types/models.ts'

export type MediaExif = {
  location?: GeoPoint
  takenAt?: string
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return undefined
}

export async function readMediaExif(file: File): Promise<MediaExif> {
  try {
    const parsed = await exifr.parse(file, {
      gps: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'MediaCreateDate', 'ModifyDate'],
    })
    const gps = await exifr.gps(file).catch(() => undefined)
    const lat = gps?.latitude
    const lng = gps?.longitude
    const location =
      typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : undefined

    return {
      location,
      takenAt: toIso(parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? parsed?.MediaCreateDate ?? parsed?.ModifyDate),
    }
  } catch {
    return {}
  }
}

export function memoryTypeFromFile(file: File): 'photo' | 'video' {
  return file.type.startsWith('video/') ? 'video' : 'photo'
}
