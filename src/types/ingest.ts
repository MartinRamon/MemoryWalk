import { PLACE_CATEGORIES, type GeoPoint, type PlaceCategory } from './models.ts'

export type SourceKind = 'tiktok' | 'instagram' | 'maps' | 'web'

export type UrlIngestDraft = {
  sourceUrl: string
  sourceKind: SourceKind
  caption: string
  name: string
  note: string
  dishes: string[]
  category: PlaceCategory
  neighborhood?: string
  location: GeoPoint | null
  geocodeSource?: 'maps' | 'nominatim'
  mapsUrl?: string
  extractor: 'grok' | 'heuristic'
  warning?: string
}

export function isPlaceCategory(value: string): value is PlaceCategory {
  return (PLACE_CATEGORIES as readonly string[]).includes(value)
}
