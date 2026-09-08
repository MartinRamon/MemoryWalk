import { describe, expect, it } from 'vitest'
import { extractCoords, inRome } from './geo.ts'

describe('inRome', () => {
  it('acepta un punto dentro del bbox de Roma', () => {
    expect(inRome(41.9, 12.49)).toBe(true)
  })
  it('rechaza un punto fuera (París)', () => {
    expect(inRome(48.8566, 2.3522)).toBe(false)
  })
})

describe('extractCoords', () => {
  it('lee el patrón @lat,lng de una URL de Google Maps', () => {
    expect(extractCoords('https://www.google.com/maps/@41.8902,12.4922,17z')).toEqual({
      lat: 41.8902,
      lng: 12.4922,
    })
  })

  it('lee el patrón !3d!4d', () => {
    expect(extractCoords('https://maps/place/x/data=!3d41.9!4d12.5')).toEqual({ lat: 41.9, lng: 12.5 })
  })

  it('lee el parámetro q=lat,lng', () => {
    expect(extractCoords('https://maps.google.com/?q=41.895,12.482')).toEqual({ lat: 41.895, lng: 12.482 })
  })

  it('devuelve null para coordenadas fuera de Roma', () => {
    expect(extractCoords('https://www.google.com/maps/@48.8566,2.3522,17z')).toBeNull()
  })

  it('devuelve null cuando no hay coordenadas', () => {
    expect(extractCoords('https://example.com/sin-coordenadas')).toBeNull()
  })
})
