import { CityKindBar } from './CityKindBar.tsx'
import { CityPanel } from './CityPanel.tsx'
import { ConfirmDelete } from './ConfirmDelete.tsx'
import { FilterBar } from './FilterBar.tsx'
import { Importer } from './Importer.tsx'
import { MapView } from './MapView.tsx'
import { MemoryPanel } from './MemoryPanel.tsx'
import { PinTray } from './PinTray.tsx'
import { PlacePanel } from './PlacePanel.tsx'
import { CATEGORY_META } from '../lib/categories.ts'
import { CITY_KIND_META } from '../lib/city.ts'
import { haversineMeters, nearbyPlaces } from '../lib/geo.ts'
import { useCityLayer } from '../lib/useCityLayer.ts'
import type { CityKind, CityPoi, MapSelection } from '../types/city.ts'
import type { City, Memory, Place, PlaceCategory } from '../types/models.ts'
import { useMemo, useState } from 'react'

type MapScreenProps = {
  cityConfig: City
  citySlug: string
  places: Place[]
  placed: Memory[]
  pending: Memory[]
  urls: Record<string, string>
  busy: boolean
  initialPlaceId?: string
  initialMemoryId?: string
  initialShowCity?: boolean
  onBack: () => void
  onImportFiles: (files: FileList) => void
  onPinMemory: (id: string, lat: number, lng: number) => Promise<void>
  onCaption: (id: string, caption: string) => Promise<void>
  onDeleteMemory: (id: string) => Promise<void>
}

function isWideScreen(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
}

export function MapScreen({
  cityConfig,
  citySlug,
  places,
  placed,
  pending,
  urls,
  busy,
  initialPlaceId,
  initialMemoryId,
  initialShowCity = false,
  onBack,
  onImportFiles,
  onPinMemory,
  onCaption,
  onDeleteMemory,
}: MapScreenProps) {
  const [activeCategories, setActiveCategories] = useState<Set<PlaceCategory>>(new Set())
  const [activeCityKinds, setActiveCityKinds] = useState<Set<CityKind>>(new Set())
  const [showPlaces, setShowPlaces] = useState(!initialShowCity)
  const [showMemories, setShowMemories] = useState(true)
  const [showCity, setShowCity] = useState(initialShowCity)
  const [listOpen, setListOpen] = useState(isWideScreen)
  const [listQuery, setListQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Memory | null>(null)
  const [selectedCity, setSelectedCity] = useState<CityPoi | null>(null)
  const [selected, setSelected] = useState<MapSelection>(() => {
    if (initialMemoryId) return { type: 'memory', id: initialMemoryId }
    if (initialPlaceId) return { type: 'place', id: initialPlaceId }
    return null
  })
  const [pinningId, setPinningId] = useState<string | null>(null)
  const city = useCityLayer(showCity, activeCityKinds, citySlug)

  const counts = useMemo(() => {
    const next: Partial<Record<PlaceCategory, number>> = {}
    for (const place of places) {
      next[place.category] = (next[place.category] ?? 0) + 1
    }
    return next
  }, [places])

  const cityCounts = useMemo(() => {
    const next: Partial<Record<CityKind, number>> = {}
    for (const poi of city.all) {
      next[poi.kind] = (next[poi.kind] ?? 0) + 1
    }
    return next
  }, [city.all])

  const visiblePlaces = useMemo(() => {
    if (!showPlaces) return []
    const allOn = activeCategories.size === 0
    const needle = listQuery.trim().toLowerCase()
    return places.filter((place) => {
      if (!allOn && !activeCategories.has(place.category)) return false
      if (!needle) return true
      return (
        place.name.toLowerCase().includes(needle) ||
        (place.neighborhood ?? '').toLowerCase().includes(needle)
      )
    })
  }, [activeCategories, listQuery, places, showPlaces])

  const visibleCityPois = useMemo(() => {
    const needle = listQuery.trim().toLowerCase()
    if (!needle) return city.pois
    return city.pois.filter((poi) => poi.name.toLowerCase().includes(needle))
  }, [city.pois, listQuery])

  const visibleMemories = showMemories ? placed : []
  const selectedPlace = selected?.type === 'place' ? places.find((place) => place.id === selected.id) : undefined
  const selectedMemory = selected?.type === 'memory' ? placed.find((memory) => memory.id === selected.id) : undefined
  const selectedPoi =
    selected?.type === 'city'
      ? city.pois.find((poi) => poi.id === selected.id) ?? selectedCity
      : undefined

  const memoriesNearPlace = useMemo(() => {
    if (!selectedPlace) return []
    return placed.filter((memory) => {
      if (memory.lat == null || memory.lng == null) return false
      return haversineMeters(selectedPlace.location, { lat: memory.lat, lng: memory.lng }) <= 180
    })
  }, [placed, selectedPlace])

  const memoriesNearCity = useMemo(() => {
    if (!selectedPoi) return []
    return placed.filter((memory) => {
      if (memory.lat == null || memory.lng == null) return false
      return haversineMeters(selectedPoi.location, { lat: memory.lat, lng: memory.lng }) <= 180
    })
  }, [placed, selectedPoi])

  const placesNearMemory = useMemo(() => {
    if (!selectedMemory || selectedMemory.lat == null || selectedMemory.lng == null) return []
    const point = { lat: selectedMemory.lat, lng: selectedMemory.lng }
    return nearbyPlaces(point, places, 180).map((place) => ({
      place,
      distance: haversineMeters(point, place.location),
    }))
  }, [places, selectedMemory])

  function toggleCategory(category: PlaceCategory) {
    setActiveCategories((current) => {
      if (current.size === 0) return new Set([category])
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  function toggleCityKind(kind: CityKind) {
    setActiveCityKinds((current) => {
      if (current.size === 0) return new Set([kind])
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function select(next: MapSelection) {
    if (next?.type === 'city') {
      const poi = city.pois.find((item) => item.id === next.id) ?? selectedCity
      if (poi) setSelectedCity(poi)
    } else {
      setSelectedCity(null)
    }
    setSelected(next)
    if (next && !isWideScreen()) setListOpen(false)
  }

  function toggleCityLayer() {
    setShowCity((value) => {
      const next = !value
      if (!next && selected?.type === 'city') {
        setSelected(null)
        setSelectedCity(null)
      }
      return next
    })
  }

  async function handleMapClick(lat: number, lng: number) {
    const targetId = pinningId ?? pending[0]?.id
    if (targetId && pending.some((memory) => memory.id === targetId)) {
      await onPinMemory(targetId, lat, lng)
      setPinningId(null)
      select({ type: 'memory', id: targetId })
      return
    }
    setSelected(null)
    setSelectedCity(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    if (selected?.type === 'memory' && selected.id === id) setSelected(null)
    await onDeleteMemory(id)
  }

  const cityHint =
    !showCity
      ? null
      : city.status === 'zoom'
        ? 'Acerca el mapa para ver museos, fuentes, iglesias y esculturas.'
        : city.status === 'idle' || city.status === 'loading'
          ? 'Leyendo OpenStreetMap…'
          : city.status === 'error'
            ? city.error
            : city.status === 'ready' && city.pois.length === 0
              ? 'No hay puntos de ciudad en esta vista. Prueba otro recorte o quita un filtro.'
              : null

  return (
    <div className="map-shell">
      <div className="map-stage">
        <MapView
          city={cityConfig}
          places={visiblePlaces}
          memories={visibleMemories}
          cityPois={showCity ? visibleCityPois : []}
          memoryUrls={urls}
          selected={selected}
          focusPlaceId={selected?.type === 'place' ? selected.id : undefined}
          focusMemoryId={selected?.type === 'memory' ? selected.id : undefined}
          focusCityId={selected?.type === 'city' ? selected.id : undefined}
          preferCityStart={initialShowCity && !initialPlaceId && !initialMemoryId}
          pinning={pending.length > 0}
          onSelect={select}
          onMapClick={handleMapClick}
          onViewport={city.onViewport}
        />
      </div>

      <header className="map-topbar">
        <button type="button" className="btn-ghost text-sm" onClick={onBack}>
          ← Inicio
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-none text-ink">Roma</p>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            {places.length} lugares · {placed.length} recuerdos
            {showCity && city.status === 'ready' ? ` · ${city.pois.length} ciudad` : ''}
          </p>
        </div>
        <button
          type="button"
          className={`chip ${showPlaces ? 'chip-active' : ''}`}
          aria-pressed={showPlaces}
          onClick={() => setShowPlaces((value) => !value)}
        >
          Comida
        </button>
        <button
          type="button"
          className={`chip ${showMemories ? 'chip-active' : ''}`}
          aria-pressed={showMemories}
          onClick={() => setShowMemories((value) => !value)}
        >
          Recuerdos
        </button>
        <button type="button" className={`chip ${showCity ? 'chip-active' : ''}`} aria-pressed={showCity} onClick={toggleCityLayer}>
          Ciudad
        </button>
        <button
          type="button"
          className={`chip ${listOpen ? 'chip-active' : ''}`}
          aria-pressed={listOpen}
          onClick={() => setListOpen((value) => !value)}
        >
          Lista
        </button>
        <Importer busy={busy} onFiles={onImportFiles} label="Fotos" />
        {cityHint ? (
          <p className="map-city-hint" role="status">
            {cityHint}
          </p>
        ) : null}
      </header>

      {listOpen ? (
        <aside className="map-sidebar" aria-label="Lista de lugares">
          <label className="sr-only" htmlFor="map-search">
            Filtrar lista
          </label>
          <input
            id="map-search"
            className="search-input search-input--full"
            value={listQuery}
            onChange={(event) => setListQuery(event.target.value)}
            placeholder="Filtrar la lista…"
          />
          {showPlaces ? (
            <div className="mt-3">
              <FilterBar
                counts={counts}
                active={activeCategories}
                onToggle={toggleCategory}
                onShowAll={() => setActiveCategories(new Set())}
              />
            </div>
          ) : null}
          {showCity ? (
            <div className="mt-3">
              <CityKindBar
                counts={cityCounts}
                active={activeCityKinds}
                onToggle={toggleCityKind}
                onShowAll={() => setActiveCityKinds(new Set())}
              />
            </div>
          ) : null}
          {showPlaces ? (
            <ul className="mt-4 space-y-0.5">
              {visiblePlaces.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    className={`place-row ${selected?.type === 'place' && selected.id === place.id ? 'is-active' : ''}`}
                    onClick={() => select({ type: 'place', id: place.id })}
                  >
                    <span className="chip-dot" style={{ background: CATEGORY_META[place.category].color }} />
                    <span className="min-w-0 truncate">{place.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {showCity && visibleCityPois.length > 0 ? (
            <div className={showPlaces ? 'mt-5' : 'mt-4'}>
              <p className="kicker">Ciudad</p>
              <ul className="mt-2 space-y-0.5">
                {visibleCityPois.map((poi) => (
                  <li key={poi.id}>
                    <button
                      type="button"
                      className={`place-row ${selected?.type === 'city' && selected.id === poi.id ? 'is-active' : ''}`}
                      onClick={() => select({ type: 'city', id: poi.id })}
                    >
                      <span className="chip-dot" style={{ background: CITY_KIND_META[poi.kind].color }} />
                      <span className="min-w-0 truncate">{poi.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {visiblePlaces.length === 0 && visibleCityPois.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">
              {showCity && (city.status === 'idle' || city.status === 'loading')
                ? 'Cargando puntos de la ciudad…'
                : showCity && city.status === 'zoom'
                  ? 'Acerca el mapa para llenar la lista de la ciudad.'
                  : 'Nada coincide con esos filtros.'}
            </p>
          ) : null}
        </aside>
      ) : null}

      {selectedPlace ? (
        <div className="detail-sheet">
          <PlacePanel
            place={selectedPlace}
            nearbyMemories={memoriesNearPlace}
            memoryUrls={urls}
            onClose={() => setSelected(null)}
            onOpenMemory={(id) => select({ type: 'memory', id })}
          />
        </div>
      ) : null}

      {selectedPoi ? (
        <div className="detail-sheet">
          <CityPanel
            poi={selectedPoi}
            nearbyMemories={memoriesNearCity}
            memoryUrls={urls}
            onClose={() => {
              setSelected(null)
              setSelectedCity(null)
            }}
            onOpenMemory={(id) => select({ type: 'memory', id })}
          />
        </div>
      ) : null}

      {selectedMemory ? (
        <div className="detail-sheet">
          <MemoryPanel
            memory={selectedMemory}
            previewUrl={urls[selectedMemory.id]}
            nearbyPlaces={placesNearMemory}
            onClose={() => setSelected(null)}
            onOpenPlace={(id) => select({ type: 'place', id })}
            onDelete={() => setDeleteTarget(selectedMemory)}
            onCaption={(caption) => void onCaption(selectedMemory.id, caption)}
          />
        </div>
      ) : null}

      <div className="pin-tray-slot">
        <PinTray
          pending={pending}
          urls={urls}
          activeId={pinningId ?? pending[0]?.id ?? null}
          onSelect={setPinningId}
          onDelete={setDeleteTarget}
        />
      </div>

      <ConfirmDelete
        open={deleteTarget != null}
        title="¿Eliminar este recuerdo?"
        description="Se borra de este navegador: el archivo y su ancla en el mapa. No se puede deshacer."
        previewUrl={deleteTarget ? urls[deleteTarget.id] : undefined}
        previewAlt={deleteTarget?.caption || deleteTarget?.filename}
        isVideo={deleteTarget?.type === 'video'}
        confirmLabel="Eliminar recuerdo"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
