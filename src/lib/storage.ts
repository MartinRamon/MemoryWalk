import Dexie, { type EntityTable } from 'dexie'
import type { Memory, Place } from '../types/models.ts'

type MemoryRow = Memory & { blob?: Blob }

// Nombre de la base de datos IndexedDB. Se mantiene 'viaj' a propósito pese al
// cambio de nombre a MemoryWalk: renombrarlo crearía una BD nueva y vacía, dejando
// huérfanos los recuerdos y lugares ya guardados en los navegadores existentes.
const db = new Dexie('viaj') as Dexie & {
  memories: EntityTable<MemoryRow, 'id'>
  places: EntityTable<Place, 'id'>
}

db.version(1).stores({
  memories: 'id, userId, collectionId, cityId, placeId, takenAt, hasGps',
})

db.version(2).stores({
  memories: 'id, userId, collectionId, cityId, placeId, takenAt, hasGps',
  places: 'id, userId, collectionId, cityId, category, name',
})

async function memoriesDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) return null
  try {
    const root = await navigator.storage.getDirectory()
    return root.getDirectoryHandle('memories', { create: true })
  } catch {
    return null
  }
}

export async function saveMemoryBlob(id: string, blob: Blob): Promise<void> {
  const dir = await memoriesDirectory()
  if (dir) {
    const handle = await dir.getFileHandle(id, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }
  await db.memories.update(id, { blob })
}

export async function readMemoryBlob(id: string): Promise<Blob | null> {
  const dir = await memoriesDirectory()
  if (dir) {
    try {
      const handle = await dir.getFileHandle(id)
      return handle.getFile()
    } catch {
      // Fall through to IndexedDB blob.
    }
  }
  const row = await db.memories.get(id)
  return row?.blob ?? null
}

export async function deleteMemoryBlob(id: string): Promise<void> {
  const dir = await memoriesDirectory()
  if (dir) {
    try {
      await dir.removeEntry(id)
    } catch {
      // File may only live in IndexedDB.
    }
  }
}

export async function listMemories(): Promise<Memory[]> {
  const rows = await db.memories.toArray()
  return rows.map((row) => {
    const { blob, ...memory } = row
    void blob
    return memory
  })
}

export async function putMemory(memory: Memory, blob: Blob): Promise<void> {
  await db.memories.put(memory)
  await saveMemoryBlob(memory.id, blob)
}

export async function updateMemory(id: string, patch: Partial<Memory>): Promise<void> {
  await db.memories.update(id, patch)
}

export async function removeMemory(id: string): Promise<void> {
  await deleteMemoryBlob(id)
  await db.memories.delete(id)
}

export async function listLocalPlaces(): Promise<Place[]> {
  return db.places.toArray()
}

export async function putLocalPlaces(places: Place[]): Promise<void> {
  await db.places.bulkPut(places)
}
