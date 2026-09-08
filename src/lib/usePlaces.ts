import { ROME_PLACES } from '../data/places.ts'
import { listLocalPlaces, putLocalPlaces } from './storage.ts'
import type { Place } from '../types/models.ts'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function usePlaces() {
  const [localPlaces, setLocalPlaces] = useState<Place[]>([])

  const load = useCallback(async () => {
    setLocalPlaces(await listLocalPlaces())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const places = useMemo(() => {
    const localIds = new Set(localPlaces.map((place) => place.id))
    return [...ROME_PLACES.filter((place) => !localIds.has(place.id)), ...localPlaces]
  }, [localPlaces])

  const addPlaces = useCallback(
    async (incoming: Place[]) => {
      await putLocalPlaces(incoming)
      await load()
    },
    [load],
  )

  return { places, localPlaces, addPlaces }
}
