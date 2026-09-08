import type { City, Collection } from '../types/models.ts'
import { LOCAL_USER_ID } from '../types/models.ts'

export const ROME: City = {
  id: 'rome',
  name: 'Roma',
  country: 'Italia',
  center: { lat: 41.895, lng: 12.482 },
  zoom: 12.4,
  bbox: { south: 41.78, west: 12.38, north: 42.0, east: 12.62 },
}

export const ROME_FOOD_COLLECTION: Collection = {
  id: 'rome-food',
  userId: LOCAL_USER_ID,
  cityId: ROME.id,
  title: 'Roma — comida',
  description: 'Recomendaciones gastronómicas para recorrer la ciudad.',
}
