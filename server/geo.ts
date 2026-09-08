import type { GeoPoint } from '../src/types/models.ts'
import { ROME_CITY, type CityBBox, type ServerCity } from './cities.ts'
import { fetchWithTimeout } from './http.ts'

export const ROME_BBOX = ROME_CITY.bbox

const USER_AGENT = 'MemoryWalk/0.1 (personal travel map; nominatim@memorywalk.local)'

export function inBbox(lat: number, lng: number, bbox: CityBBox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng
}

export function inRome(lat: number, lng: number): boolean {
  return inBbox(lat, lng, ROME_BBOX)
}

export function extractCoords(text: string, bbox: CityBBox = ROME_BBOX): GeoPoint | null {
  let decoded = text
  try {
    decoded = decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    decoded = text
  }

  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\/search\/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/,
    /"latitude"\s*:\s*(-?\d+\.\d+)[\s\S]{0,80}"longitude"\s*:\s*(-?\d+\.\d+)/,
  ]

  for (const source of [text, decoded]) {
    for (const re of patterns) {
      const match = source.match(re)
      if (!match) continue
      const lat = Number(match[1])
      const lng = Number(match[2])
      if (Number.isFinite(lat) && Number.isFinite(lng) && inBbox(lat, lng, bbox)) {
        return { lat, lng }
      }
    }
  }
  return null
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const GEOCODE_OK_MS = 24 * 60 * 60_000
const GEOCODE_MISS_MS = 10 * 60_000
const geocodeCache = new Map<string, { at: number; location: GeoPoint | null }>()

let nominatimTail = Promise.resolve()

async function nominatimOnce(query: string, city: ServerCity): Promise<GeoPoint | null> {
  const endpoint = new URL('https://nominatim.openstreetmap.org/search')
  endpoint.searchParams.set('format', 'jsonv2')
  endpoint.searchParams.set('limit', '1')
  endpoint.searchParams.set('countrycodes', city.countryCode)
  endpoint.searchParams.set('q', query.includes(city.name) ? query : `${query}, ${city.name}, ${city.country}`)
  endpoint.searchParams.set(
    'viewbox',
    `${city.bbox.minLng},${city.bbox.maxLat},${city.bbox.maxLng},${city.bbox.minLat}`,
  )
  endpoint.searchParams.set('bounded', '1')

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!response.ok) return null
  const results = (await response.json()) as Array<{ lat: string; lon: string }>
  const first = results[0]
  if (!first) return null
  const lat = Number(first.lat)
  const lng = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBbox(lat, lng, city.bbox)) return null
  return { lat, lng }
}

export async function geocodeInCity(query: string, city: ServerCity, neighborhood?: string): Promise<GeoPoint | null> {
  const needle = [query.trim(), neighborhood?.trim()].filter(Boolean).join(' ')
  if (!needle) return null

  const key = `${city.slug}|${needle.toLowerCase()}`
  const hit = geocodeCache.get(key)
  if (hit) {
    const ttl = hit.location ? GEOCODE_OK_MS : GEOCODE_MISS_MS
    if (Date.now() - hit.at < ttl) return hit.location
  }

  const run = nominatimTail.then(() => nominatimOnce(needle, city))
  nominatimTail = run.then(
    () => wait(1100),
    () => wait(1100),
  )
  const location = await run
  geocodeCache.set(key, { at: Date.now(), location })
  return location
}

export function geocodeInRome(query: string, neighborhood?: string): Promise<GeoPoint | null> {
  return geocodeInCity(query, ROME_CITY, neighborhood)
}

export async function resolveMapsUrl(url: string, bbox: CityBBox = ROME_BBOX): Promise<GeoPoint | null> {
  try {
    const head = await fetchWithTimeout(url, { method: 'GET', redirect: 'manual' })
    const location = head.headers.get('location')
    const hop = location ? new URL(location, url).href : url
    const fromHop = extractCoords(hop, bbox)
    if (fromHop) return fromHop

    const followed = await fetchWithTimeout(url)
    const fromFinal = extractCoords(followed.url, bbox)
    if (fromFinal) return fromFinal

    const html = await followed.text()
    return extractCoords(html.slice(0, 200_000), bbox)
  } catch {
    return null
  }
}
