/**
 * Captura un fotograma del vídeo como miniatura JPEG (data URL) para usarlo de
 * póster en tarjetas y marcadores. Devuelve undefined si el navegador no puede
 * decodificar el vídeo. Nunca lanza.
 */
export function makeVideoPoster(file: File, maxWidth = 640): Promise<string | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = url

    let settled = false
    const finish = (value: string | undefined) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      resolve(value)
    }

    video.onloadeddata = () => {
      // Un poco dentro del vídeo para evitar un primer fotograma en negro.
      const target = video.duration && Number.isFinite(video.duration) ? Math.min(1, video.duration / 2) : 0
      try {
        video.currentTime = target
      } catch {
        finish(undefined)
      }
    }

    video.onseeked = () => {
      try {
        const w = video.videoWidth || maxWidth
        const h = video.videoHeight || Math.round(maxWidth * 0.5625)
        const scale = Math.min(1, maxWidth / w)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(w * scale))
        canvas.height = Math.max(1, Math.round(h * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(undefined)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        finish(undefined)
      }
    }

    video.onerror = () => finish(undefined)
    // Salvavidas: si algo se cuelga, no bloqueamos la importación.
    setTimeout(() => finish(undefined), 8000)
  })
}
