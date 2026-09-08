import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Place, PlaceCategory, PriceLevel } from '../src/types/models.ts'

type SourcePlace = {
  id: string
  name: string
  category: PlaceCategory
  note: string
  mapsUrl?: string
  query: string
  neighborhood?: string
  tags: string[]
  dishes: string[]
  priceLevel?: PriceLevel
  fallback?: { lat: number; lng: number }
}

type GeoResult = {
  lat: number
  lng: number
  source: 'maps' | 'nominatim' | 'manual'
}

const USER_AGENT =
  'Viaj/0.1 (personal travel map; https://github.com/viaj; contact: local-dev)'
const COLLECTION_ID = 'rome-food'
const CITY_ID = 'rome'
const USER_ID = 'me'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const sourcePath = join(scriptDir, 'rome-source.json')
const outPath = join(scriptDir, '..', 'src', 'data', 'rome-places.json')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ROME_BBOX = { minLat: 41.78, maxLat: 42.0, minLng: 12.38, maxLng: 12.62 }

function inRome(lat: number, lng: number): boolean {
  return (
    lat >= ROME_BBOX.minLat &&
    lat <= ROME_BBOX.maxLat &&
    lng >= ROME_BBOX.minLng &&
    lng <= ROME_BBOX.maxLng
  )
}

function extractCoords(text: string): { lat: number; lng: number } | null {
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

async function fetchWithBrowserHeaders(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'es,en;q=0.8',
      ...(init?.headers ?? {}),
    },
  })
}

async function resolveMapsUrl(url: string): Promise<GeoResult | null> {
  try {
    const head = await fetchWithBrowserHeaders(url, { method: 'GET', redirect: 'manual' })
    const location = head.headers.get('location')
    const hop = location ? new URL(location, url).href : url
    const fromHop = extractCoords(hop)
    if (fromHop) return { ...fromHop, source: 'maps' }

    const followed = await fetchWithBrowserHeaders(url, { redirect: 'follow' })
    const finalUrl = followed.url
    const fromFinal = extractCoords(finalUrl)
    if (fromFinal) return { ...fromFinal, source: 'maps' }

    const html = await followed.text()
    const fromHtml = extractCoords(html.slice(0, 200_000))
    if (fromHtml) return { ...fromHtml, source: 'maps' }
  } catch (error) {
    console.warn(`  maps resolve failed for ${url}:`, error)
  }
  return null
}

async function geocodeNominatim(query: string): Promise<GeoResult | null> {
  const endpoint = new URL('https://nominatim.openstreetmap.org/search')
  endpoint.searchParams.set('format', 'jsonv2')
  endpoint.searchParams.set('limit', '1')
  endpoint.searchParams.set('q', query)
  endpoint.searchParams.set('countrycodes', 'it')
  endpoint.searchParams.set('viewbox', `${ROME_BBOX.minLng},${ROME_BBOX.maxLat},${ROME_BBOX.maxLng},${ROME_BBOX.minLat}`)
  endpoint.searchParams.set('bounded', '1')

  const response = await fetch(endpoint, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!response.ok) {
    console.warn(`  nominatim ${response.status} for "${query}"`)
    return null
  }
  const results = (await response.json()) as Array<{ lat: string; lon: string }>
  const first = results[0]
  if (!first) return null
  return { lat: Number(first.lat), lng: Number(first.lon), source: 'nominatim' }
}

async function locate(source: SourcePlace): Promise<GeoResult | null> {
  if (source.mapsUrl) {
    const fromMaps = await resolveMapsUrl(source.mapsUrl)
    if (fromMaps) return fromMaps
  }
  await sleep(1100)
  const fromNominatim = await geocodeNominatim(source.query)
  if (fromNominatim) return fromNominatim
  if (source.fallback && inRome(source.fallback.lat, source.fallback.lng)) {
    return { ...source.fallback, source: 'manual' }
  }
  return null
}

async function main(): Promise<void> {
  const sources = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourcePlace[]
  const places: Place[] = []

  for (const [index, source] of sources.entries()) {
    process.stdout.write(`[${index + 1}/${sources.length}] ${source.name}... `)
    const geo = await locate(source)
    if (!geo) {
      console.log('UNRESOLVED')
      continue
    }
    console.log(`${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} (${geo.source})`)
    places.push({
      id: source.id,
      userId: USER_ID,
      collectionId: COLLECTION_ID,
      cityId: CITY_ID,
      name: source.name,
      category: source.category,
      note: source.note,
      mapsUrl: source.mapsUrl || undefined,
      location: { lat: geo.lat, lng: geo.lng },
      neighborhood: source.neighborhood || undefined,
      tags: source.tags,
      dishes: source.dishes,
      priceLevel: source.priceLevel,
      geocodeSource: geo.source,
    })
    await sleep(400)
  }

  writeFileSync(outPath, `${JSON.stringify(places, null, 2)}\n`, 'utf8')
  console.log(`\nWrote ${places.length}/${sources.length} places to ${outPath}`)
}

await main()
