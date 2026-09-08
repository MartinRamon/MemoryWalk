import { strFromU8, strToU8, unzip, zip, type Unzipped, type Zippable } from 'fflate'
import { listLocalPlaces, listMemories, putLocalPlaces, putMemory, readMemoryBlob } from './storage.ts'
import type { Memory, Place } from '../types/models.ts'

const MANIFEST = 'viaj-backup.json'
const BACKUP_VERSION = 1

type Manifest = {
  app: 'viaj'
  version: number
  exportedAt: string
  places: Place[]
  memories: Memory[]
}

export type BackupSummary = { places: number; memories: number; media: number }

// fflate entrega Uint8Array<ArrayBufferLike>; en runtime es un BlobPart válido,
// pero TS no lo acepta directamente. Este helper hace explícito ese contrato.
function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type })
}

function zipAsync(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)))
  })
}

function unzipAsync(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)))
  })
}

/**
 * Empaqueta los lugares importados y los recuerdos (metadatos + binarios) en un
 * único .zip con un manifiesto JSON. El corpus curado no se incluye: vive en git.
 */
export async function exportBackup(): Promise<{ blob: Blob; filename: string; summary: BackupSummary }> {
  const places = await listLocalPlaces()
  const memories = await listMemories()

  const files: Zippable = {}
  let media = 0
  for (const memory of memories) {
    const blob = await readMemoryBlob(memory.id)
    if (!blob) continue
    files[`media/${memory.id}`] = new Uint8Array(await blob.arrayBuffer())
    media += 1
  }

  const manifest: Manifest = {
    app: 'viaj',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    places,
    memories,
  }
  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2))

  const zipped = await zipAsync(files)
  const blob = bytesToBlob(zipped, 'application/zip')
  const stamp = new Date().toISOString().slice(0, 10)
  return {
    blob,
    filename: `viaj-backup-${stamp}.zip`,
    summary: { places: places.length, memories: memories.length, media },
  }
}

/**
 * Restaura una copia .zip. Es aditivo: sobreescribe por id lo que coincida y deja
 * intacto el resto. No borra nada que no esté en la copia.
 */
export async function importBackup(file: File): Promise<BackupSummary> {
  const buffer = new Uint8Array(await file.arrayBuffer())
  let files: Unzipped
  try {
    files = await unzipAsync(buffer)
  } catch {
    throw new Error('No hemos podido abrir el archivo. ¿Seguro que es un .zip de Viaj?')
  }

  const manifestBytes = files[MANIFEST]
  if (!manifestBytes) throw new Error('El archivo no es una copia de Viaj válida (falta el manifiesto).')

  let manifest: Partial<Manifest>
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as Partial<Manifest>
  } catch {
    throw new Error('El manifiesto de la copia está dañado.')
  }
  if (manifest.app !== 'viaj' || !Array.isArray(manifest.places) || !Array.isArray(manifest.memories)) {
    throw new Error('El manifiesto de la copia no tiene el formato esperado.')
  }

  if (manifest.places.length > 0) await putLocalPlaces(manifest.places)

  let media = 0
  for (const memory of manifest.memories) {
    const bytes = files[`media/${memory.id}`]
    if (!bytes) continue
    const blob = bytesToBlob(bytes, memory.mimeType || 'application/octet-stream')
    await putMemory(memory, blob)
    media += 1
  }

  return { places: manifest.places.length, memories: manifest.memories.length, media }
}

/** Dispara la descarga del blob en el navegador. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
