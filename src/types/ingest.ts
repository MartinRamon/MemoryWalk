import { PLACE_CATEGORIES, type GeoPoint, type PlaceCategory } from './models.ts'

export type SourceKind = 'tiktok' | 'instagram' | 'maps' | 'web'

export type UrlIngestDraft = {
  sourceUrl: string
  sourceKind: SourceKind
  caption: string
  transcript?: string
  name: string
  note: string
  dishes: string[]
  category: PlaceCategory
  neighborhood?: string
  location: GeoPoint | null
  geocodeSource?: 'maps' | 'nominatim'
  mapsUrl?: string
  extractor: 'grok' | 'heuristic'
  transcribed?: boolean
  transcriptFailed?: boolean
  warning?: string
}

export const INGEST_STAGES = ['reading', 'transcribing', 'extracting', 'locating', 'done', 'error'] as const
export type IngestStage = (typeof INGEST_STAGES)[number]

export type IngestJobStatus = {
  id: string
  stage: IngestStage
  status: 'running' | 'done' | 'error'
  draft?: UrlIngestDraft
  error?: string
}

export function isPlaceCategory(value: string): value is PlaceCategory {
  return (PLACE_CATEGORIES as readonly string[]).includes(value)
}
