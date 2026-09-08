# Viaj — arquitectura, sistemas y hoja de ruta

Viaj es una guía personal de turismo: recomendaciones (restaurantes, mercados), capa de ciudad (museos, fuentes, iglesias, esculturas) y recuerdos (fotos y vídeos geolocalizados) sobre un mapa. La ciudad piloto es Roma.

Uso actual: **una sola persona**. La UI sigue en el navegador (Dexie + OPFS); un **backend mínimo en Node** geocodifica, resuelve links de Maps, lee TikTok/Reels y sirve la capa OSM + fichas de Wikipedia. El modelo de datos ya lleva `userId` y `collectionId` para poder pasar a producto (cuentas, sync, colecciones compartidas) sin reescribir el mapa.

---

## 1. Qué hay hoy

Tres pantallas, sin router:

| Pantalla | Función |
| --- | --- |
| **Inicio** | Menú de tarjetas por categoría, buscador, recuerdos y accesos a mapa / ciudad / ingesta / fotos |
| **Mapa** | Lista + mapa MapLibre + ficha de lugar, recuerdo o punto OSM |
| **Ingestor** | Pegar un TikTok/Reel (o texto WhatsApp) → borrador editable → confirmar y pintar |

Capas en el mapa:

- **Comida / corpus**: lugares del JSON de Roma más los importados en local
- **Recuerdos**: fotos y vídeos anclados por EXIF o a mano
- **Ciudad**: museos, fuentes, iglesias y esculturas vía Overpass (zoom ≥ 14)

No se scrapean reseñas de Google (ToS). Las notas salen del corpus, del pie de foto del enlace, o de lo que editas en el borrador.

---

## 2. Stack

| Pieza | Tecnología | Para qué |
| --- | --- | --- |
| UI | React 19 + TypeScript | SPA |
| Bundler | Vite 8 | Dev server, build, proxies |
| Estilos | Tailwind 4 | Tema tipo guía (papel / tinta / terracota) |
| Mapa | MapLibre GL JS | Raster de calles + marcadores HTML |
| Teselas | Esri World Street Map | Calles sin API key; se cargan con `fetch` + `addProtocol` |
| Metadatos de fotos | `exifr` | GPS y fecha EXIF |
| Persistencia local | Dexie (IndexedDB) + OPFS | Recuerdos y lugares importados |
| Geocodificación | Nominatim vía `server/` | Coordenadas en el bbox de Roma |
| Lectura de enlaces | oEmbed / HTML (TikTok, Reels, Maps, web) | Caption y, si hay, coords de Maps |
| Extracción de local | xAI Grok (`XAI_API_KEY`) o heurístico | Nombre, nota, plato, categoría |
| Capa ciudad | OSM Overpass + Wikipedia/Wikidata | Museos, fuentes, iglesias, esculturas y snippet |
| API local | Node `server/index.ts` (`:8787`) | `/api/health`, `/api/geocode`, `/api/ingest/url`, `/api/city`, `/api/wiki` |
| Ingesta batch del corpus | `tsx scripts/ingest-rome.ts` | Genera `rome-places.json` |

Decisiones:

- **Sin Google Maps SDK** en v1 (coste y ToS). Maps solo como enlace en la ficha.
- **MapLibre fuera de `optimizeDeps`** de Vite: el worker empaquetado rompía las teselas.
- Teselas por **protocolo custom (`viaj://`)** y `fetch`: el `<img>` nativo a veces llega vacío; el arrayBuffer no.

---

## 3. Arquitectura

```
                    ┌─────────────────────────────────┐
                    │           App.tsx               │
                    │   screen: home | map | ingest   │
                    └───────────┬─────────────────────┘
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
     HomeView              MapScreen             IngestView
          │                     │                     │
          │              MapView (MapLibre)           │
          │                     │                     │
   usePlaces()            usePlaces()          POST /api/ingest/url
   useMemories()          useCityLayer()       GET /api/city + /api/wiki
                          useMemories()        borrador editable
          │                     │                     │
          └──────────┬──────────┘                     │
                     ▼                                ▼
              Dexie + OPFS                      putLocalPlaces()
                     ▲                                ▲
                     │                                │
   rome-places.json ─┘                    server/ (Nominatim, Grok)
```

### Flujo de datos

**Corpus (curado, en el repo)**

1. Texto de recomendaciones + links `maps.app.goo.gl` → `scripts/rome-source.json`
2. `npm run ingest` intenta resolver el short link y, si falla, Nominatim
3. Escribe `src/data/rome-places.json`
4. La app lo importa como lugares `origin: corpus` (implícito)

**Ingesta en caliente (enlace → borrador → mapa)**

1. El usuario pega un TikTok, Reel o link de Maps
2. El backend lee el pie de foto (oEmbed/HTML) y Grok (o un heurístico) propone nombre, nota, plato y categoría
3. Nominatim sitúa el local en el bbox de Roma
4. La UI muestra un **borrador editable** (nombre y descripción)
5. Al confirmar, se geocodifica otra vez con el nombre corregido y se guarda en IndexedDB (`origin: 'ingest'`, `sourceUrl`)
6. `usePlaces` une corpus + locales

El pegado de texto WhatsApp sigue como camino secundario (`parseRecommendations`).

**Recuerdos**

1. El usuario elige fotos/vídeos
2. `exifr` lee GPS y `DateTimeOriginal`
3. Metadatos → IndexedDB; binario → OPFS (si no hay OPFS, el blob va en Dexie)
4. Con GPS: marcador en el mapa y cruce a lugares a ≤ 180 m
5. Sin GPS (WhatsApp/Telegram suelen borrarlo): bandeja “pulsa el mapa para anclar”

### Contrato de almacenamiento

Misma forma mental para el día que haya nube:

| Recurso | Hoy | Mañana |
| --- | --- | --- |
| Lugares curados | JSON en git | Postgres (o similar) |
| Lugares importados | Dexie `places` | misma tabla, con `userId` real |
| Recuerdos (meta) | Dexie `memories` | DB |
| Recuerdos (archivo) | OPFS / blob IndexedDB | S3 u object storage |

`userId` vale `'me'` en v1.

---

## 4. Modelo de datos

Definido en [`src/types/models.ts`](src/types/models.ts).

- **City** — id, nombre, centro, zoom. Ahora solo `rome`.
- **Collection** — agrupación (`rome-food`). Lista para compartir.
- **Place** — nombre, categoría, nota, `mapsUrl`, `sourceUrl`, `location`, barrio, tags, platos, precio, origen (`corpus` / `ingest`).
- **Memory** — foto o vídeo, lat/lng opcional, `takenAt`, `placeId` opcional, `hasGps`.
- **CityPoi** — punto OSM en vivo (`osm/node|way|relation/id`), `kind` (museo / fuente / iglesia / escultura), nombre, coords, tags `wikipedia` / `wikidata`. No se guarda en Dexie.

Categorías: `trattoria`, `pizza`, `street_food`, `gelato`, `vegan`, `seafood`, `michelin`, `market`, `attraction`.

---

## 5. Sistemas

### 5.1 Navegación

No hay React Router. `App` guarda `screen` y un posible `placeId` / `memoryId` para abrir el mapa centrado en un elemento. Suficiente para una SPA de tres vistas; un router entra cuando haya URLs compartibles (`/roma`, `/roma/felice-a-testaccio`).

### 5.2 Mapa

[`src/components/MapView.tsx`](src/components/MapView.tsx):

- Estilo raster MapLibre (sin estilo vectorial de OpenFreeMap: dependía de un worker que Vite no resolvía bien).
- Protocolo `viaj://esri/{z}/{y}/{x}` → `fetch` a Esri World Street Map.
- Marcadores HTML: pin de color por categoría; recuerdos como miniatura circular; ciudad como cuadrado con letra (M/F/I/E).
- `fitBounds` al corpus, o `flyTo` si se llega desde una tarjeta o un punto OSM.
- Toggle **Comida / Recuerdos / Ciudad**. Ciudad pide Overpass al mover el mapa (debounce ~420 ms).

El proxy `/tiles` de Carto se eliminó: el mapa usa Esri vía `viaj://`.

### 5.3 Ingestor

Tres caminos:

| | Batch (repo) | Enlace (app) | Texto (app) |
| --- | --- | --- | --- |
| Entrada | `scripts/rome-source.json` | TikTok / Reel / Maps / web | textarea WhatsApp |
| Parser | datos ya estructurados | `server/extract.ts` + Grok | [`parseRecommendations.ts`](src/lib/parseRecommendations.ts) |
| Geo | script Node + Nominatim | `POST /api/geocode` | igual |
| Salida | `rome-places.json` | Dexie `places` tras confirmar | Dexie `places` |

El usuario **siempre confirma** el borrador. Nominatim se limita al bbox de Roma (~41.78–42.0 N, 12.38–12.62 E) y se llama a ~1 req/s. Instagram a veces no deja leer el caption (login wall); TikTok oEmbed es el camino más estable.

### 5.4 Recuerdos

[`src/lib/useMemories.ts`](src/lib/useMemories.ts) + [`storage.ts`](src/lib/storage.ts) + [`exif.ts`](src/lib/exif.ts).

- Object URLs para previsualizar; se revocan al salir.
- `placeId` se rellena si hay un lugar a menos de 180 m ([`geo.ts`](src/lib/geo.ts), haversine).
- El GPS en **vídeo** es poco fiable (iOS y apps de chat lo quitan). Hoy: ancla manual.

### 5.5 Backend mínimo

[`server/index.ts`](server/index.ts), puerto `8787`. Vite proxy `/api` → ese servidor.

| Ruta | Función |
| --- | --- |
| `GET /api/health` | Estado y si hay clave Grok |
| `GET/POST /api/geocode` | Nominatim con User-Agent, bbox Roma |
| `GET /api/city` | Overpass recortado al viewport (Roma, span ≤ 0.1°) |
| `GET /api/wiki` | Extracto Wikipedia/Wikidata (prefiere `es`) |
| `POST /api/ingest/url` | Lee el enlace y devuelve un borrador |

Clave opcional: `XAI_API_KEY` en `.env` (ver `.env.example`). Sin ella, la extracción del nombre es heurística.

`npm run dev` levanta UI y API. En producción la SPA debe hablar con el mismo origen `/api` o un reverse proxy.

### 5.6 Capa Ciudad (OSM)

[`server/overpass.ts`](server/overpass.ts) + [`src/lib/useCityLayer.ts`](src/lib/useCityLayer.ts).

- Consulta Overpass (`overpass-api.de`, fallback `kumi.systems`) para `tourism=museum`, fuentes, culto cristiano / basílicas, `artwork` escultórico y memoriales.
- Solo viewport ∩ bbox de Roma. Zoom mínimo **14**. En 14–15 solo puntos con Wikipedia/Wikidata o museos (para no saturar). A partir de 15, todos los nombrados (tope 180).
- Caché en memoria ~12 min. Los POI no se persisten: cada sesión los vuelve a pedir.
- Al abrir la ficha, [`server/wiki.ts`](server/wiki.ts) resuelve el snippet (Wikidata sitelinks, luego tag `wikipedia`). Prefiere artículo en español.

---

## 6. Estructura del repo

```
src/
  App.tsx                 Pantallas
  types/models.ts         City, Place, Memory, Collection
  types/ingest.ts         Borrador de URL
  types/city.ts           CityPoi, WikiSnippet, MapSelection
  lib/
    api.ts                Cliente /api
    city.ts               Metadatos de tipo ciudad
    useCityLayer.ts       Viewport → Overpass
    storage.ts            Dexie + OPFS
    usePlaces.ts
    useMemories.ts
    parseRecommendations.ts
    geocode.ts
    exif.ts
    geo.ts
    categories.ts
  components/
    HomeView.tsx
    MapScreen.tsx / MapView.tsx
    IngestView.tsx
    PlaceCard.tsx / PlacePanel.tsx / CityPanel.tsx
    MemoryPanel.tsx / PinTray.tsx / Importer.tsx
server/
  index.ts                API :8787
  extract.ts              TikTok / Reels / Maps / web
  llm.ts                  Grok + heurístico
  geo.ts                  Nominatim + short links de Maps
  overpass.ts             Capa ciudad OSM
  wiki.ts                 Snippets Wikipedia/Wikidata
scripts/
  rome-source.json        Fuente humana del corpus
  ingest-rome.ts          Geocodificación batch
```

---

## 7. Cómo ejecutarlo

```bash
npm install
npm run ingest         # solo si cambias el corpus
npm run dev            # UI :5173 + API :8787
```

Copia `.env.example` a `.env` y pon `XAI_API_KEY` si quieres extracción con Grok. Sin clave, se usa un heurístico sobre el pie de foto.

Los recuerdos y los lugares pegados viven en **este navegador**. Borrar datos del sitio los elimina.

---

## 8. Hoja de ruta

### Hecho (fases 0–1 + menú)

- Scaffold Vite / React / TS / Tailwind / MapLibre
- Corpus de Roma (33 lugares) con coordenadas
- Inicio con tarjetas y buscador
- Mapa con calles, filtros, lista y fichas
- Recuerdos locales (EXIF, ancla manual, OPFS/IndexedDB)
- Ingestor de texto en la app
- Backend mínimo: geocode, TikTok/Reels, borrador editable
- Cruce recuerdo ↔ lugar cercano (180 m)
- Capa Ciudad OSM (museos, fuentes, iglesias, esculturas) + fichas Wikipedia

### Fase 2 — Ciudad (hecho)

- Capa OSM Overpass: museos, fuentes, iglesias, esculturas (zoom ≥ 14)
- Toggle Comida / Recuerdos / Ciudad
- Fichas con snippet de Wikipedia/Wikidata cuando exista

### Fase 3 — Inmersivo

- **Memory Walk**: animar un recorrido; las fotos aparecen al acercarte
- Edificios 3D en MapLibre
- Matching más rico foto–lugar (no solo radio)
- Vídeo: poster + ancla; heredar GPS de fotos del mismo intervalo de tiempo

### Fase 4 — Producto

- Cuentas (p. ej. Clerk o similar)
- Sync: mismo esquema Place/Memory, adaptador S3 + Postgres
- Colecciones compartidas (“Roma de María”)
- Multi-ciudad
- PWA offline para el viaje
- URLs estables por ciudad y lugar

### Ideas aparcadas (útiles, no bloqueantes)

- Rutas a pie por barrio (Testaccio, Trastevere, Prati)
- Filtro por momento del día (almuerzo en mercado)
- “Entonces y ahora” si un día hay Street View
- Street View de Google: de pago y con restricciones
- AR con cámara: nativo (Capacitor), no web

### Fuera de alcance a propósito

- Red social, feed en tiempo real, perfiles públicos
- Scraping de reseñas de Google

---

## 9. Riesgos y límites

- **Teselas**: Esri World Street Map vale para uso personal ligero; un producto con tráfico debería tener proveedor propio (MapTiler, MapLibre + teselas propias).
- **Nominatim**: 1 pet/s, User-Agent obligatorio; no sirve como API de producción sin instancia propia o un geocoder comercial.
- **Overpass / Wikipedia**: públicos y con cupo. La caché y el zoom mínimo evitan saturar; un producto debería tener instancia Overpass propia.
- **Privacidad**: fotos y vídeos no salen del dispositivo. El salto a sync exige cifrado en tránsito y control de quién ve cada colección.
- **GPS**: muchas fotos de mensajería llegan sin EXIF. El ancla manual es el camino realista.
- **Un solo navegador**: no hay backup salvo el que haga el usuario (o git, para el corpus JSON).
