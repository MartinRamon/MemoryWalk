import { fetchCityPois } from './api.ts'
import { CITY_MIN_ZOOM } from './city.ts'
import type { CityKind, CityPoi, CityViewport } from '../types/city.ts'
import { useEffect, useMemo, useRef, useState } from 'react'

export type CityLayerStatus = 'idle' | 'loading' | 'ready' | 'zoom' | 'error'

function quantize(value: number): number {
  return Math.round(value / 0.004) * 0.004
}

function viewportKey(viewport: CityViewport): string {
  return [
    quantize(viewport.south),
    quantize(viewport.west),
    quantize(viewport.north),
    quantize(viewport.east),
    viewport.zoom < 15 ? 'sig' : 'all',
  ].join('|')
}

export function useCityLayer(enabled: boolean, kinds: Set<CityKind>) {
  const [viewport, setViewport] = useState<CityViewport | null>(null)
  const [pois, setPois] = useState<CityPoi[]>([])
  const [status, setStatus] = useState<CityLayerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const queryKey = viewport ? viewportKey(viewport) : ''

  useEffect(() => {
    if (!enabled) {
      setPois([])
      setStatus('idle')
      setError(null)
      return
    }
    const current = viewportRef.current
    if (!current) {
      setStatus('idle')
      return
    }
    if (current.zoom < CITY_MIN_ZOOM) {
      setPois([])
      setStatus('zoom')
      setError(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus((currentStatus) => (currentStatus === 'ready' ? currentStatus : 'loading'))
      void fetchCityPois(current, {
        significant: current.zoom < 15,
        signal: controller.signal,
      })
        .then((items) => {
          setPois(items)
          setStatus('ready')
          setError(null)
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return
          if (caught instanceof DOMException && caught.name === 'AbortError') return
          if (caught instanceof Error && caught.name === 'AbortError') return
          setStatus('error')
          setError(caught instanceof Error ? caught.message : 'No se pudo cargar la ciudad')
        })
    }, 420)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, queryKey])

  const visible = useMemo(() => {
    if (kinds.size === 0) return pois
    return pois.filter((poi) => kinds.has(poi.kind))
  }, [kinds, pois])

  return { all: pois, pois: visible, status, error, onViewport: setViewport, zoom: viewport?.zoom ?? 0 }
}
