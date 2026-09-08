import type { GeoPoint } from './models.ts'

export const CITY_KINDS = ['museum', 'fountain', 'church', 'sculpture'] as const
export type CityKind = (typeof CITY_KINDS)[number]

export type CityBbox = {
  south: number
  west: number
  north: number
  east: number
}

export type CityViewport = CityBbox & {
  zoom: number
}

export type CityPoi = {
  id: string
  name: string
  kind: CityKind
  location: GeoPoint
  wikipedia?: string
  wikidata?: string
}

export type WikiSnippet = {
  title: string
  extract: string
  url: string
  lang: string
  thumbnail?: string
}

export type MapSelection =
  | { type: 'place'; id: string }
  | { type: 'memory'; id: string }
  | { type: 'city'; id: string }
  | null
