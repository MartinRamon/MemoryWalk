import type { GeoPoint } from '../types/models.ts'
import { geocodePlace } from './api.ts'

export async function geocodeInRome(query: string, neighborhood?: string): Promise<GeoPoint | null> {
  try {
    const result = await geocodePlace(query, neighborhood)
    return result.location
  } catch {
    return null
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
