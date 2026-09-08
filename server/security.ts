import type { IncomingMessage } from 'node:http'
import { env } from './env.ts'
import { HttpError } from './http.ts'

// Orígenes permitidos para CORS. Por defecto, solo la app local (Vite dev y preview).
// En producción se configura con la variable de entorno ALLOWED_ORIGINS (separados por comas).
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
].join(',')

export function allowedOrigins(): string[] {
  return env('ALLOWED_ORIGINS', DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

/** Devuelve el Origin de la petición si está permitido; si no, undefined (sin cabeceras CORS). */
export function resolveCorsOrigin(req: IncomingMessage): string | undefined {
  const origin = req.headers.origin
  if (!origin) return undefined
  return allowedOrigins().includes(origin) ? origin : undefined
}

// ---- Rate limit en memoria (ventana fija por IP + nombre de cubo) ----

type Window = { count: number; resetAt: number }
const buckets = new Map<string, Window>()

function prune(now: number): void {
  if (buckets.size < 5000) return
  for (const [key, win] of buckets) {
    if (now >= win.resetAt) buckets.delete(key)
  }
}

export function rateLimit(req: IncomingMessage, name: string, limit: number, windowMs: number): void {
  const ip = req.socket.remoteAddress ?? 'unknown'
  const key = `${name}:${ip}`
  const now = Date.now()
  prune(now)
  const win = buckets.get(key)
  if (!win || now >= win.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  win.count += 1
  if (win.count > limit) {
    throw new HttpError(429, 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.')
  }
}

// ---- Validadores ligeros (sin dependencias) ----

export function reqString(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `Falta el campo "${field}".`)
  if (value.length > max) throw new HttpError(400, `El campo "${field}" es demasiado largo.`)
  return value.trim()
}

export function optString(value: unknown, field: string, max = 500): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') throw new HttpError(400, `El campo "${field}" no es válido.`)
  if (value.length > max) throw new HttpError(400, `El campo "${field}" es demasiado largo.`)
  return value.trim()
}

export function reqLat(value: number, field: string): number {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    throw new HttpError(400, `Latitud inválida en "${field}".`)
  }
  return value
}

export function reqLng(value: number, field: string): number {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    throw new HttpError(400, `Longitud inválida en "${field}".`)
  }
  return value
}
