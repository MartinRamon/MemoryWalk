export const LOCAL_USER_ID = 'me'

export const PLACE_CATEGORIES = [
  'trattoria',
  'pizza',
  'vegan',
  'gelato',
  'street_food',
  'seafood',
  'michelin',
  'market',
  'attraction',
] as const

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]

export const PRICE_LEVELS = ['budget', 'moderate', 'expensive', 'luxury'] as const
export type PriceLevel = (typeof PRICE_LEVELS)[number]

export type GeoPoint = {
  lat: number
  lng: number
}

export type City = {
  id: string
  name: string
  country: string
  center: GeoPoint
  zoom: number
}

export type Collection = {
  id: string
  userId: string
  cityId: string
  title: string
  description?: string
}

export type Place = {
  id: string
  userId: string
  collectionId: string
  cityId: string
  name: string
  category: PlaceCategory
  note: string
  mapsUrl?: string
  sourceUrl?: string
  location: GeoPoint
  neighborhood?: string
  tags: string[]
  dishes: string[]
  priceLevel?: PriceLevel
  geocodeSource?: 'maps' | 'nominatim' | 'manual'
  origin?: 'corpus' | 'ingest'
}

export type Memory = {
  id: string
  userId: string
  collectionId: string
  cityId: string
  placeId?: string
  type: 'photo' | 'video'
  lat?: number
  lng?: number
  takenAt?: string
  caption?: string
  filename: string
  mimeType: string
  createdAt: string
  hasGps: boolean
  /** Miniatura JPEG (data URL) para vídeos: primer fotograma capturado al importar. */
  poster?: string
  /** true si la ubicación se heredó de una foto del mismo intervalo, no de GPS ni ancla manual. */
  gpsInherited?: boolean
}

export function isPlacedMemory(memory: Memory): memory is Memory & GeoPoint {
  return memory.lat != null && memory.lng != null
}
