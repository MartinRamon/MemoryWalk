import type { PlaceCategory } from '../types/models.ts'

export type CategoryMeta = {
  id: PlaceCategory
  label: string
  shortLabel: string
  color: string
}

export const CATEGORY_META: Record<PlaceCategory, CategoryMeta> = {
  trattoria: { id: 'trattoria', label: 'Trattorias', shortLabel: 'Trattoria', color: '#b5522a' },
  pizza: { id: 'pizza', label: 'Pizzerías', shortLabel: 'Pizza', color: '#c45c3e' },
  vegan: { id: 'vegan', label: 'Vegano', shortLabel: 'Vegano', color: '#3f4f38' },
  gelato: { id: 'gelato', label: 'Helado', shortLabel: 'Helado', color: '#b07a8a' },
  street_food: { id: 'street_food', label: 'Street food', shortLabel: 'Calle', color: '#c4892a' },
  seafood: { id: 'seafood', label: 'Pescado', shortLabel: 'Pescado', color: '#3d5a73' },
  michelin: { id: 'michelin', label: 'Michelin', shortLabel: 'Michelin', color: '#8a6a1f' },
  market: { id: 'market', label: 'Mercados', shortLabel: 'Mercado', color: '#5a6b3a' },
  attraction: { id: 'attraction', label: 'Atracciones', shortLabel: 'Ciudad', color: '#4a5560' },
}

export const FILTER_ORDER: PlaceCategory[] = [
  'trattoria',
  'pizza',
  'street_food',
  'gelato',
  'vegan',
  'seafood',
  'michelin',
  'market',
  'attraction',
]
