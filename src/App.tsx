import { HomeView } from './components/HomeView.tsx'
import { IngestView } from './components/IngestView.tsx'
import { MapScreen } from './components/MapScreen.tsx'
import { ROME, ROME_FOOD_COLLECTION } from './data/catalog.ts'
import { useMemories } from './lib/useMemories.ts'
import { usePlaces } from './lib/usePlaces.ts'
import { useMemo, useState } from 'react'

type Screen = 'home' | 'map' | 'ingest'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [mapPlaceId, setMapPlaceId] = useState<string | undefined>()
  const [mapMemoryId, setMapMemoryId] = useState<string | undefined>()
  const [mapShowCity, setMapShowCity] = useState(false)
  const { places, addPlaces } = usePlaces()
  const { memories, placed, pending, urls, busy, importFiles, pinMemory, setCaption, deleteMemory } = useMemories(
    ROME.id,
    ROME_FOOD_COLLECTION.id,
    places,
  )

  const existingNames = useMemo(
    () => new Set(places.map((place) => place.name.toLowerCase())),
    [places],
  )

  function openMap(placeId?: string, options?: { city?: boolean }) {
    setMapPlaceId(placeId)
    setMapMemoryId(undefined)
    setMapShowCity(options?.city ?? false)
    setScreen('map')
  }

  function openMemory(id: string) {
    setMapPlaceId(undefined)
    setMapMemoryId(id)
    setMapShowCity(false)
    setScreen('map')
  }

  if (screen === 'ingest') {
    return (
      <IngestView
        existingNames={existingNames}
        onBack={() => setScreen('home')}
        onImported={async (incoming) => {
          await addPlaces(incoming)
          if (incoming[0]) openMap(incoming[0].id)
          else setScreen('home')
        }}
      />
    )
  }

  if (screen === 'map') {
    return (
      <MapScreen
        key={`${mapPlaceId ?? ''}-${mapMemoryId ?? ''}-${mapShowCity ? 'city' : 'map'}`}
        places={places}
        placed={placed}
        pending={pending}
        urls={urls}
        busy={busy}
        initialPlaceId={mapPlaceId}
        initialMemoryId={mapMemoryId}
        initialShowCity={mapShowCity}
        onBack={() => setScreen('home')}
        onImportFiles={(files) => void importFiles(files)}
        onPinMemory={pinMemory}
        onCaption={setCaption}
        onDeleteMemory={deleteMemory}
      />
    )
  }

  return (
    <HomeView
      places={places}
      memories={memories}
      memoryUrls={urls}
      importBusy={busy}
      onOpenMap={openMap}
      onOpenIngest={() => setScreen('ingest')}
      onOpenMemory={openMemory}
      onImportFiles={(files) => void importFiles(files)}
      onDeleteMemory={deleteMemory}
    />
  )
}
