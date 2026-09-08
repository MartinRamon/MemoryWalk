import { ROME_CITY, type ServerCity } from './cities.ts'
import { readSource } from './extract.ts'
import { geocodeInCity } from './geo.ts'
import { HttpError } from './http.ts'
import { failJob, finishJob, setStage } from './jobs.ts'
import { extractPlace, type ExtractedPlace } from './llm.ts'
import { transcribeAudio, transcriberEnabled } from './transcribe.ts'
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
export async function runIngest(jobId: string, rawUrl: string, city: ServerCity = ROME_CITY): Promise<void> {
  try {
    setStage(jobId, 'reading')
    const source = await readSource(rawUrl, city.bbox)

    let transcript: string | null = null
    let transcriptFailed = false
    if (source.kind === 'tiktok' || source.kind === 'instagram') {
      setStage(jobId, 'transcribing')
      const result = await transcribeAudio(source.url)
      transcript = result?.text ?? null
      if (!transcript && transcriberEnabled()) transcriptFailed = true
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
      location = await geocodeInCity(extracted.name, city, extracted.neighborhood)
      if (location) geocodeSource = 'nominatim'
    }

    const warnings: string[] = []
    if (transcriptFailed) {
      warnings.push('No pudimos transcribir el audio; usamos solo el pie de foto.')
    }
    if (!location) {
      warnings.push('No encontramos el punto en Roma. Corrige el nombre y confirma; volveremos a buscar.')
    }

    const draft: UrlIngestDraft = {
      sourceUrl: source.url,
      sourceKind: source.kind,
      caption: source.caption,
      transcript: transcript ?? undefined,
      transcribed: Boolean(transcript),
      transcriptFailed,
      name: extracted.name,
      note: extracted.note,
      dishes: extracted.dishes,
      category: extracted.category,
      neighborhood: extracted.neighborhood,
      location,
      geocodeSource,
      mapsUrl: source.mapsUrl,
      extractor: extracted.extractor,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined,
    }
    finishJob(jobId, draft)
  } catch (error) {
    if (error instanceof HttpError) {
      failJob(jobId, error.message)
      return
    }
    console.error('memorywalk-api ingest error:', error)
    failJob(jobId, 'No se pudo procesar el enlace.')
  }
}
