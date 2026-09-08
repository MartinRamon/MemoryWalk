import { describe, expect, it } from 'vitest'
import { parseRecommendations, slugifyPlaceName } from './parseRecommendations.ts'

describe('parseRecommendations', () => {
  it('devuelve vacío para texto en blanco', () => {
    expect(parseRecommendations('   ')).toEqual([])
  })

  it('extrae nombre, nota y enlace de Maps, y hereda la categoría de la cabecera', () => {
    const text = [
      'Pizzerías recomendadas',
      '',
      'Da Michele: la mejor napolitana de toda la ciudad sin discusión. https://maps.app.goo.gl/abc123',
      'Sbanco: masa crujiente y de fermentación larga muy recomendable. https://maps.app.goo.gl/def456',
    ].join('\n')

    const drafts = parseRecommendations(text)
    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({
      name: 'Da Michele',
      note: 'la mejor napolitana de toda la ciudad sin discusión.',
      category: 'pizza',
      mapsUrl: 'https://maps.app.goo.gl/abc123',
    })
    expect(drafts[1]).toMatchObject({
      name: 'Sbanco',
      category: 'pizza',
      mapsUrl: 'https://maps.app.goo.gl/def456',
    })
  })

  it('limitación conocida: una línea corta con palabra-categoría se confunde con cabecera', () => {
    // "Pizza Re" es corto y contiene "pizz", así que looksLikeHeader lo trata
    // como sección y lo descarta. Documentado para la hoja de ruta (parser v2).
    const drafts = parseRecommendations('Pizza Re: la mejor. https://maps.app.goo.gl/abc123')
    expect(drafts).toHaveLength(0)
  })

  it('usa la categoría de reserva cuando no hay cabecera reconocible', () => {
    const drafts = parseRecommendations('Da Enzo: cacio e pepe. https://maps.app.goo.gl/xyz', 'trattoria')
    expect(drafts).toHaveLength(1)
    expect(drafts[0].category).toBe('trattoria')
    expect(drafts[0].query).toBe('Da Enzo Roma')
  })

  it('deduplica por nombre y enlace', () => {
    const text = [
      'Da Enzo: uno. https://maps.app.goo.gl/dup',
      'Da Enzo: dos. https://maps.app.goo.gl/dup',
    ].join('\n')
    expect(parseRecommendations(text)).toHaveLength(1)
  })
})

describe('slugifyPlaceName', () => {
  it('pasa a minúsculas y une con guiones', () => {
    expect(slugifyPlaceName('Felice a Testaccio')).toBe('felice-a-testaccio')
  })

  it('quita acentos y caracteres no alfanuméricos', () => {
    expect(slugifyPlaceName('Trastévere Café!')).toBe('trastevere-cafe')
  })

  it('recorta a 40 caracteres', () => {
    expect(slugifyPlaceName('a'.repeat(60)).length).toBe(40)
  })
})
