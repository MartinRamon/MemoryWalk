import { describe, expect, it } from 'vitest'
import { classify, clipCityBbox } from './overpass.ts'

describe('classify', () => {
  it('reconoce un museo', () => {
    expect(classify({ tourism: 'museum' })).toBe('museum')
  })
  it('reconoce una fuente', () => {
    expect(classify({ amenity: 'fountain' })).toBe('fountain')
  })
  it('reconoce un lugar de culto como iglesia', () => {
    expect(classify({ amenity: 'place_of_worship', religion: 'christian' })).toBe('church')
  })
  it('reconoce una estatua histórica como escultura', () => {
    expect(classify({ historic: 'statue' })).toBe('sculpture')
  })
  it('reconoce artwork escultórico', () => {
    expect(classify({ tourism: 'artwork', artwork_type: 'sculpture' })).toBe('sculpture')
  })
  it('ignora lo que no encaja', () => {
    expect(classify({ shop: 'bakery' })).toBeNull()
  })
})

describe('clipCityBbox', () => {
  it('recorta un recuadro válido dentro de Roma', () => {
    const clipped = clipCityBbox({ south: 41.88, west: 12.47, north: 41.9, east: 12.49 })
    expect(clipped).toEqual({ south: 41.88, west: 12.47, north: 41.9, east: 12.49 })
  })

  it('recorta al bbox de Roma cuando el recuadro se sale', () => {
    const clipped = clipCityBbox({ south: 41.0, west: 12.47, north: 41.82, east: 12.49 })
    expect(clipped?.south).toBeCloseTo(41.78, 5)
  })

  it('devuelve null si el recuadro está invertido', () => {
    expect(clipCityBbox({ south: 41.9, west: 12.49, north: 41.88, east: 12.47 })).toBeNull()
  })

  it('devuelve null si el span es demasiado grande', () => {
    expect(clipCityBbox({ south: 41.78, west: 12.38, north: 42.0, east: 12.62 })).toBeNull()
  })
})
