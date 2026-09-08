// Registro de ciudades del servidor. Hoy solo Roma, pero geocode/overpass/endpoints
// ya trabajan por ciudad: añadir otra = añadir una entrada aquí (y su corpus).

export type CityBBox = { minLat: number; maxLat: number; minLng: number; maxLng: number }

export type ServerCity = {
  slug: string
  name: string
  country: string
  countryCode: string
  bbox: CityBBox
}

export const ROME_CITY: ServerCity = {
  slug: 'roma',
  name: 'Roma',
  country: 'Italia',
  countryCode: 'it',
  bbox: { minLat: 41.78, maxLat: 42.0, minLng: 12.38, maxLng: 12.62 },
}

export const CITIES: Record<string, ServerCity> = {
  roma: ROME_CITY,
}

export const DEFAULT_CITY_SLUG = 'roma'

/** Ciudad por slug. Sin slug → ciudad por defecto (Roma). Slug desconocido → undefined. */
export function getCity(slug: string | undefined): ServerCity | undefined {
  if (!slug) return CITIES[DEFAULT_CITY_SLUG]
  return CITIES[slug]
}
