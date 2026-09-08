// Service worker de MemoryWalk — app-shell offline + caché acotada de teselas.
// Hecho a mano (sin Workbox) para no depender de plugins atados a la versión de Vite.

const VERSION = 'v1'
const SHELL = `mw-shell-${VERSION}`
const ASSETS = `mw-assets-${VERSION}`
const TILES = `mw-tiles-${VERSION}`
const TILE_MAX = 500

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS, TILES])
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('mw-') && !keep.has(name)).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

function isTileHost(url) {
  return url.hostname === 'server.arcgisonline.com'
}

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i += 1) {
    await cache.delete(keys[i])
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Navegaciones (SPA): servimos el app-shell cacheado y lo refrescamos en segundo
  // plano. Así funciona offline y no depende de reescritura del host estático.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL)
        const cached = await cache.match('/index.html')
        const network = fetch('/index.html')
          .then((res) => {
            if (res.ok) cache.put('/index.html', res.clone())
            return res
          })
          .catch(() => cached)
        return cached || network
      })(),
    )
    return
  }

  // Teselas del mapa: cache-first con tope de entradas.
  if (isTileHost(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILES)
        const hit = await cache.match(request)
        if (hit) return hit
        try {
          const res = await fetch(request)
          if (res.ok) {
            await cache.put(request, res.clone())
            void trimCache(TILES, TILE_MAX)
          }
          return res
        } catch {
          return hit || Response.error()
        }
      })(),
    )
    return
  }

  // La API no se cachea (datos dinámicos).
  if (url.pathname.startsWith('/api')) return

  // Recursos propios (JS/CSS/SVG/fuentes): stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS)
        const hit = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || network
      })(),
    )
  }
})
