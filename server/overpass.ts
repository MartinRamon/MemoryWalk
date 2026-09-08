import { ROME_BBOX } from './geo.ts'
import { fetchWithTimeout } from './http.ts'
import type { CityBbox, CityKind, CityPoi } from '../src/types/city.ts'

const USER_AGENT = 'Viaj/0.1 (personal travel map; overpass@viaj.local)'
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const MAX_SPAN = 0.1
const MAX_ITEMS = 180
const CACHE_MS = 12 * 60_000

type CacheEntry = { at: number; pois: CityPoi[] }

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CityPoi[]>>()

export function clipCityBbox(raw: CityBbox): CityBbox | null {
  const south = Math.max(raw.south, ROME_BBOX.minLat)
  const west = Math.max(raw.west, ROME_BBOX.minLng)
  const north = Math.min(raw.north, ROME_BBOX.maxLat)
  const east = Math.min(raw.east, ROME_BBOX.maxLng)
  if (north <= south || east <= west) return null
  if (north - south > MAX_SPAN || east - west > MAX_SPAN) return null
  return { south, west, north, east }
}

function quantize(value: number): number {
  return Math.round(value / 0.004) * 0.004
}

function cacheKey(bbox: CityBbox, significant: boolean): string {
  return [quantize(bbox.south), quantize(bbox.west), quantize(bbox.north), quantize(bbox.east), significant ? 1 : 0].join('|')
}

function parseWikipedia(value?: string): string | undefined {
  const raw = value?.trim()
  return raw || undefined
}

function parseWikidata(value?: string): string | undefined {
  const raw = value?.trim()
  if (!raw) return undefined
  return /^Q\d+$/i.test(raw) ? raw.toUpperCase() : undefined
}

function poiName(tags: Record<string, string>): string {
  return (
    tags.name?.trim() ||
    tags['name:it']?.trim() ||
    tags['name:en']?.trim() ||
    tags['name:es']?.trim() ||
    ''
  )
}

function wikiTitle(wikipedia?: string): string {
  if (!wikipedia) return ''
  const [, title] = wikipedia.includes(':') ? wikipedia.split(/:(.*)/s) : [undefined, wikipedia]
  return (title ?? wikipedia).replaceAll('_', ' ').trim()
}

function classify(tags: Record<string, string>): CityKind | null {
  if (tags.tourism === 'museum') return 'museum'
  if (tags.amenity === 'fountain' || tags.historic === 'fountain' || tags.natural === 'spring') {
    return 'fountain'
  }
  const artwork = tags.artwork_type ?? ''
  if (
    tags.historic === 'statue' ||
    tags.historic === 'memorial' ||
    tags.historic === 'monument' ||
    (tags.tourism === 'artwork' && /sculpture|statue|bust/i.test(artwork))
  ) {
    return 'sculpture'
  }
  if (
    tags.amenity === 'place_of_worship' ||
    tags.building === 'church' ||
    tags.building === 'cathedral' ||
    tags.building === 'basilica' ||
    tags.historic === 'church'
  ) {
    return 'church'
  }
  return null
}

function overpassQuery(bbox: CityBbox, significant: boolean): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  const wiki = significant ? '["wikipedia"]' : ''
  return `
[out:json][timeout:25];
(
  nwr["tourism"="museum"](${box});
  nwr["amenity"="fountain"]${wiki}(${box});
  nwr["historic"="fountain"]${wiki}(${box});
  nwr["amenity"="place_of_worship"]["religion"="christian"]${wiki}(${box});
  nwr["building"="cathedral"]${wiki}(${box});
  nwr["building"="basilica"]${wiki}(${box});
  nwr["historic"="church"]${wiki}(${box});
  nwr["tourism"="artwork"]["artwork_type"~"sculpture|statue|bust"]${wiki}(${box});
  nwr["historic"="memorial"]${wiki}(${box});
  nwr["historic"="monument"]${wiki}(${box});
  nwr["historic"="statue"]${wiki}(${box});
);
out center tags;
`.trim()
}

type OverpassElement = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function toPoi(element: OverpassElement): CityPoi | null {
  const tags = element.tags ?? {}
  const kind = classify(tags)
  if (!kind) return null
  const lat = element.lat ?? element.center?.lat
  const lng = element.lon ?? element.center?.lon
  if (lat == null || lng == null) return null
  const wikipedia = parseWikipedia(tags.wikipedia ?? tags['wikipedia:it'] ?? tags['wikipedia:en'])
  const wikidata = parseWikidata(tags.wikidata)
  const name = poiName(tags) || wikiTitle(wikipedia)
  if (!name) return null
  return {
    id: `osm/${element.type}/${element.id}`,
    name,
    kind,
    location: { lat, lng },
    wikipedia,
    wikidata,
  }
}

async function queryEndpoint(endpoint: string, query: string): Promise<CityPoi[]> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: new URLSearchParams({ data: query }),
      },
      28_000,
    )
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Overpass tardó demasiado. Acerca el mapa e inténtalo otra vez.')
    }
    throw error
  }
  if (!response.ok) throw new Error(`Overpass ${response.status}`)
  const payload = (await response.json()) as { elements?: OverpassElement[] }
  const seen = new Set<string>()
  const pois: CityPoi[] = []
  for (const element of payload.elements ?? []) {
    const poi = toPoi(element)
    if (!poi || seen.has(poi.id)) continue
    seen.add(poi.id)
    pois.push(poi)
  }
  return pois
}

async function queryOverpass(bbox: CityBbox, significant: boolean): Promise<CityPoi[]> {
  const query = overpassQuery(bbox, significant)
  let lastError: unknown
  for (const endpoint of ENDPOINTS) {
    try {
      return await queryEndpoint(endpoint, query)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass no respondió')
}

function rank(poi: CityPoi): number {
  let score = 0
  if (poi.wikipedia) score += 4
  if (poi.wikidata) score += 2
  if (poi.kind === 'museum') score += 1
  return score
}

export async function loadCityPois(bbox: CityBbox, significant: boolean): Promise<CityPoi[]> {
  const clipped = clipCityBbox(bbox)
  if (!clipped) return []

  const key = cacheKey(clipped, significant)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.pois

  const pending = inflight.get(key)
  if (pending) return pending

  const run = (async () => {
    const raw = await queryOverpass(clipped, significant)
    const filtered = significant
      ? raw.filter((poi) => poi.wikipedia || poi.wikidata || poi.kind === 'museum')
      : raw
    const pois = filtered.sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, 'es')).slice(0, MAX_ITEMS)
    cache.set(key, { at: Date.now(), pois })
    return pois
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, run)
  return run
}
