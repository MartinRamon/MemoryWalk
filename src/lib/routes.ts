// Construcción centralizada de rutas. El slug de ciudad va en la URL desde ya
// (aunque solo exista Roma) para que multi-ciudad sea, más adelante, solo datos.

export const DEFAULT_CITY = 'roma'
export const KNOWN_CITIES = ['roma'] as const
export type CitySlug = (typeof KNOWN_CITIES)[number]

export function isKnownCity(slug: string | undefined): slug is CitySlug {
  return slug != null && (KNOWN_CITIES as readonly string[]).includes(slug)
}

export function homePath(city: string = DEFAULT_CITY): string {
  return `/${city}`
}

export function mapPath(city: string = DEFAULT_CITY): string {
  return `/${city}/mapa`
}

export function cityLayerPath(city: string = DEFAULT_CITY): string {
  return `/${city}/ciudad`
}

export function placePath(id: string, city: string = DEFAULT_CITY): string {
  return `/${city}/lugar/${id}`
}

export function memoryPath(id: string, city: string = DEFAULT_CITY): string {
  return `/${city}/recuerdo/${id}`
}

export function ingestPath(city: string = DEFAULT_CITY): string {
  return `/${city}/anadir`
}
