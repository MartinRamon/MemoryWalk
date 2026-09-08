import romePlaces from './rome-places.json' with { type: 'json' }
import type { Place } from '../types/models.ts'

export const ROME_PLACES = romePlaces as Place[]
