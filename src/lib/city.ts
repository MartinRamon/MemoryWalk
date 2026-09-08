import type { CityKind } from '../types/city.ts'

export const CITY_MIN_ZOOM = 14

export type CityKindMeta = {
  id: CityKind
  label: string
  shortLabel: string
  mark: string
  color: string
}

export const CITY_KIND_META: Record<CityKind, CityKindMeta> = {
  museum: { id: 'museum', label: 'Museos', shortLabel: 'Museos', mark: 'M', color: '#5c4a3a' },
  fountain: { id: 'fountain', label: 'Fuentes', shortLabel: 'Fuentes', mark: 'F', color: '#3d6b7a' },
  church: { id: 'church', label: 'Iglesias', shortLabel: 'Iglesias', mark: 'I', color: '#6b4e71' },
  sculpture: { id: 'sculpture', label: 'Esculturas', shortLabel: 'Esculturas', mark: 'E', color: '#6a5a3e' },
}

export const CITY_KIND_ORDER: CityKind[] = ['museum', 'fountain', 'church', 'sculpture']
