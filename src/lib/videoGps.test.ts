import { describe, expect, it } from 'vitest'
import { nearestPhotoLocation, type LocatedPhoto } from './videoGps.ts'

const photos: LocatedPhoto[] = [
  { takenAt: '2025-05-01T12:00:00Z', lat: 41.9, lng: 12.5 },
  { takenAt: '2025-05-01T12:03:00Z', lat: 41.91, lng: 12.51 },
  { takenAt: '2025-05-01T18:00:00Z', lat: 41.8, lng: 12.4 },
]

describe('nearestPhotoLocation', () => {
  it('hereda de la foto más cercana en el tiempo dentro de la ventana', () => {
    // Vídeo a las 12:02 → la foto de 12:03 (1 min) gana a la de 12:00 (2 min).
    expect(nearestPhotoLocation('2025-05-01T12:02:00Z', photos)).toEqual({ lat: 41.91, lng: 12.51 })
  })

  it('devuelve null si ninguna foto cae en la ventana', () => {
    expect(nearestPhotoLocation('2025-05-01T15:00:00Z', photos)).toBeNull()
  })

  it('devuelve null sin fecha de vídeo', () => {
    expect(nearestPhotoLocation(undefined, photos)).toBeNull()
  })

  it('devuelve null con fecha inválida', () => {
    expect(nearestPhotoLocation('no-es-fecha', photos)).toBeNull()
  })

  it('respeta una ventana personalizada', () => {
    // Con ventana de 1 min, la foto de 12:00 (a 2 min del vídeo de 12:02) queda fuera.
    expect(nearestPhotoLocation('2025-05-01T12:02:00Z', [photos[0]], 60_000)).toBeNull()
  })
})
