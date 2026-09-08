import { createServer } from 'node:http'
import { env, loadDotEnv } from './env.ts'
import { readSource } from './extract.ts'
import { geocodeInRome } from './geo.ts'
import { HttpError, readJson, sendEmpty, sendJson } from './http.ts'
import { extractPlace } from './llm.ts'
import { loadCityPois } from './overpass.ts'
import { optString, rateLimit, reqLat, reqLng, reqString, resolveCorsOrigin } from './security.ts'
import { loadWikiSnippet } from './wiki.ts'
import type { UrlIngestDraft } from '../src/types/ingest.ts'

loadDotEnv()

const PORT = Number(env('PORT', '8787'))
const MINUTE = 60_000

function pathnameOf(url: string): string {
  return new URL(url, `http://127.0.0.1:${PORT}`).pathname
}

createServer(async (req, res) => {
  const cors = resolveCorsOrigin(req)
  try {
    const method = req.method ?? 'GET'
    const path = pathnameOf(req.url ?? '/')

    if (method === 'OPTIONS') {
      sendEmpty(res, 204, cors)
      return
    }

    // Tope global por IP; las rutas caras añaden su propio límite más estricto.
    rateLimit(req, 'global', 240, MINUTE)

    if (method === 'GET' && (path === '/' || path === '/api')) {
      sendJson(res, 200, {
        ok: true,
        service: 'viaj-api',
        ui: 'http://localhost:5173',
        health: '/api/health',
        city: '/api/city',
        wiki: '/api/wiki',
      }, cors)
      return
    }

    if (method === 'GET' && path === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        grok: Boolean(env('XAI_API_KEY')),
        model: env('XAI_MODEL', 'grok-4.3'),
      }, cors)
      return
    }

    if (path === '/api/geocode' && (method === 'GET' || method === 'POST')) {
      rateLimit(req, 'geocode', 40, MINUTE)
      let q: string
      let neighborhood: string | undefined
      if (method === 'GET') {
        const query = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
        q = reqString(query.searchParams.get('q'), 'q', 200)
        neighborhood = optString(query.searchParams.get('neighborhood'), 'neighborhood', 120)
      } else {
        const body = await readJson<{ q?: unknown; neighborhood?: unknown }>(req)
        q = reqString(body.q, 'q', 200)
        neighborhood = optString(body.neighborhood, 'neighborhood', 120)
      }
      const location = await geocodeInRome(q, neighborhood)
      if (!location) {
        sendJson(res, 404, { error: 'No encontramos coordenadas en Roma para ese nombre.' }, cors)
        return
      }
      sendJson(res, 200, { location, geocodeSource: 'nominatim' }, cors)
      return
    }

    if (method === 'GET' && path === '/api/city') {
      rateLimit(req, 'city', 60, MINUTE)
      const query = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
      const south = reqLat(Number(query.searchParams.get('south')), 'south')
      const west = reqLng(Number(query.searchParams.get('west')), 'west')
      const north = reqLat(Number(query.searchParams.get('north')), 'north')
      const east = reqLng(Number(query.searchParams.get('east')), 'east')
      const significant = query.searchParams.get('significant') === '1'
      const pois = await loadCityPois({ south, west, north, east }, significant)
      sendJson(res, 200, { pois }, cors)
      return
    }

    if (method === 'GET' && path === '/api/wiki') {
      rateLimit(req, 'wiki', 60, MINUTE)
      const query = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
      const wikipedia = optString(query.searchParams.get('wikipedia'), 'wikipedia', 300)
      const wikidata = optString(query.searchParams.get('wikidata'), 'wikidata', 40)
      if (!wikipedia && !wikidata) {
        sendJson(res, 400, { error: 'Falta wikipedia o wikidata.' }, cors)
        return
      }
      const snippet = await loadWikiSnippet({ wikipedia, wikidata })
      sendJson(res, 200, { snippet }, cors)
      return
    }

    if (method === 'POST' && path === '/api/ingest/url') {
      rateLimit(req, 'ingest', 15, MINUTE)
      const body = await readJson<{ url?: unknown }>(req)
      const raw = reqString(body.url, 'url', 2048)

      const source = await readSource(raw)
      if (!source.caption && !source.location) {
        sendJson(res, 422, {
          error:
            source.kind === 'instagram'
              ? 'Instagram no ha dejado leer el pie de foto. Prueba un Reel público o un TikTok.'
              : 'No hemos podido leer ese enlace.',
        }, cors)
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
        }, cors)
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
      sendJson(res, 200, { draft }, cors)
      return
    }

    sendJson(res, 404, { error: 'Ruta no encontrada' }, cors)
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message }, cors)
      return
    }
    // Errores inesperados: se registran en el servidor, pero no se filtra el detalle al cliente.
    console.error('viaj-api error:', error)
    sendJson(res, 500, { error: 'Error interno del servidor.' }, cors)
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Viaj API http://127.0.0.1:${PORT}`)
})
