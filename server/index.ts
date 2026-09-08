import { createServer } from 'node:http'
import { env, loadDotEnv } from './env.ts'
import { readSource } from './extract.ts'
import { geocodeInRome } from './geo.ts'
import { readJson, sendEmpty, sendJson } from './http.ts'
import { extractPlace } from './llm.ts'
import { loadCityPois } from './overpass.ts'
import { loadWikiSnippet } from './wiki.ts'
import type { UrlIngestDraft } from '../src/types/ingest.ts'

loadDotEnv()

const PORT = Number(env('PORT', '8787'))

function pathnameOf(url: string): string {
  return new URL(url, `http://127.0.0.1:${PORT}`).pathname
}

createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET'
    const path = pathnameOf(req.url ?? '/')

    if (method === 'OPTIONS') {
      sendEmpty(res, 204)
      return
    }

    if (method === 'GET' && (path === '/' || path === '/api')) {
      sendJson(res, 200, {
        ok: true,
        service: 'viaj-api',
        ui: 'http://localhost:5173',
        health: '/api/health',
        city: '/api/city',
        wiki: '/api/wiki',
      })
      return
    }

    if (method === 'GET' && path === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        grok: Boolean(env('XAI_API_KEY')),
        model: env('XAI_MODEL', 'grok-4.3'),
      })
      return
    }

    if (method === 'GET' && path === '/api/geocode') {
      const query = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
      const q = query.searchParams.get('q') ?? ''
      const neighborhood = query.searchParams.get('neighborhood') ?? undefined
      const location = await geocodeInRome(q, neighborhood)
      if (!location) {
        sendJson(res, 404, { error: 'No encontramos coordenadas en Roma para ese nombre.' })
        return
      }
      sendJson(res, 200, { location, geocodeSource: 'nominatim' })
      return
    }

    if (method === 'POST' && path === '/api/geocode') {
      const body = await readJson<{ q?: string; neighborhood?: string }>(req)
      const location = await geocodeInRome(body.q ?? '', body.neighborhood)
      if (!location) {
        sendJson(res, 404, { error: 'No encontramos coordenadas en Roma para ese nombre.' })
        return
      }
      sendJson(res, 200, { location, geocodeSource: 'nominatim' })
      return
    }

    if (method === 'GET' && path === '/api/city') {
      const query = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
      const south = Number(query.searchParams.get('south'))
      const west = Number(query.searchParams.get('west'))
      const north = Number(query.searchParams.get('north'))
      const east = Number(query.searchParams.get('east'))
      if (![south, west, north, east].every(Number.isFinite)) {
        sendJson(res, 400, { error: 'Falta el recuadro del mapa.' })
        return
      }
      const significant = query.searchParams.get('significant') === '1'
      const pois = await loadCityPois({ south, west, north, east }, significant)
      sendJson(res, 200, { pois })
      return
    }

    if (method === 'GET' && path === '/api/wiki') {
      const query = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
      const wikipedia = query.searchParams.get('wikipedia') ?? undefined
      const wikidata = query.searchParams.get('wikidata') ?? undefined
      if (!wikipedia && !wikidata) {
        sendJson(res, 400, { error: 'Falta wikipedia o wikidata.' })
        return
      }
      const snippet = await loadWikiSnippet({ wikipedia, wikidata })
      sendJson(res, 200, { snippet })
      return
    }

    if (method === 'POST' && path === '/api/ingest/url') {
      const body = await readJson<{ url?: string }>(req)
      const raw = body.url?.trim() ?? ''
      if (!raw) {
        sendJson(res, 400, { error: 'Pega un enlace de TikTok, Instagram o Maps.' })
        return
      }

      const source = await readSource(raw)
      if (!source.caption && !source.location) {
        sendJson(res, 422, {
          error:
            source.kind === 'instagram'
              ? 'Instagram no ha dejado leer el pie de foto. Prueba un Reel público o un TikTok.'
              : 'No hemos podido leer ese enlace.',
        })
        return
      }

      const extracted = source.caption ? await extractPlace(source.caption) : {
        name: '',
        note: '',
        dishes: [] as string[],
        category: 'trattoria' as const,
        extractor: 'heuristic' as const,
      }

      if (!extracted.name && !source.location) {
        sendJson(res, 422, {
          error: 'El vídeo no nombra un local claro. Prueba otro enlace.',
          caption: source.caption,
        })
        return
      }

      let location = source.location
      let geocodeSource: UrlIngestDraft['geocodeSource'] = location ? 'maps' : undefined
      if (!location && extracted.name) {
        location = await geocodeInRome(extracted.name, extracted.neighborhood)
        if (location) geocodeSource = 'nominatim'
      }

      const draft: UrlIngestDraft = {
        sourceUrl: source.url,
        sourceKind: source.kind,
        caption: source.caption,
        name: extracted.name,
        note: extracted.note,
        dishes: extracted.dishes,
        category: extracted.category,
        neighborhood: extracted.neighborhood,
        location,
        geocodeSource,
        mapsUrl: source.mapsUrl,
        extractor: extracted.extractor,
        warning: location
          ? undefined
          : 'No encontramos el punto en Roma. Corrige el nombre y confirma; volveremos a buscar.',
      }
      sendJson(res, 200, { draft })
      return
    }

    sendJson(res, 404, { error: 'Ruta no encontrada' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    sendJson(res, 500, { error: message })
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Viaj API http://127.0.0.1:${PORT}`)
})
