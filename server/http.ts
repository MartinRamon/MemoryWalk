import type { IncomingMessage, ServerResponse } from 'node:http'

/** Error con código HTTP y mensaje seguro para mostrar al cliente. */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function corsHeaders(origin?: string): Record<string, string> {
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown, corsOrigin?: string): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(corsOrigin),
  })
  res.end(json)
}

export function sendEmpty(res: ServerResponse, status: number, corsOrigin?: string): void {
  res.writeHead(status, corsHeaders(corsOrigin))
  res.end()
}

export async function readJson<T>(req: IncomingMessage, maxBytes = 1_000_000): Promise<T> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    total += (chunk as Buffer).length
    if (total > maxBytes) throw new HttpError(413, 'El cuerpo de la petición es demasiado grande.')
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'El cuerpo de la petición no es JSON válido.')
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: init.redirect ?? 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es,it,en;q=0.8',
        ...(init.headers ?? {}),
      },
    })
  } finally {
    clearTimeout(timer)
  }
}
