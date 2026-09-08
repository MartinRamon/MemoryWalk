import { LOCAL_USER_ID, type Place, type PlaceCategory } from '../types/models.ts'

export type RecommendationDraft = {
  name: string
  note: string
  mapsUrl?: string
  category: PlaceCategory
  query: string
}

const MAPS_URL = /https:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+/g

const SECTION_RULES: Array<{ test: RegExp; category: PlaceCategory }> = [
  { test: /michelin|mejor restaurante/i, category: 'michelin' },
  { test: /pescado|marisco|seafood/i, category: 'seafood' },
  { test: /pizz/i, category: 'pizza' },
  { test: /vegan|vegetar/i, category: 'vegan' },
  { test: /helado|gelat/i, category: 'gelato' },
  { test: /callejera|street food|streetfood/i, category: 'street_food' },
  { test: /mercado|market/i, category: 'market' },
  { test: /museo|fuente|escultur|iglesia|atracci/i, category: 'attraction' },
]

function categoryFromSection(line: string): PlaceCategory | null {
  for (const rule of SECTION_RULES) {
    if (rule.test.test(line)) return rule.category
  }
  return null
}

function looksLikeHeader(line: string): boolean {
  if (!line || line.includes('http')) return false
  if (line.length > 70) return false
  return !line.includes('.') || line.split(' ').length <= 8
}

function parseChunk(chunk: string, fallback: PlaceCategory): { draft?: Omit<RecommendationDraft, 'mapsUrl'>; category: PlaceCategory } {
  const lines = chunk
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  let category = fallback
  const body: string[] = []
  for (const line of lines) {
    if (looksLikeHeader(line)) {
      const fromHeader = categoryFromSection(line)
      if (fromHeader) {
        category = fromHeader
        continue
      }
    }
    body.push(line)
  }

  const block = body.join(' ').replace(/\s+/g, ' ').trim()
  if (!block) return { category }

  const split = block.match(/^([^:]{2,80}):\s*(.*)$/)
  const name = (split?.[1] ?? block.split(/[.—]/)[0] ?? block).trim()
  const rest = (split ? split[2] : block.slice(name.length)).replace(/^[:.\-–]\s*/, '').trim()
  const note = rest === name ? '' : rest

  if (name.length < 2) return { category }

  return {
    category,
    draft: {
      name,
      note,
      category,
      query: `${name} Roma`,
    },
  }
}

export function parseRecommendations(raw: string, fallback: PlaceCategory = 'trattoria'): RecommendationDraft[] {
  const text = raw.replace(/\r/g, '').trim()
  if (!text) return []

  const drafts: RecommendationDraft[] = []
  let category = fallback
  let cursor = 0
  const matches = [...text.matchAll(MAPS_URL)]

  for (const match of matches) {
    const chunk = text.slice(cursor, match.index)
    const parsed = parseChunk(chunk, category)
    category = parsed.category
    if (parsed.draft) {
      drafts.push({ ...parsed.draft, mapsUrl: match[0] })
    }
    cursor = (match.index ?? 0) + match[0].length
  }

  const tail = parseChunk(text.slice(cursor), category)
  if (tail.draft) drafts.push(tail.draft)

  const seen = new Set<string>()
  return drafts.filter((draft) => {
    const key = `${draft.name.toLowerCase()}|${draft.mapsUrl ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function slugifyPlaceName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function draftToPartialPlace(draft: RecommendationDraft): Pick<Place, 'userId' | 'name' | 'category' | 'note' | 'mapsUrl' | 'tags' | 'dishes'> {
  return {
    userId: LOCAL_USER_ID,
    name: draft.name,
    category: draft.category,
    note: draft.note,
    mapsUrl: draft.mapsUrl,
    tags: ['ingesta'],
    dishes: [],
  }
}
