import type { GeoPoint } from '../src/types/models.ts'
import { fetchWithTimeout } from './http.ts'

export const ROME_BBOX = { minLat: 41.78, maxLat: 42.0, minLng: 12.38, maxLng: 12.62 }

const USER_AGENT = 'Viaj/0.1 (personal travel map; nominatim@viaj.local)'

export function inRome(lat: number, lng: number): boolean {
  return (
    lat >= ROME_BBOX.minLat &&
    lat <= ROME_BBOX.maxLat &&
    lng >= ROME_BBOX.minLng &&
    lng <= ROME_BBOX.maxLng
  )
}

export function extractCoords(text: string): GeoPoint | null {
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
      if (Number.isFinite(lat) && Number.isFinite(lng) && inRome(lat, lng)) {
        return { lat, lng }
      }
    }
  }
  return null
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let nominatimTail = Promise.resolve()

async function nominatimOnce(query: string): Promise<GeoPoint | null> {
  const endpoint = new URL('https://nominatim.openstreetmap.org/search')
  endpoint.searchParams.set('format', 'jsonv2')
  endpoint.searchParams.set('limit', '1')
  endpoint.searchParams.set('countrycodes', 'it')
  endpoint.searchParams.set('q', query.includes('Roma') ? query : `${query}, Roma, Italia`)
  endpoint.searchParams.set(
    'viewbox',
    `${ROME_BBOX.minLng},${ROME_BBOX.maxLat},${ROME_BBOX.maxLng},${ROME_BBOX.minLat}`,
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inRome(lat, lng)) return null
  return { lat, lng }
}

export async function geocodeInRome(query: string, neighborhood?: string): Promise<GeoPoint | null> {
  const needle = [query.trim(), neighborhood?.trim()].filter(Boolean).join(' ')
  if (!needle) return null

  const run = nominatimTail.then(() => nominatimOnce(needle))
  nominatimTail = run.then(
    () => wait(1100),
    () => wait(1100),
  )
  return run
}

export async function resolveMapsUrl(url: string): Promise<GeoPoint | null> {
  try {
    const head = await fetchWithTimeout(url, { method: 'GET', redirect: 'manual' })
    const location = head.headers.get('location')
    const hop = location ? new URL(location, url).href : url
    const fromHop = extractCoords(hop)
    if (fromHop) return fromHop

    const followed = await fetchWithTimeout(url)
    const fromFinal = extractCoords(followed.url)
    if (fromFinal) return fromFinal

    const html = await followed.text()
    return extractCoords(html.slice(0, 200_000))
  } catch {
    return null
  }
}
