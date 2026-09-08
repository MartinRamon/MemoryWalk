"""MemoryWalk STT sidecar — transcribe el audio de un TikTok/Reel con faster-whisper.

Descarga solo el audio con yt-dlp y lo transcribe. El backend Node habla con este
servicio por HTTP en localhost. Es opcional: si no está en marcha, MemoryWalk sigue
funcionando leyendo el pie de foto.

Arranque:
    python sidecar/transcribe.py
    # o: uvicorn transcribe:app --host 127.0.0.1 --port 8788
"""

from __future__ import annotations

import glob
import os
import tempfile
from urllib.parse import urlparse

import uvicorn
import yt_dlp
from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
MAX_DURATION_S = int(os.environ.get("MAX_DURATION_S", "600"))
PORT = int(os.environ.get("STT_PORT", "8788"))

# Solo estas plataformas: evita usar el sidecar como descargador genérico.
ALLOWED_HOSTS = ("tiktok.com", "instagram.com", "instagr.am")

app = FastAPI(title="memorywalk-stt")
# El modelo se carga una vez al arrancar (cargarlo por petición sería lentísimo).
model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE)


class TranscribeRequest(BaseModel):
    url: str


def host_allowed(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS)


def download_audio(url: str, out_dir: str) -> str:
    opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(out_dir, "audio.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 2,
    }
    # Para Reels que exigen login: YTDLP_COOKIES_FROM_BROWSER=chrome (o firefox, edge…).
    browser = os.environ.get("YTDLP_COOKIES_FROM_BROWSER")
    if browser:
        opts["cookiesfrombrowser"] = (browser,)

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        duration = info.get("duration") or 0
        if duration and duration > MAX_DURATION_S:
            raise HTTPException(status_code=413, detail="El vídeo es demasiado largo para transcribir.")
        ydl.download([url])

    files = glob.glob(os.path.join(out_dir, "audio.*"))
    if not files:
        raise HTTPException(status_code=502, detail="No se pudo descargar el audio del vídeo.")
    return files[0]


def transcribe_file(path: str) -> dict:
    # vad_filter recorta silencios/música: reduce las alucinaciones típicas de Whisper.
    segments, info = model.transcribe(path, vad_filter=True)
    parts: list[str] = []
    no_speech_probs: list[float] = []
    for seg in segments:
        parts.append(seg.text)
        no_speech_probs.append(float(getattr(seg, "no_speech_prob", 0.0) or 0.0))

    text = " ".join(part.strip() for part in parts).strip()
    avg_no_speech = sum(no_speech_probs) / len(no_speech_probs) if no_speech_probs else 1.0
    no_speech = (not text) or avg_no_speech > 0.6
    return {"text": text, "language": info.language, "no_speech": no_speech}


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": MODEL_NAME}


@app.post("/transcribe")
def transcribe(req: TranscribeRequest) -> dict:
    if not host_allowed(req.url):
        raise HTTPException(status_code=400, detail="Solo se admiten enlaces de TikTok o Instagram.")
    try:
        with tempfile.TemporaryDirectory(prefix="memorywalk-stt-") as tmp:
            audio_path = download_audio(req.url, tmp)
            return transcribe_file(audio_path)
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001 - cualquier fallo => 502, el backend cae al caption
        raise HTTPException(status_code=502, detail=f"No se pudo transcribir: {error}") from error


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
