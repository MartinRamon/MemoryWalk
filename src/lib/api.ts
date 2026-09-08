import type { CityBbox, CityPoi, WikiSnippet } from '../types/city.ts'
import type { GeoPoint } from '../types/models.ts'
import type { IngestJobStatus } from '../types/ingest.ts'

export type ApiHealth = {
  ok: boolean
  grok: boolean
  model: string
  transcriber: 'disabled' | 'unreachable' | 'ready'
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string }
    if (payload.error) return payload.error
  } catch {
    // Ignore parse errors.
  }
  return `Error ${response.status}`
}

export async function fetchHealth(): Promise<ApiHealth> {
  const response = await fetch('/api/health')
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<ApiHealth>
}

export async function startIngest(url: string): Promise<string> {
  const response = await fetch('/api/ingest/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error(await readError(response))
  const payload = (await response.json()) as { jobId: string }
  return payload.jobId
}

export async function getIngestStatus(jobId: string): Promise<IngestJobStatus> {
  const response = await fetch(`/api/ingest/status/${encodeURIComponent(jobId)}`)
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<IngestJobStatus>
}

export async function geocodePlace(
  query: string,
  neighborhood?: string,
  city = 'roma',
): Promise<{ location: GeoPoint; geocodeSource: 'nominatim' }> {
  const response = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, neighborhood, city }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ location: GeoPoint; geocodeSource: 'nominatim' }>
}

export async function fetchCityPois(
  bbox: CityBbox,
  options: { significant?: boolean; signal?: AbortSignal; city?: string } = {},
): Promise<CityPoi[]> {
  const params = new URLSearchParams({
    south: String(bbox.south),
    west: String(bbox.west),
    north: String(bbox.north),
    east: String(bbox.east),
  })
  if (options.significant) params.set('significant', '1')
  if (options.city) params.set('city', options.city)
  const response = await fetch(`/api/city?${params}`, { signal: options.signal })
  if (!response.ok) throw new Error(await readError(response))
  const payload = (await response.json()) as { pois: CityPoi[] }
  return payload.pois
}

export async function fetchWikiSnippet(input: {
  wikipedia?: string
  wikidata?: string
}): Promise<WikiSnippet | null> {
  if (!input.wikipedia && !input.wikidata) return null
  const params = new URLSearchParams()
  if (input.wikipedia) params.set('wikipedia', input.wikipedia)
  if (input.wikidata) params.set('wikidata', input.wikidata)
  const response = await fetch(`/api/wiki?${params}`)
  if (!response.ok) throw new Error(await readError(response))
  const payload = (await response.json()) as { snippet: WikiSnippet | null }
  return payload.snippet
}
