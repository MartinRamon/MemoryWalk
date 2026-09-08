import { describe, expect, it } from 'vitest'
import { formatDistance, haversineMeters, nearbyPlaces, nearestPlace } from './geo.ts'
import type { GeoPoint, Place } from '../types/models.ts'

function place(id: string, location: GeoPoint): Place {
  return {
    id,
    userId: 'me',
    collectionId: 'rome-food',
    cityId: 'rome',
    name: id,
    category: 'trattoria',
    note: '',
    location,
    tags: [],
    dishes: [],
  }
}

describe('haversineMeters', () => {
  it('es cero para el mismo punto', () => {
    expect(haversineMeters({ lat: 41.9, lng: 12.5 }, { lat: 41.9, lng: 12.5 })).toBe(0)
  })

  it('un grado de latitud es ~111,2 km', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })

  it('es simétrica', () => {
    const a = { lat: 41.8902, lng: 12.4922 }
    const b = { lat: 41.8986, lng: 12.4769 }
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6)
  })
})

describe('nearbyPlaces', () => {
  const origin = { lat: 41.9, lng: 12.5 }
  const near = place('near', { lat: 41.9005, lng: 12.5 }) // ~55 m
  const mid = place('mid', { lat: 41.9012, lng: 12.5 }) // ~133 m
  const far = place('far', { lat: 41.95, lng: 12.5 }) // ~5,5 km

  it('filtra por radio y ordena por distancia ascendente', () => {
    const result = nearbyPlaces(origin, [far, mid, near], 180)
    expect(result.map((p) => p.id)).toEqual(['near', 'mid'])
  })

  it('devuelve vacío cuando nada entra en el radio', () => {
    expect(nearbyPlaces(origin, [far], 180)).toEqual([])
  })
})

describe('nearestPlace', () => {
  const origin = { lat: 41.9, lng: 12.5 }

  it('devuelve el más cercano dentro del radio', () => {
    const near = place('near', { lat: 41.9005, lng: 12.5 })
    const far = place('far', { lat: 41.9015, lng: 12.5 })
    expect(nearestPlace(origin, [far, near])?.id).toBe('near')
  })

  it('devuelve undefined si no hay ninguno cerca', () => {
    expect(nearestPlace(origin, [place('far', { lat: 42.0, lng: 12.6 })], 180)).toBeUndefined()
  })
})

describe('formatDistance', () => {
  it('usa metros por debajo de 1 km', () => {
    expect(formatDistance(180)).toBe('180 m')
  })
  it('usa kilómetros con un decimal a partir de 1 km', () => {
    expect(formatDistance(1500)).toBe('1.5 km')
  })
})
