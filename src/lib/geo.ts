import type { GeoPoint, Place } from '../types/models.ts'

const EARTH_RADIUS_M = 6_371_000

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function nearbyPlaces(point: GeoPoint, places: Place[], radiusM = 180): Place[] {
  return places
    .map((place) => ({ place, distance: haversineMeters(point, place.location) }))
    .filter((entry) => entry.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.place)
}

export function nearestPlace(point: GeoPoint, places: Place[], radiusM = 180): Place | undefined {
  return nearbyPlaces(point, places, radiusM)[0]
}
