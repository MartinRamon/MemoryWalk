import { describe, expect, it } from 'vitest'
import { combineSourceText } from './ingest.ts'

describe('combineSourceText', () => {
  it('junta pie de foto y transcripción etiquetando el audio', () => {
    const result = combineSourceText('Habla de una trattoria en Testaccio', 'Pie de foto original')
    expect(result).toBe('Pie de foto original\n\n[Transcripción del audio]\nHabla de una trattoria en Testaccio')
  })

  it('devuelve solo la transcripción si no hay pie de foto', () => {
    expect(combineSourceText('Solo transcripción', '')).toBe('Solo transcripción')
  })

  it('devuelve solo el pie de foto si no hay transcripción', () => {
    expect(combineSourceText(null, 'Solo caption')).toBe('Solo caption')
    expect(combineSourceText(undefined, 'Solo caption')).toBe('Solo caption')
  })

  it('devuelve vacío si no hay nada', () => {
    expect(combineSourceText('', '')).toBe('')
    expect(combineSourceText(null, null)).toBe('')
  })

  it('recorta espacios sobrantes', () => {
    expect(combineSourceText('  hola  ', '   ')).toBe('hola')
  })
})
