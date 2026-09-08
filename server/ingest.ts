import { readSource } from './extract.ts'
import { geocodeInRome } from './geo.ts'
import { HttpError } from './http.ts'
import { failJob, finishJob, setStage } from './jobs.ts'
import { extractPlace, type ExtractedPlace } from './llm.ts'
import { transcribeAudio } from './transcribe.ts'
import type { UrlIngestDraft } from '../src/types/ingest.ts'

/** Junta transcripción y pie de foto en un solo texto para la extracción. */
export function combineSourceText(transcript?: string | null, caption?: string | null): string {
  const t = transcript?.trim() ?? ''
  const c = caption?.trim() ?? ''
  if (t && c) return `${c}\n\n[Transcripción del audio]\n${t}`
  return t || c
}

function emptyExtract(): ExtractedPlace {
  return { name: '', note: '', dishes: [], category: 'trattoria', extractor: 'heuristic' }
}

/**
 * Orquesta la ingesta en etapas y va actualizando el job:
 * reading → transcribing → extracting → locating → done/error.
 * La transcripción es un extra: si falla, seguimos con el pie de foto.
 */
export async function runIngest(jobId: string, rawUrl: string): Promise<void> {
  try {
    setStage(jobId, 'reading')
    const source = await readSource(rawUrl)

    let transcript: string | null = null
    if (source.kind === 'tiktok' || source.kind === 'instagram') {
      setStage(jobId, 'transcribing')
      const result = await transcribeAudio(source.url)
      transcript = result?.text ?? null
    }

    setStage(jobId, 'extracting')
    const text = combineSourceText(transcript, source.caption)
    const extracted = text ? await extractPlace(text) : emptyExtract()

    if (!extracted.name && !source.location && !text) {
      failJob(
        jobId,
        source.kind === 'instagram'
          ? 'Instagram no ha dejado leer el vídeo. Prueba un Reel público o un TikTok.'
          : 'No hemos podido leer ese enlace.',
      )
      return
    }

    setStage(jobId, 'locating')
    let location = source.location
    let geocodeSource: UrlIngestDraft['geocodeSource'] = location ? 'maps' : undefined
    if (!location && extracted.name) {
      location = await geocodeInRome(extracted.name, extracted.neighborhood)
      if (location) geocodeSource = 'nominatim'
    }

    const draft: UrlIngestDraft = {
      sourceUrl: source.url,
      sourceKind: source.kind,
      caption: source.caption,
      transcript: transcript ?? undefined,
      transcribed: Boolean(transcript),
      name: extracted.name,
      note: extracted.note,
      dishes: extracted.dishes,
      category: extracted.category,
      neighborhood: extracted.neighborhood,
      location,
      geocodeSource,
      mapsUrl: source.mapsUrl,
      extractor: extracted.extractor,
      warning: location
        ? undefined
        : 'No encontramos el punto en Roma. Corrige el nombre y confirma; volveremos a buscar.',
    }
    finishJob(jobId, draft)
  } catch (error) {
    if (error instanceof HttpError) {
      failJob(jobId, error.message)
      return
    }
    console.error('viaj-api ingest error:', error)
    failJob(jobId, 'No se pudo procesar el enlace.')
  }
}
