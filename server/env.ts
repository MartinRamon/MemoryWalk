import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadDotEnv(cwd = process.cwd()): void {
  const path = resolve(cwd, '.env')
  let text = ''
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const cut = line.indexOf('=')
    if (cut <= 0) continue
    const key = line.slice(0, cut).trim()
    let value = line.slice(cut + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

export function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback
}
