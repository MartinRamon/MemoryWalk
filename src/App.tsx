import { HomeView } from './components/HomeView.tsx'
import { IngestView } from './components/IngestView.tsx'
import { MapScreen } from './components/MapScreen.tsx'
import { ROME, ROME_FOOD_COLLECTION } from './data/catalog.ts'
import {
  cityLayerPath,
  homePath,
  ingestPath,
  isKnownCity,
  mapPath,
  memoryPath,
  placePath,
} from './lib/routes.ts'
import { useMemories } from './lib/useMemories.ts'
import { usePlaces } from './lib/usePlaces.ts'
import type { Memory, Place } from './types/models.ts'
import { useCallback, useEffect, useMemo } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

function useTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}

type MapProps = {
  places: Place[]
  placed: Memory[]
  pending: Memory[]
  urls: Record<string, string>
  busy: boolean
  onImportFiles: (files: FileList) => void
  onPinMemory: (id: string, lat: number, lng: number) => Promise<void>
  onCaption: (id: string, caption: string) => Promise<void>
  onDeleteMemory: (id: string) => Promise<void>
}

type HomeProps = {
  places: Place[]
  memories: Memory[]
  urls: Record<string, string>
  busy: boolean
  memoriesLoading: boolean
  onImportFiles: (files: FileList) => void
  onDeleteMemory: (id: string) => Promise<void>
}

type IngestProps = {
  existingNames: Set<string>
  addPlaces: (incoming: Place[]) => Promise<void>
}

function HomeRoute(props: HomeProps) {
  const { city } = useParams()
  const navigate = useNavigate()
  useTitle('MemoryWalk — Roma')
  if (!isKnownCity(city)) return <Navigate to={homePath()} replace />
  return (
    <HomeView
      places={props.places}
      memories={props.memories}
      memoryUrls={props.urls}
      importBusy={props.busy}
      memoriesLoading={props.memoriesLoading}
      onOpenMap={(placeId, options) =>
        navigate(placeId ? placePath(placeId, city) : options?.city ? cityLayerPath(city) : mapPath(city))
      }
      onOpenIngest={() => navigate(ingestPath(city))}
      onOpenMemory={(id) => navigate(memoryPath(id, city))}
      onImportFiles={props.onImportFiles}
      onDeleteMemory={props.onDeleteMemory}
    />
  )
}

function MapRoute(props: MapProps & { initialShowCity?: boolean }) {
  const { city, placeId, memoryId } = useParams()
  const navigate = useNavigate()
  useTitle('Mapa — Roma')
  if (!isKnownCity(city)) return <Navigate to={homePath()} replace />
  return (
    <MapScreen
      key={`${placeId ?? ''}-${memoryId ?? ''}-${props.initialShowCity ? 'city' : 'map'}`}
      places={props.places}
      placed={props.placed}
      pending={props.pending}
      urls={props.urls}
      busy={props.busy}
      initialPlaceId={placeId}
      initialMemoryId={memoryId}
      initialShowCity={props.initialShowCity ?? false}
      onBack={() => navigate(homePath(city))}
      onImportFiles={props.onImportFiles}
      onPinMemory={props.onPinMemory}
      onCaption={props.onCaption}
      onDeleteMemory={props.onDeleteMemory}
    />
  )
}

function IngestRoute(props: IngestProps) {
  const { city } = useParams()
  const navigate = useNavigate()
  useTitle('Añadir — Roma')
  if (!isKnownCity(city)) return <Navigate to={homePath()} replace />
  return (
    <IngestView
      existingNames={props.existingNames}
      onBack={() => navigate(homePath(city))}
      onImported={async (incoming) => {
        await props.addPlaces(incoming)
        navigate(incoming[0] ? placePath(incoming[0].id, city) : homePath(city))
      }}
    />
  )
}

export default function App() {
  const { places, addPlaces } = usePlaces()
  const {
    memories,
    placed,
    pending,
    urls,
    busy,
    loading: memoriesLoading,
    importFiles,
    pinMemory,
    setCaption,
    deleteMemory,
  } = useMemories(ROME.id, ROME_FOOD_COLLECTION.id, places)

  const existingNames = useMemo(() => new Set(places.map((place) => place.name.toLowerCase())), [places])
  const onImportFiles = useCallback((files: FileList) => void importFiles(files), [importFiles])

  const mapProps: MapProps = {
    places,
    placed,
    pending,
    urls,
    busy,
    onImportFiles,
    onPinMemory: pinMemory,
    onCaption: setCaption,
    onDeleteMemory: deleteMemory,
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homePath()} replace />} />
      <Route
        path="/:city"
        element={
          <HomeRoute
            places={places}
            memories={memories}
            urls={urls}
            busy={busy}
            memoriesLoading={memoriesLoading}
            onImportFiles={onImportFiles}
            onDeleteMemory={deleteMemory}
          />
        }
      />
      <Route path="/:city/anadir" element={<IngestRoute existingNames={existingNames} addPlaces={addPlaces} />} />
      <Route path="/:city/mapa" element={<MapRoute {...mapProps} />} />
      <Route path="/:city/ciudad" element={<MapRoute {...mapProps} initialShowCity />} />
      <Route path="/:city/lugar/:placeId" element={<MapRoute {...mapProps} />} />
      <Route path="/:city/recuerdo/:memoryId" element={<MapRoute {...mapProps} />} />
      <Route path="*" element={<Navigate to={homePath()} replace />} />
    </Routes>
  )
}
