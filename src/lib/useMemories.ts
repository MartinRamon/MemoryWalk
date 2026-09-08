import { listMemories, putMemory, readMemoryBlob, removeMemory, updateMemory } from './storage.ts'
import { memoryTypeFromFile, readMediaExif } from './exif.ts'
import { nearestPlace } from './geo.ts'
import { makeVideoPoster } from './video.ts'
import { nearestPhotoLocation } from './videoGps.ts'
import { LOCAL_USER_ID, type Memory, type Place } from '../types/models.ts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function useMemories(cityId: string, collectionId: string, places: Place[]) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
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
    setLoading(false)
  }, [cityId, revokeUnused])

  useEffect(() => {
    void load()
    return () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url)
    }
  }, [load])

  // Segunda pasada: los vídeos sin GPS heredan la ubicación de la foto más
  // cercana en el tiempo (mismo intervalo de grabación).
  const inheritVideoGps = useCallback(async () => {
    const all = (await listMemories()).filter((memory) => memory.cityId === cityId)
    const photos = all
      .filter((memory) => memory.type === 'photo' && memory.lat != null && memory.lng != null && memory.takenAt)
      .map((memory) => ({ takenAt: memory.takenAt as string, lat: memory.lat as number, lng: memory.lng as number }))
    if (photos.length === 0) return
    for (const video of all) {
      if (video.type !== 'video' || video.lat != null || video.lng != null || !video.takenAt) continue
      const loc = nearestPhotoLocation(video.takenAt, photos)
      if (!loc) continue
      const near = nearestPlace(loc, places)
      await updateMemory(video.id, {
        lat: loc.lat,
        lng: loc.lng,
        hasGps: false,
        gpsInherited: true,
        placeId: near?.id,
      })
    }
  }, [cityId, places])

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      setBusy(true)
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
          const type = memoryTypeFromFile(file)
          const exif = await readMediaExif(file)
          const nearby = exif.location ? nearestPlace(exif.location, places) : undefined
          const poster = type === 'video' ? await makeVideoPoster(file) : undefined
          const memory: Memory = {
            id: crypto.randomUUID(),
            userId: LOCAL_USER_ID,
            collectionId,
            cityId,
            placeId: nearby?.id,
            type,
            lat: exif.location?.lat,
            lng: exif.location?.lng,
            takenAt: exif.takenAt,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            createdAt: new Date().toISOString(),
            hasGps: Boolean(exif.location),
            poster,
          }
          await putMemory(memory, file)
        }
        await inheritVideoGps()
        await load()
      } finally {
        setBusy(false)
      }
    },
    [cityId, collectionId, inheritVideoGps, load, places],
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

  return { memories, placed, pending, urls, busy, loading, importFiles, pinMemory, setCaption, deleteMemory }
}
