import { CITY_KIND_META } from '../lib/city.ts'
import { CATEGORY_META } from '../lib/categories.ts'
import type { CityPoi, CityViewport, MapSelection } from '../types/city.ts'
import { isPlacedMemory, type City, type Memory, type Place } from '../types/models.ts'
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, addProtocol, removeProtocol } from 'maplibre-gl'
import type { MapMouseEvent, StyleSpecification } from 'maplibre-gl'
import { useEffect, useRef } from 'react'

type MapViewProps = {
  city: City
  places: Place[]
  memories: Memory[]
  cityPois: CityPoi[]
  memoryUrls: Record<string, string>
  selected: MapSelection
  focusPlaceId?: string
  focusMemoryId?: string
  focusCityId?: string
  preferCityStart?: boolean
  pinning: boolean
  onSelect: (selection: MapSelection) => void
  onMapClick: (lat: number, lng: number) => void
  onViewport: (viewport: CityViewport) => void
}

function ensureTileProtocol(): void {
  try {
    removeProtocol('mw')
  } catch {
    // Protocol may not exist yet.
  }
  addProtocol('mw', async (request, abortController) => {
    const url = request.url.replace(
      'mw://esri/',
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/',
    )
    const response = await fetch(url, { signal: abortController.signal })
    if (!response.ok) throw new Error(`tile ${response.status}`)
    return { data: await response.arrayBuffer() }
  })
}

function rasterStyle(): StyleSpecification {
  const tiles = ['mw://esri/{z}/{y}/{x}']

  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution: '© OpenStreetMap © Esri',
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  }
}

function clearMarkers(markers: Marker[]): void {
  for (const marker of markers) marker.remove()
  markers.length = 0
}

function readViewport(map: MapLibreMap): CityViewport {
  const bounds = map.getBounds()
  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
    zoom: map.getZoom(),
  }
}

function placeElement(place: Place, selected: boolean): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `map-pin${selected ? ' is-selected' : ''}`
  button.style.setProperty('--pin', CATEGORY_META[place.category].color)
  button.title = place.name
  button.innerHTML = `<span class="map-pin__dot"></span>`
  return button
}

function cityElement(poi: CityPoi, selected: boolean): HTMLButtonElement {
  const meta = CITY_KIND_META[poi.kind]
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `city-pin${selected ? ' is-selected' : ''}`
  button.style.setProperty('--pin', meta.color)
  button.title = `${poi.name} · ${meta.shortLabel}`
  button.innerHTML = `<span class="city-pin__mark">${meta.mark}</span>`
  return button
}

function memoryElement(memory: Memory, url: string | undefined, selected: boolean): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `memory-pin${selected ? ' is-selected' : ''}`
  button.title = memory.filename
  const thumb = memory.type === 'photo' ? url : memory.poster
  if (thumb) {
    const img = document.createElement('img')
    img.src = thumb
    img.alt = memory.caption || memory.filename
    button.append(img)
    if (memory.type === 'video') button.classList.add('is-video')
  } else {
    button.textContent = memory.type === 'video' ? '▶' : '●'
  }
  return button
}

export function MapView({
  city,
  places,
  memories,
  cityPois,
  memoryUrls,
  selected,
  focusPlaceId,
  focusMemoryId,
  focusCityId,
  preferCityStart,
  pinning,
  onSelect,
  onMapClick,
  onViewport,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const placeMarkers = useRef<Marker[]>([])
  const memoryMarkers = useRef<Marker[]>([])
  const cityMarkers = useRef<Marker[]>([])
  const onSelectRef = useRef(onSelect)
  const onMapClickRef = useRef(onMapClick)
  const onViewportRef = useRef(onViewport)
  const fitted = useRef(false)
  const flownCityId = useRef<string | undefined>(undefined)

  onSelectRef.current = onSelect
  onMapClickRef.current = onMapClick
  onViewportRef.current = onViewport

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    ensureTileProtocol()

    const map = new MapLibreMap({
      container: containerRef.current,
      style: rasterStyle(),
      center: [city.center.lng, city.center.lat],
      zoom: preferCityStart ? 14.6 : city.zoom,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.on('load', () => {
      map.resize()
      onViewportRef.current(readViewport(map))
    })
    map.on('moveend', () => onViewportRef.current(readViewport(map)))
    map.on('click', (event: MapMouseEvent) => {
      onMapClickRef.current(event.lngLat.lat, event.lngLat.lng)
    })
    mapRef.current = map

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      clearMarkers(placeMarkers.current)
      clearMarkers(memoryMarkers.current)
      clearMarkers(cityMarkers.current)
      map.remove()
      mapRef.current = null
    }
  }, [city, preferCityStart])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    clearMarkers(placeMarkers.current)
    for (const place of places) {
      const el = placeElement(place, selected?.type === 'place' && selected.id === place.id)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelectRef.current({ type: 'place', id: place.id })
      })
      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.location.lng, place.location.lat])
        .addTo(map)
      placeMarkers.current.push(marker)
    }

    if (!fitted.current && places.length > 0 && !focusPlaceId && !focusMemoryId && !preferCityStart) {
      const fit = () => {
        const bounds = new LngLatBounds()
        for (const place of places) bounds.extend([place.location.lng, place.location.lat])
        map.fitBounds(bounds, { padding: 80, maxZoom: 13.4, duration: 800 })
        fitted.current = true
      }
      if (map.loaded()) fit()
      else map.once('load', fit)
    }
    if (preferCityStart) fitted.current = true
  }, [focusMemoryId, focusPlaceId, places, preferCityStart, selected])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusPlaceId) return
    const place = places.find((item) => item.id === focusPlaceId)
    if (!place) return
    const fly = () => {
      map.flyTo({ center: [place.location.lng, place.location.lat], zoom: 15, duration: 800 })
      fitted.current = true
    }
    if (map.loaded()) fly()
    else map.once('load', fly)
  }, [focusPlaceId, places])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusMemoryId) return
    const memory = memories.find((item) => item.id === focusMemoryId)
    if (!memory || !isPlacedMemory(memory)) return
    const fly = () => {
      map.flyTo({ center: [memory.lng, memory.lat], zoom: 16, duration: 800 })
      fitted.current = true
    }
    if (map.loaded()) fly()
    else map.once('load', fly)
  }, [focusMemoryId, memories])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusCityId) {
      flownCityId.current = undefined
      return
    }
    if (flownCityId.current === focusCityId) return
    const poi = cityPois.find((item) => item.id === focusCityId)
    if (!poi) return
    flownCityId.current = focusCityId
    const fly = () => {
      map.flyTo({ center: [poi.location.lng, poi.location.lat], zoom: Math.max(map.getZoom(), 15.2), duration: 700 })
      fitted.current = true
    }
    if (map.loaded()) fly()
    else map.once('load', fly)
  }, [cityPois, focusCityId])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    clearMarkers(memoryMarkers.current)
    for (const memory of memories) {
      if (!isPlacedMemory(memory)) continue
      const el = memoryElement(memory, memoryUrls[memory.id], selected?.type === 'memory' && selected.id === memory.id)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelectRef.current({ type: 'memory', id: memory.id })
      })
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([memory.lng, memory.lat])
        .addTo(map)
      memoryMarkers.current.push(marker)
    }
  }, [memories, memoryUrls, selected])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    clearMarkers(cityMarkers.current)
    for (const poi of cityPois) {
      const el = cityElement(poi, selected?.type === 'city' && selected.id === poi.id)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelectRef.current({ type: 'city', id: poi.id })
      })
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([poi.location.lng, poi.location.lat])
        .addTo(map)
      cityMarkers.current.push(marker)
    }
  }, [cityPois, selected])

  useEffect(() => {
    mapRef.current?.getCanvas().classList.toggle('is-pinning', pinning)
  }, [pinning])

  return (
    <div className="absolute inset-0 bg-[#d9e2d6]">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
