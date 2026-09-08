import { describe, expect, it } from 'vitest'
import {
  cityLayerPath,
  DEFAULT_CITY,
  homePath,
  ingestPath,
  isKnownCity,
  mapPath,
  memoryPath,
  placePath,
} from './routes.ts'

describe('rutas', () => {
  it('usa Roma por defecto', () => {
    expect(homePath()).toBe('/roma')
    expect(mapPath()).toBe('/roma/mapa')
    expect(cityLayerPath()).toBe('/roma/ciudad')
    expect(ingestPath()).toBe('/roma/anadir')
    expect(DEFAULT_CITY).toBe('roma')
  })

  it('construye rutas de lugar y recuerdo con su id', () => {
    expect(placePath('felice-a-testaccio')).toBe('/roma/lugar/felice-a-testaccio')
    expect(memoryPath('abc-123')).toBe('/roma/recuerdo/abc-123')
  })

  it('respeta un slug de ciudad explícito', () => {
    expect(placePath('duomo', 'florencia')).toBe('/florencia/lugar/duomo')
  })

  it('reconoce las ciudades conocidas', () => {
    expect(isKnownCity('roma')).toBe(true)
    expect(isKnownCity('florencia')).toBe(false)
    expect(isKnownCity(undefined)).toBe(false)
  })
})
