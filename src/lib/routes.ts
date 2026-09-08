// Construcción centralizada de rutas. El slug de ciudad va en la URL desde ya
// (aunque solo exista Roma) para que multi-ciudad sea, más adelante, solo datos.
import { CITY_SLUGS, DEFAULT_CITY_SLUG } from '../data/cities.ts'

export const DEFAULT_CITY = DEFAULT_CITY_SLUG

export function isKnownCity(slug: string | undefined): slug is string {
  return slug != null && CITY_SLUGS.includes(slug)
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
