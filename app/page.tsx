"use client"

import { useState, useCallback, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { MapPanel } from "@/components/map-panel"
import { MapCanvas } from "@/components/map-canvas"
import { MapboxCanvas } from "@/components/mapbox-canvas"
import type { MapReadyPhase } from "@/components/mapbox-canvas"
import { EventPopup } from "@/components/event-popup"
import { StationPopup } from "@/components/station-popup"
import { LandmarkParticlesOverlay } from "@/components/landmark-particles-overlay"
import { getEventsInBounds } from "@/lib/services/events"
import type { ObservationEvent } from "@/types/event"
import { METRO_STATIONS, METRO_STORIES } from "@/lib/metro-data"
import { cn, coordKey, filterEventsInBounds, groupEventsByCoords } from "@/lib/utils"
import { CDMX_BOUNDS, CDMX_DEFAULT_ZOOM } from "@/lib/map-bounds"
import { DEFAULT_MAP_CONFIG } from "@/lib/map-config"

const DEFAULT_FILTERS = {
  type: "all",
  intensity: "all",
  showDensity: false,
  showMetroLines: false,
  showAllLayers: false,
  dateFrom: "",
  dateTo: "",
}

function EtherealLoader({ fullscreen = false, fading = false }: { fullscreen?: boolean; fading?: boolean }) {
  return (
    <div
      className={cn(
        fullscreen ? "h-screen w-screen" : "absolute inset-0",
        "z-20 flex items-center justify-center pointer-events-none",
        fading && "ethereal-loader-fade-out"
      )}
    >
      <div className="ethereal-loader-backdrop" aria-hidden />
      <div className="ethereal-loader-panel" role="status" aria-live="polite" aria-label="Cargando mapa y eventos">
        <div className="ethereal-loader-orb" />
        <div className="ethereal-loader-ring ethereal-loader-ring--a" />
        <div className="ethereal-loader-ring ethereal-loader-ring--b" />
        <p className="mt-4 font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--parchment-dim)]">
          Trazando mapa ritual...
        </p>
      </div>
    </div>
  )
}

function MapaDeObservacionesContent() {
  const hasMapboxToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const searchParams = useSearchParams()
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [zoom, setZoom] = useState(CDMX_DEFAULT_ZOOM)
  const [mapConfig, setMapConfig] = useState<typeof DEFAULT_MAP_CONFIG>(DEFAULT_MAP_CONFIG)
  const [mapReadyPhase, setMapReadyPhase] = useState<MapReadyPhase>(hasMapboxToken ? "booting" : "ready")
  const [geoState, setGeoState] = useState<"pending" | "center_pending" | "settled">(hasMapboxToken ? "pending" : "settled")
  const [showLoader, setShowLoader] = useState(hasMapboxToken)
  const [isLoaderFading, setIsLoaderFading] = useState(false)
  const [popupEventsAtPoint, setPopupEventsAtPoint] = useState<ObservationEvent[]>([])
  const selectedEventId = popupEventsAtPoint[0]?.id ?? null
  const [popupMetroStoryId, setPopupMetroStoryId] = useState<string | null>(null)
  const [popupStationId, setPopupStationId] = useState<string | null>(null)
  const [selectedMetroStoryId, setSelectedMetroStoryId] = useState<string | null>(null)
  const [popupPhase, setPopupPhase] = useState<"entering" | "visible" | "exiting">("visible")
  const popupTransitionTimerRef = useRef<number | null>(null)
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null)
  const [landmarkOverlay, setLandmarkOverlay] = useState<{
    name: string
    iconUrl: string
    iconSvgUrl?: string | null
  } | null>(null)
  const [events, setEvents] = useState<ObservationEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState(false)

  const clearPopupTransitionTimer = useCallback(() => {
    if (popupTransitionTimerRef.current) {
      window.clearTimeout(popupTransitionTimerRef.current)
      popupTransitionTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoState("settled")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setMapConfig((prev) => ({
          ...prev,
          soulOrb: {
            ...prev.soulOrb,
            enabled: true,
            lat: latitude,
            lng: longitude,
          },
        }))
        setGeoState("center_pending")
      },
      () => {
        // Si se rechaza o falla, no se activa el orbe.
        setGeoState("settled")
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }, [])

  useEffect(() => {
    const type = searchParams.get("type") ?? "all"
    const intensity = searchParams.get("intensity") ?? "all"
    const from = searchParams.get("from") ?? ""
    const to = searchParams.get("to") ?? ""
    setFilters((f) => ({
      ...f,
      type: type,
      intensity: intensity,
      dateFrom: from,
      dateTo: to,
    }))
  }, [searchParams])

  useEffect(() => {
    return () => clearPopupTransitionTimer()
  }, [clearPopupTransitionTimer])

  const filteredEvents = events.filter((e) => {
    if (filters.type !== "all" && e.type !== filters.type) return false
    if (filters.intensity !== "all" && e.intensity !== filters.intensity) return false
    if (filters.dateFrom && e.date < filters.dateFrom) return false
    if (filters.dateTo && e.date > filters.dateTo) return false
    return true
  })

  const selectedMetroStory = METRO_STORIES.find((s) => s.id === popupMetroStoryId) ?? null

  const handleSelectEvent = useCallback((id: string) => {
    setMobileDrawerOpen(false)
    setSelectedMetroStoryId(null)
    setPopupMetroStoryId(null)
    setPopupStationId(null)
    const clickedEvent = filteredEvents.find((e) => e.id === id)
    if (!clickedEvent) return
    if (popupEventsAtPoint.some((e) => e.id === id)) return

    const groupsByCoords = groupEventsByCoords(filteredEvents)
    const key = coordKey(clickedEvent.coords.lat, clickedEvent.coords.lng)
    const group = groupsByCoords.get(key) ?? [clickedEvent]
    clearPopupTransitionTimer()

    const animDuration = Math.max(250, mapConfig.popupConfig.animDuration)
    const exitDuration = Math.max(120, Math.round(animDuration * 0.45))
    const hasPopupOpen = popupEventsAtPoint.length > 0 || !!popupMetroStoryId || !!popupStationId

    if (hasPopupOpen) {
      setPopupPhase("exiting")
      popupTransitionTimerRef.current = window.setTimeout(() => {
        setPopupEventsAtPoint(group)
        setPopupPhase("entering")
        popupTransitionTimerRef.current = window.setTimeout(() => {
          setPopupPhase("visible")
          popupTransitionTimerRef.current = null
        }, 70)
      }, exitDuration)
      return
    }

    setPopupEventsAtPoint(group)
    setPopupPhase("entering")
    popupTransitionTimerRef.current = window.setTimeout(() => {
      setPopupPhase("visible")
      popupTransitionTimerRef.current = null
    }, 70)
  }, [clearPopupTransitionTimer, mapConfig.popupConfig.animDuration, filteredEvents, popupEventsAtPoint, popupMetroStoryId, popupStationId])

  const handleSelectMetroStory = useCallback((id: string) => {
    setMobileDrawerOpen(false)
    setPopupEventsAtPoint([])
    setPopupStationId(null)
    if (selectedMetroStoryId === id && popupMetroStoryId === id) return

    setSelectedMetroStoryId(id)
    clearPopupTransitionTimer()

    const animDuration = Math.max(250, mapConfig.popupConfig.animDuration)
    const exitDuration = Math.max(120, Math.round(animDuration * 0.45))
    const hasPopupOpen = popupEventsAtPoint.length > 0 || !!popupMetroStoryId || !!popupStationId

    if (hasPopupOpen) {
      setPopupPhase("exiting")
      popupTransitionTimerRef.current = window.setTimeout(() => {
        setPopupMetroStoryId(id)
        setPopupPhase("entering")
        popupTransitionTimerRef.current = window.setTimeout(() => {
          setPopupPhase("visible")
          popupTransitionTimerRef.current = null
        }, 70)
      }, exitDuration)
      return
    }

    setPopupMetroStoryId(id)
    setPopupPhase("entering")
    popupTransitionTimerRef.current = window.setTimeout(() => {
      setPopupPhase("visible")
      popupTransitionTimerRef.current = null
    }, 70)
  }, [clearPopupTransitionTimer, mapConfig.popupConfig.animDuration, popupEventsAtPoint, popupMetroStoryId, popupStationId, selectedMetroStoryId])

  const handleFilterChange = useCallback((key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (filters.type !== "all") params.set("type", filters.type)
    else params.delete("type")
    if (filters.intensity !== "all") params.set("intensity", filters.intensity)
    else params.delete("intensity")
    if (filters.dateFrom) params.set("from", filters.dateFrom)
    else params.delete("from")
    if (filters.dateTo) params.set("to", filters.dateTo)
    else params.delete("to")
    const q = params.toString()
    const url = q ? `?${q}` : window.location.pathname
    window.history.replaceState(null, "", url)
  }, [filters.type, filters.intensity, filters.dateFrom, filters.dateTo])

  const handleMapConfigChange = useCallback((nextConfig: typeof DEFAULT_MAP_CONFIG) => {
    setMapConfig(nextConfig)
    if (typeof nextConfig.zoom === "number") {
      setZoom(nextConfig.zoom)
    }
  }, [])

  const handleMapReadyPhaseChange = useCallback((phase: MapReadyPhase) => {
    setMapReadyPhase((prev) => {
      if (prev === "ready" && phase !== "ready") return prev
      return phase
    })
  }, [])

  useEffect(() => {
    if (geoState !== "center_pending") return
    if (mapReadyPhase !== "ready") return
    setGeoState("settled")
  }, [geoState, mapReadyPhase])

  const isBlockingReady = hasMapboxToken && (mapReadyPhase !== "ready" || geoState !== "settled")

  useEffect(() => {
    if (!hasMapboxToken) {
      setShowLoader(false)
      setIsLoaderFading(false)
      return
    }
    if (isBlockingReady) {
      setShowLoader(true)
      setIsLoaderFading(false)
      return
    }
    setIsLoaderFading(true)
    const timer = window.setTimeout(() => {
      setShowLoader(false)
      setIsLoaderFading(false)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [hasMapboxToken, isBlockingReady])

  const handleSelectStation = useCallback(
    (stationId: string) => {
      setMobileDrawerOpen(false)
      setPopupEventsAtPoint([])
      setSelectedMetroStoryId(null)
      setPopupMetroStoryId(null)
      if (popupStationId === stationId) return

      setPopupStationId(stationId)
      clearPopupTransitionTimer()

      const animDuration = Math.max(250, mapConfig.popupConfig.animDuration)
      const exitDuration = Math.max(120, Math.round(animDuration * 0.45))
      const hasPopupOpen = popupEventsAtPoint.length > 0 || !!popupMetroStoryId || !!popupStationId

      if (hasPopupOpen) {
        setPopupPhase("exiting")
        popupTransitionTimerRef.current = window.setTimeout(() => {
          setPopupEventsAtPoint([])
          setPopupMetroStoryId(null)
          setPopupStationId(stationId)
          setPopupPhase("entering")
          popupTransitionTimerRef.current = window.setTimeout(() => {
            setPopupPhase("visible")
            popupTransitionTimerRef.current = null
          }, 70)
        }, exitDuration)
        return
      }

      setPopupPhase("entering")
      popupTransitionTimerRef.current = window.setTimeout(() => {
        setPopupPhase("visible")
        popupTransitionTimerRef.current = null
      }, 70)
    },
    [clearPopupTransitionTimer, mapConfig.popupConfig.animDuration, popupEventsAtPoint, popupMetroStoryId, popupStationId]
  )

  const handleClosePopup = useCallback(() => {
    clearPopupTransitionTimer()
    setSelectedMetroStoryId(null)
    const hasPopupOpen = popupEventsAtPoint.length > 0 || !!popupMetroStoryId || !!popupStationId
    if (!hasPopupOpen) return
    setPopupPhase("exiting")
    const closeDelay = Math.max(120, Math.round(Math.max(250, mapConfig.popupConfig.animDuration) * 0.35))
    popupTransitionTimerRef.current = window.setTimeout(() => {
      setPopupEventsAtPoint([])
      setPopupMetroStoryId(null)
      setPopupStationId(null)
      setPopupPhase("visible")
      popupTransitionTimerRef.current = null
    }, closeDelay)
  }, [clearPopupTransitionTimer, mapConfig.popupConfig.animDuration, popupEventsAtPoint, popupMetroStoryId, popupStationId])

  // Overlay de partículas SVG desactivado hasta dominar el feature (bloqueaba el hilo).
  const handleLandmarkClick = useCallback(
    (_name: string, _iconUrl: string, _iconSvgUrl?: string | null) => {
      // setLandmarkOverlay({ name, iconUrl, iconSvgUrl })
    },
    []
  )

  const [metroStationsFromGeoJSON, setMetroStationsFromGeoJSON] = useState<typeof METRO_STATIONS>([])
  useEffect(() => {
    if (!filters.showMetroLines && !filters.showAllLayers) return
    fetch("/cdmx-metro-stations.geojson")
      .then((r) => r.json())
      .then((fc: { features?: Array<{ geometry: { coordinates: [number, number] }; properties: { name?: string; line?: string }; id?: string }> }) => {
        const stations =
          fc.features?.map((f, i) => {
            const lineRaw = f.properties?.line ?? "?"
            const line = String(lineRaw).replace(/^0+/, "") || String(lineRaw)
            return {
              id: f.id ?? `st-geo-${i}`,
              name: f.properties?.name ?? "?",
              line,
              coords: {
                lat: f.geometry?.coordinates?.[1] ?? 0,
                lng: f.geometry?.coordinates?.[0] ?? 0,
              },
            }
          }) ?? []
        setMetroStationsFromGeoJSON(stations)
      })
      .catch(() => setMetroStationsFromGeoJSON(METRO_STATIONS))
  }, [filters.showMetroLines, filters.showAllLayers])

  const metroStationsForMap = metroStationsFromGeoJSON.length > 0 ? metroStationsFromGeoJSON : METRO_STATIONS

  const filteredMetroStories = filterEventsInBounds(METRO_STORIES, CDMX_BOUNDS)

  const handleBoundsChange = useCallback((bounds: { north: number; south: number; east: number; west: number }) => {
    setMapBounds(bounds)
  }, [])

  useEffect(() => {
    if (!mapBounds) return
    setEventsLoading(true)
    setEventsError(false)
    getEventsInBounds(mapBounds)
      .then((data) => {
        setEvents(data)
        setEventsError(false)
      })
      .catch(() => {
        setEvents([])
        setEventsError(true)
      })
      .finally(() => setEventsLoading(false))
  }, [mapBounds])

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: "var(--background)" }}>
      {/* Mobile top bar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--panel-border)] flex-shrink-0"
        style={{ background: "var(--panel-bg)" }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="6" stroke="var(--sepia)" strokeWidth="0.7" opacity="0.6" />
            <circle cx="8" cy="8" r="2.5" stroke="var(--parchment)" strokeWidth="0.7" opacity="0.4" />
          </svg>
          <span className="font-serif text-sm text-[var(--parchment)] tracking-wide">Mapa de Observaciones</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/events/new"
            className="px-3 py-1.5 border border-[var(--primary)] text-[var(--primary)] font-mono text-[9px] tracking-[0.15em] uppercase rounded-sm hover:bg-[var(--primary)]/10 transition-colors"
          >
            + Registrar
          </Link>
          <button
            onClick={() => setMobileDrawerOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--panel-border)] rounded-sm text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
            aria-label={mobileDrawerOpen ? "Cerrar panel" : "Abrir panel"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="1" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="font-mono text-[9px] tracking-[0.15em] uppercase">
              {filteredEvents.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Desktop sidebar */}
        <div
          className={cn(
            "hidden md:flex flex-col flex-shrink-0 transition-all duration-500 ease-in-out overflow-hidden",
            panelCollapsed ? "w-14" : "w-[310px] lg:w-[340px]"
          )}
        >
          <MapPanel
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            collapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed((v) => !v)}
            filters={filters}
            onFilterChange={handleFilterChange}
            mapConfig={mapConfig}
            onMapConfigChange={handleMapConfigChange}
            showMapTestPanel={hasMapboxToken}
          />
        </div>

        {/* Mobile drawer overlay */}
        <div
          className={cn(
            "md:hidden absolute inset-0 z-20 transition-all duration-500 ease-in-out flex",
            mobileDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          {/* Backdrop */}
          <div
            className={cn(
              "absolute inset-0 bg-black/50 transition-opacity duration-500",
              mobileDrawerOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden
          />
          {/* Drawer */}
          <div
            className={cn(
              "relative z-10 w-[85vw] max-w-[320px] h-full transition-transform duration-500 ease-out",
              mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <MapPanel
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              collapsed={false}
              onToggleCollapse={() => setMobileDrawerOpen(false)}
              filters={filters}
              onFilterChange={handleFilterChange}
              mapConfig={mapConfig}
              onMapConfigChange={handleMapConfigChange}
              showMapTestPanel={hasMapboxToken}
            />
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative min-w-0 min-h-0">
          {hasMapboxToken ? (
            <div
              className={cn(
                "w-full h-full map-visibility-transition",
                isBlockingReady ? "opacity-0 invisible" : "opacity-100 visible"
              )}
            >
              <MapboxCanvas
                events={filteredEvents}
                selectedEventId={selectedEventId}
                highlightedEventId={null}
                onSelectEvent={handleSelectEvent}
                showDensity={filters.showDensity}
                showMetroLines={filters.showMetroLines}
                showAllLayers={filters.showAllLayers}
                metroStations={metroStationsForMap}
                metroStories={filteredMetroStories}
                selectedMetroStoryId={selectedMetroStoryId}
                onSelectMetroStory={handleSelectMetroStory}
                onSelectStation={handleSelectStation}
                onZoomChange={setZoom}
                onBoundsChange={handleBoundsChange}
                onLandmarkClick={handleLandmarkClick}
                mapStyle={mapConfig.style}
                pitch={mapConfig.pitch}
                bearing={mapConfig.bearing}
                mapConfig={mapConfig}
                zoom={zoom}
                onReadyPhaseChange={handleMapReadyPhaseChange}
              />
            </div>
          ) : (
            <MapCanvas
              events={filteredEvents}
              selectedEventId={selectedEventId}
              highlightedEventId={null}
              onSelectEvent={handleSelectEvent}
              showDensity={filters.showDensity}
              showMetroLines={filters.showMetroLines}
              onZoomChange={setZoom}
            />
          )}

          {hasMapboxToken && showLoader && <EtherealLoader fading={isLoaderFading} />}

          {/* Event / Metro story popup */}
          <EventPopup
            events={popupEventsAtPoint}
            metroStory={selectedMetroStory}
            onClose={handleClosePopup}
            popupConfig={mapConfig.popupConfig}
            phase={popupPhase}
          />

          {/* Station popup (stations without story) */}
          <StationPopup
            station={(popupStationId ? metroStationsForMap.find((s) => s.id === popupStationId) : null) ?? null}
            onClose={handleClosePopup}
            popupConfig={mapConfig.popupConfig}
            phase={popupPhase}
          />

          {/* Landmark particles overlay desactivado (partículas/SVG bloqueaban el hilo) */}
          {false && landmarkOverlay && (
            <LandmarkParticlesOverlay
              name={landmarkOverlay.name}
              iconUrl={landmarkOverlay.iconUrl}
              iconSvgUrl={landmarkOverlay.iconSvgUrl}
              onClose={() => setLandmarkOverlay(null)}
            />
          )}

          {/* Instruction hint */}
          {!selectedEventId && !selectedMetroStoryId && !popupStationId && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] opacity-35 text-center whitespace-nowrap">
                Haz clic en un símbolo para revelar su registro
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function MapaDeObservaciones() {
  return (
    <Suspense fallback={
      <main className="h-screen w-screen relative overflow-hidden" style={{ background: "var(--background)" }}>
        <EtherealLoader fullscreen />
      </main>
    }>
      <MapaDeObservacionesContent />
    </Suspense>
  )
}
