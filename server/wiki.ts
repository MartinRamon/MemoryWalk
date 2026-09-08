import { fetchWithTimeout } from './http.ts'
import type { WikiSnippet } from '../src/types/city.ts'

const USER_AGENT = 'Viaj/0.1 (personal travel map; wiki@viaj.local)'
const CACHE_MS = 24 * 60 * 60_000
const cache = new Map<string, { at: number; snippet: WikiSnippet | null }>()

type WikiLang = 'es' | 'it' | 'en'

function parseWikipediaTag(value: string): { lang: WikiLang; title: string } | null {
  const raw = value.trim()
  if (!raw) return null
  const [maybeLang, rest] = raw.includes(':') ? raw.split(/:(.*)/s) : ['it', raw]
  const lang = maybeLang === 'es' || maybeLang === 'it' || maybeLang === 'en' ? maybeLang : 'it'
  const title = (rest ?? raw).replaceAll('_', ' ').trim()
  return title ? { lang, title } : null
}

async function wikiGet<T>(url: string): Promise<T | null> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    },
    10_000,
  )
  if (!response.ok) return null
  return (await response.json()) as T
}

type Summary = {
  title?: string
  extract?: string
  content_urls?: { desktop?: { page?: string } }
  lang?: string
  thumbnail?: { source?: string }
  type?: string
}

function fromSummary(summary: Summary, fallbackLang: WikiLang): WikiSnippet | null {
  const extract = summary.extract?.trim()
  const url = summary.content_urls?.desktop?.page
  if (!extract || !url || summary.type === 'disambiguation') return null
  return {
    title: summary.title?.trim() || extract.slice(0, 40),
    extract,
    url,
    lang: summary.lang || fallbackLang,
    thumbnail: summary.thumbnail?.source,
  }
}

function summaryUrl(lang: WikiLang, title: string): string {
  return `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
}

async function fetchSummary(lang: WikiLang, title: string): Promise<WikiSnippet | null> {
  const summary = await wikiGet<Summary>(summaryUrl(lang, title))
  return summary ? fromSummary(summary, lang) : null
}

async function spanishTitle(lang: WikiLang, title: string): Promise<string | null> {
  if (lang === 'es') return title
  const endpoint = new URL(`https://${lang}.wikipedia.org/w/api.php`)
  endpoint.searchParams.set('action', 'query')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('prop', 'langlinks')
  endpoint.searchParams.set('lllang', 'es')
  endpoint.searchParams.set('titles', title)
  endpoint.searchParams.set('redirects', '1')
  const payload = await wikiGet<{
    query?: { pages?: Record<string, { langlinks?: Array<{ lang?: string; '*': string }> }> }
  }>(endpoint.toString())
  const pages = payload?.query?.pages
  if (!pages) return null
  for (const page of Object.values(pages)) {
    const link = page.langlinks?.find((item) => item.lang === 'es')
    if (link?.['*']) return link['*']
  }
  return null
}

async function fromWikipediaTag(tag: string): Promise<WikiSnippet | null> {
  const parsed = parseWikipediaTag(tag)
  if (!parsed) return null
  const spanish = await spanishTitle(parsed.lang, parsed.title)
  if (spanish) {
    const es = await fetchSummary('es', spanish)
    if (es) return es
  }
  return fetchSummary(parsed.lang, parsed.title)
}

async function fromWikidata(qid: string): Promise<WikiSnippet | null> {
  const endpoint = new URL('https://www.wikidata.org/w/api.php')
  endpoint.searchParams.set('action', 'wbgetentities')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('ids', qid)
  endpoint.searchParams.set('props', 'sitelinks')
  endpoint.searchParams.set('sitefilter', 'eswiki|itwiki|enwiki')
  const payload = await wikiGet<{
    entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>
  }>(endpoint.toString())
  const links = payload?.entities?.[qid]?.sitelinks
  const order: Array<[WikiLang, string]> = [
    ['es', 'eswiki'],
    ['it', 'itwiki'],
    ['en', 'enwiki'],
  ]
  for (const [lang, site] of order) {
    const title = links?.[site]?.title
    if (!title) continue
    const snippet = await fetchSummary(lang, title)
    if (snippet) return snippet
  }
  return null
}

export async function loadWikiSnippet(input: { wikipedia?: string; wikidata?: string }): Promise<WikiSnippet | null> {
  const key = `${input.wikidata ?? ''}|${input.wikipedia ?? ''}`
  if (!input.wikipedia && !input.wikidata) return null
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.snippet

  let snippet: WikiSnippet | null = null
  if (input.wikidata) snippet = await fromWikidata(input.wikidata)
  if (!snippet && input.wikipedia) snippet = await fromWikipediaTag(input.wikipedia)
  cache.set(key, { at: Date.now(), snippet })
  return snippet
}
