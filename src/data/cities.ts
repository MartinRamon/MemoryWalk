import type { City } from '../types/models.ts'
import { ROME } from './catalog.ts'

// Registro de ciudades del cliente, indexado por el slug que va en la URL
// (/roma/...). Hoy solo Roma; añadir otra = una entrada aquí y su corpus.
export const CITIES: Record<string, City> = {
  roma: ROME,
}

export const CITY_SLUGS = Object.keys(CITIES)
export const DEFAULT_CITY_SLUG = 'roma'

export function getCity(slug: string | undefined): City | undefined {
  if (!slug) return CITIES[DEFAULT_CITY_SLUG]
  return CITIES[slug]
}
