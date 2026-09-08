import { env } from './env.ts'
import { fetchWithTimeout } from './http.ts'

export type TranscriptResult = {
  text: string
  language?: string
}

export type Transcriber = {
  name: string
  transcribe(url: string): Promise<TranscriptResult | null>
}

/**
 * Adaptador B: sidecar Python (faster-whisper + yt-dlp). El sidecar descarga el
 * audio y lo transcribe; aquí solo hablamos con él por HTTP en localhost.
 * Diseñado como interfaz para poder añadir el adaptador A (STT alojado) sin tocar
 * el resto del pipeline.
 */
function sidecarTranscriber(): Transcriber | null {
  const base = env('TRANSCRIBER_URL', 'http://127.0.0.1:8788')
  if (!base) return null
  return {
    name: 'faster-whisper',
    async transcribe(url) {
      const response = await fetchWithTimeout(
        `${base.replace(/\/$/, '')}/transcribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ url }),
        },
        120_000,
      )
      if (!response.ok) return null
      const data = (await response.json()) as { text?: unknown; language?: unknown; no_speech?: unknown }
      if (data.no_speech === true) return null
      const text = typeof data.text === 'string' ? data.text.trim() : ''
      if (!text) return null
      return { text, language: typeof data.language === 'string' ? data.language : undefined }
    },
  }
}

function activeTranscriber(): Transcriber | null {
  // Habilitado solo si TRANSCRIBER_URL apunta a un sidecar (o usa el valor por defecto).
  if (env('TRANSCRIBER_DISABLED') === '1') return null
  return sidecarTranscriber()
}

/**
 * Devuelve la transcripción del audio del vídeo, o null si no hay transcriptor,
 * el vídeo no tiene voz, o algo falla. Nunca lanza: la transcripción es un extra
 * y el pipeline debe seguir con el pie de foto si esto no funciona.
 */
export async function transcribeAudio(url: string): Promise<TranscriptResult | null> {
  const transcriber = activeTranscriber()
  if (!transcriber) return null
  try {
    return await transcriber.transcribe(url)
  } catch {
    return null
  }
}

export function transcriberEnabled(): boolean {
  return activeTranscriber() != null
}
