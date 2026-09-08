# MemoryWalk STT sidecar

Transcribe el audio de un TikTok o Reel de Instagram y se lo devuelve al backend de
MemoryWalk. El flujo es: `yt-dlp` descarga solo el audio → `faster-whisper` lo transcribe.

Es **opcional**. Si este servicio no está en marcha, MemoryWalk sigue funcionando leyendo el
pie de foto del enlace (el backend cae a ese modo automáticamente).

## Requisitos

- Python 3.10+
- **ffmpeg** en el PATH (recomendado; yt-dlp y la decodificación de audio lo usan).
  - Windows: `winget install Gyan.FFmpeg` o `choco install ffmpeg`
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

## Instalación

```bash
cd sidecar
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
```

La primera transcripción descarga los pesos del modelo (`base` ≈ 150 MB).

## Arranque

```bash
python transcribe.py
# escucha en http://127.0.0.1:8788
```

El backend Node lo busca en `TRANSCRIBER_URL` (por defecto `http://127.0.0.1:8788`).

## Configuración (variables de entorno)

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `WHISPER_MODEL` | `base` | `tiny` / `base` / `small` / `medium` / `large-v3`. Más grande = mejor y más lento. |
| `WHISPER_DEVICE` | `cpu` | `cuda` si tienes GPU NVIDIA. |
| `WHISPER_COMPUTE` | `int8` | `int8` (CPU), `float16` (GPU). |
| `MAX_DURATION_S` | `600` | Rechaza vídeos más largos (acota tiempo y coste). |
| `STT_PORT` | `8788` | Puerto del sidecar. |
| `YTDLP_COOKIES_FROM_BROWSER` | — | Para Reels que exigen login: `chrome`, `firefox`, `edge`… Usa las cookies de ese navegador. |

## Prueba rápida

```bash
curl -s -X POST http://127.0.0.1:8788/transcribe \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.tiktok.com/@user/video/123"}'
```

Devuelve `{ "text": "...", "language": "es", "no_speech": false }`.
Cuando `no_speech` es `true` (música o silencio), el backend ignora el transcript.

## Notas

- Solo acepta enlaces de TikTok e Instagram (validado por host).
- Descargar audio va contra los ToS de las plataformas: úsalo para tu contenido/uso
  personal. yt-dlp puede romperse cuando las plataformas cambian; mantenlo actualizado
  con `pip install -U yt-dlp`.
