# Viaj

Guía personal de turismo: recomendaciones y recuerdos sobre un mapa. Empieza en Roma.

Documentación de arquitectura, sistemas y hoja de ruta: [ARCHITECTURE.md](ARCHITECTURE.md).

```bash
npm install
npm run ingest
npm run dev
```

`npm run dev` levanta la UI (`http://localhost:5173`) y la API (`http://127.0.0.1:8787`).

Copia `.env.example` a `.env` y pon `XAI_API_KEY` si quieres que Grok extraiga el local a partir de un TikTok o Reel. Sin clave, se usa un heurístico sobre el pie de foto.

`npm run ingest` geocodifica el corpus (`scripts/rome-source.json`) y escribe `src/data/rome-places.json`.
