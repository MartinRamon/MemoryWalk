import { isPlaceCategory } from '../src/types/ingest.ts'
import { PLACE_CATEGORIES, type PlaceCategory } from '../src/types/models.ts'
import { env } from './env.ts'
import { fetchWithTimeout } from './http.ts'

export type ExtractedPlace = {
  name: string
  note: string
  dishes: string[]
  category: PlaceCategory
  neighborhood?: string
  extractor: 'grok' | 'heuristic'
}

const CATEGORY_HINTS: Array<{ test: RegExp; category: PlaceCategory }> = [
  { test: /michelin|estrellas/i, category: 'michelin' },
  { test: /pescado|marisco|seafood|crudo|ostras/i, category: 'seafood' },
  { test: /pizz/i, category: 'pizza' },
  { test: /vegan|vegetar/i, category: 'vegan' },
  { test: /helado|gelat/i, category: 'gelato' },
  { test: /trapizz|suppl|street food|callejera|al taglio/i, category: 'street_food' },
  { test: /mercado|market/i, category: 'market' },
  { test: /museo|fuente|iglesia|atracci/i, category: 'attraction' },
]

function categoryFromText(text: string): PlaceCategory {
  for (const rule of CATEGORY_HINTS) {
    if (rule.test.test(text)) return rule.category
  }
  return 'trattoria'
}

function cleanCaption(caption: string): string {
  return caption
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function heuristicExtract(caption: string): ExtractedPlace {
  const text = cleanCaption(caption)
  const quoted = text.match(/[“"«]([^”"»]{3,70})[”"»]/)
  const at = text.match(/\b(?:en|at|da|di|from)\s+([A-ZÁÉÍÓÚÑ][\w'’àèéìòù. -]{2,50})/)
  const hashtag = [...text.matchAll(/#([A-Za-z][A-Za-z0-9]{3,})/g)]
    .map((match) => match[1].replace(/([a-z])([A-Z])/g, '$1 $2'))
    .find((value) => /[A-Z]/.test(value) && value.length > 4)

  const name = (quoted?.[1] ?? at?.[1] ?? hashtag ?? text.replace(/[#@].*$/, '').trim())
    .replace(/[.,!?]+$/g, '')
    .slice(0, 80)
    .trim()

  return {
    name: name.length >= 3 ? name : '',
    note: text.slice(0, 400),
    dishes: [],
    category: categoryFromText(text),
    extractor: 'heuristic',
  }
}

type GrokChoice = {
  message?: { content?: string }
}

async function grokExtract(caption: string): Promise<ExtractedPlace | null> {
  const key = env('XAI_API_KEY')
  if (!key) return null

  const model = env('XAI_MODEL', 'grok-4.3')
  const response = await fetchWithTimeout(
    'https://api.x.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Extraes recomendaciones de restaurantes o sitios de Roma a partir de pies de foto de TikTok, Instagram o webs. Responde SOLO un JSON con: name (nombre del local, string vacía si no hay), note (1-3 frases en español: por qué lo recomiendan y el plato si se nombra), dishes (array de platos), category (una de: ${PLACE_CATEGORIES.join(', ')}), neighborhood (barrio romano o null). No inventes un local que no esté en el texto.`,
          },
          { role: 'user', content: caption.slice(0, 4000) },
        ],
      }),
    },
    20_000,
  )
  if (!response.ok) return null
  const payload = (await response.json()) as { choices?: GrokChoice[] }
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) return null
  const parsed = JSON.parse(content) as {
    name?: unknown
    note?: unknown
    dishes?: unknown
    category?: unknown
    neighborhood?: unknown
  }
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
  const note = typeof parsed.note === 'string' ? parsed.note.trim() : ''
  const dishes = Array.isArray(parsed.dishes)
    ? parsed.dishes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const category = typeof parsed.category === 'string' && isPlaceCategory(parsed.category) ? parsed.category : categoryFromText(caption)
  const neighborhood = typeof parsed.neighborhood === 'string' && parsed.neighborhood.trim() ? parsed.neighborhood.trim() : undefined
  return { name, note, dishes, category, neighborhood, extractor: 'grok' }
}

export async function extractPlace(caption: string): Promise<ExtractedPlace> {
  const fallback = heuristicExtract(caption)
  try {
    const fromGrok = await grokExtract(caption)
    if (fromGrok) {
      if (!fromGrok.name) return fromGrok
      return {
        ...fromGrok,
        note: fromGrok.note || fallback.note,
        dishes: fromGrok.dishes.length > 0 ? fromGrok.dishes : fallback.dishes,
      }
    }
  } catch {
    // Fall through to the heuristic.
  }
  return fallback
}
