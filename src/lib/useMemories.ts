import { listMemories, putMemory, readMemoryBlob, removeMemory, updateMemory } from './storage.ts'
import { memoryTypeFromFile, readMediaExif } from './exif.ts'
import { nearestPlace } from './geo.ts'
import { LOCAL_USER_ID, type Memory, type Place } from '../types/models.ts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function useMemories(cityId: string, collectionId: string, places: Place[]) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const urlsRef = useRef(urls)
  urlsRef.current = urls

  const revokeUnused = useCallback((next: Record<string, string>) => {
    for (const [id, url] of Object.entries(urlsRef.current)) {
      if (!next[id]) URL.revokeObjectURL(url)
    }
  }, [])

  const load = useCallback(async () => {
    const list = await listMemories()
    const forCity = list.filter((memory) => memory.cityId === cityId)
    const nextUrls: Record<string, string> = {}
    for (const memory of forCity) {
      const existing = urlsRef.current[memory.id]
      if (existing) {
        nextUrls[memory.id] = existing
        continue
      }
      const blob = await readMemoryBlob(memory.id)
      if (blob) nextUrls[memory.id] = URL.createObjectURL(blob)
    }
    revokeUnused(nextUrls)
    setUrls(nextUrls)
    setMemories(forCity)
  }, [cityId, revokeUnused])

  useEffect(() => {
    void load()
    return () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url)
    }
  }, [load])

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      setBusy(true)
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
          const exif = await readMediaExif(file)
          const nearby = exif.location ? nearestPlace(exif.location, places) : undefined
          const memory: Memory = {
            id: crypto.randomUUID(),
            userId: LOCAL_USER_ID,
            collectionId,
            cityId,
            placeId: nearby?.id,
            type: memoryTypeFromFile(file),
            lat: exif.location?.lat,
            lng: exif.location?.lng,
            takenAt: exif.takenAt,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            createdAt: new Date().toISOString(),
            hasGps: Boolean(exif.location),
          }
          await putMemory(memory, file)
        }
        await load()
      } finally {
        setBusy(false)
      }
    },
    [cityId, collectionId, load, places],
  )

  const pinMemory = useCallback(
    async (id: string, lat: number, lng: number) => {
      const nearby = nearestPlace({ lat, lng }, places)
      await updateMemory(id, { lat, lng, hasGps: false, placeId: nearby?.id })
      await load()
    },
    [load, places],
  )

  const setCaption = useCallback(
    async (id: string, caption: string) => {
      await updateMemory(id, { caption: caption || undefined })
      await load()
    },
    [load],
  )

  const deleteMemory = useCallback(
    async (id: string) => {
      await removeMemory(id)
      await load()
    },
    [load],
  )

  const pending = useMemo(
    () => memories.filter((memory) => memory.lat == null || memory.lng == null),
    [memories],
  )

  const placed = useMemo(
    () => memories.filter((memory) => memory.lat != null && memory.lng != null),
    [memories],
  )

  return { memories, placed, pending, urls, busy, importFiles, pinMemory, setCaption, deleteMemory }
}
