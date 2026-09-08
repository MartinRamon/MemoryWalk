import type { CityBBox } from './cities.ts'
import { extractCoords, ROME_BBOX, resolveMapsUrl } from './geo.ts'
import { fetchWithTimeout, HttpError } from './http.ts'
import type { GeoPoint } from '../src/types/models.ts'
import type { SourceKind } from '../src/types/ingest.ts'

export type SourcePayload = {
  url: string
  kind: SourceKind
  caption: string
  location: GeoPoint | null
  mapsUrl?: string
}

const SOURCE_CACHE_MS = 6 * 60 * 60_000
const sourceCache = new Map<string, { at: number; payload: SourcePayload }>()

function decodeEntities(value: string): string {
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .trim()
}

function metaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match?.[1]) return decodeEntities(match[1])
  }
  return ''
}

function looksLikeLoginWall(html: string): boolean {
  return /log\s*in|iniciar sesi[oó]n|signup|create an account/i.test(html.slice(0, 4000))
}

function nameFromMapsUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const query = parsed.searchParams.get('q') ?? parsed.searchParams.get('query') ?? ''
    if (query && !/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(query)) {
      return decodeURIComponent(query.replace(/\+/g, ' ')).split(',')[0]?.trim() ?? ''
    }
    const place = parsed.pathname.match(/\/place\/([^/]+)/)
    if (place?.[1]) return decodeURIComponent(place[1].replace(/\+/g, ' ')).split(',')[0]?.trim() ?? ''
  } catch {
    // Ignore malformed URLs.
  }
  return ''
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host === '0.0.0.0') return true
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local (incluye 169.254.169.254 de metadata cloud)
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a >= 224) return true // multicast / reservado
  }
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true // IPv6 ULA / link-local
  return false
}

// Rechaza enlaces no http(s) o que apunten a direcciones internas: evita usar el
// backend como proxy hacia la red local o los endpoints de metadatos (SSRF).
function assertPublicUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new HttpError(400, 'El enlace no es una URL válida.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'El enlace tiene que ser http o https.')
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new HttpError(400, 'Ese enlace apunta a una dirección interna y no se puede leer.')
  }
  return parsed
}

export function classifyUrl(raw: string): SourceKind {
  const host = new URL(raw).hostname.replace(/^www\./, '')
  if (host.includes('tiktok.com')) return 'tiktok'
  if (host.includes('instagram.com') || host === 'instagr.am') return 'instagram'
  if (host.includes('google.com') || host.includes('maps.app.goo.gl') || host === 'goo.gl') return 'maps'
  return 'web'
}

function instagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([^/?#]+)/i) ?? url.match(/instagr\.am\/(?:p|reel)\/([^/?#]+)/i)
  return match?.[1] ?? null
}

async function expandUrl(url: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow' })
    return response.url || url
  } catch {
    return url
  }
}

async function fetchTikTok(url: string): Promise<string> {
  const endpoint = new URL('https://www.tiktok.com/oembed')
  endpoint.searchParams.set('url', url)
  const response = await fetchWithTimeout(endpoint.toString(), { headers: { Accept: 'application/json' } })
  if (response.ok) {
    const data = (await response.json()) as { title?: string; author_name?: string }
    const title = data.title?.trim() ?? ''
    if (title) return title
  }
  const page = await fetchWithTimeout(url, { headers: { Accept: 'text/html' } })
  const html = await page.text()
  return metaContent(html, 'og:description') || metaContent(html, 'og:title')
}

async function fetchInstagram(url: string): Promise<string> {
  const code = instagramShortcode(url)
  const candidates = [
    url,
    ...(code
      ? [
          `https://www.instagram.com/reel/${code}/embed/captioned/`,
          `https://www.instagram.com/p/${code}/embed/captioned/`,
          `https://www.instagram.com/reel/${code}/`,
        ]
      : []),
  ]

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate, { headers: { Accept: 'text/html' } })
      if (!response.ok) continue
      const html = await response.text()
      if (looksLikeLoginWall(html) && html.length < 80_000) continue
      const caption =
        metaContent(html, 'og:description') ||
        metaContent(html, 'og:title') ||
        decodeEntities(html.match(/"caption"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ?? '') ||
        decodeEntities(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
      const cleaned = caption
        .replace(/^[^:]{1,80} on Instagram:\s*/i, '')
        .replace(/^Instagram\s*[·•-]\s*/i, '')
        .replace(/^["“]+|["”]+$/g, '')
        .trim()
      if (cleaned && !/^see (this|what)/i.test(cleaned)) return cleaned
    } catch {
      // Try the next candidate.
    }
  }
  return ''
}

async function fetchWeb(url: string): Promise<string> {
  const response = await fetchWithTimeout(url, { headers: { Accept: 'text/html' } })
  const html = await response.text()
  return (
    metaContent(html, 'og:description') ||
    metaContent(html, 'og:title') ||
    decodeEntities(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
  )
}

export async function readSource(rawUrl: string, cityBbox: CityBBox = ROME_BBOX): Promise<SourcePayload> {
  const cacheKey = `${cityBbox.minLat},${cityBbox.minLng}|${rawUrl.trim().toLowerCase()}`
  const hit = sourceCache.get(cacheKey)
  if (hit && Date.now() - hit.at < SOURCE_CACHE_MS) return hit.payload

  const payload = await readSourceFresh(rawUrl, cityBbox)
  // Solo cacheamos lecturas útiles; un fallo transitorio (muro de login, timeout)
  // no debe quedar fijado durante horas.
  if (payload.caption || payload.location) sourceCache.set(cacheKey, { at: Date.now(), payload })
  return payload
}

async function readSourceFresh(rawUrl: string, cityBbox: CityBBox): Promise<SourcePayload> {
  let url = rawUrl.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  const parsed = assertPublicUrl(url)

  url = await expandUrl(url)
  // Revalidamos tras seguir redirecciones: un enlace público puede redirigir a una dirección interna.
  assertPublicUrl(url)
  const kind = classifyUrl(url)

  if (kind === 'maps') {
    const location = (await resolveMapsUrl(url, cityBbox)) ?? extractCoords(url, cityBbox)
    const caption = nameFromMapsUrl(url)
    return { url, kind, caption, location, mapsUrl: parsed.href }
  }

  const caption =
    kind === 'tiktok' ? await fetchTikTok(url) : kind === 'instagram' ? await fetchInstagram(url) : await fetchWeb(url)

  return { url, kind, caption: caption.trim(), location: null }
}
