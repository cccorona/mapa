"use client"

import { useState, useCallback, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { MapPanel } from "@/components/map-panel"
import { MapCanvas } from "@/components/map-canvas"
import { MapboxCanvas } from "@/components/mapbox-canvas"
import type { MapReadyPhase } from "@/components/mapbox-canvas"
import { EventPopup } from "@/components/event-popup"
import { EVENTS } from "@/lib/data"
import { METRO_STORIES } from "@/lib/metro-data"
import { cn, filterEventsInBounds } from "@/lib/utils"
import { CDMX_BOUNDS, CDMX_DEFAULT_ZOOM } from "@/lib/map-bounds"
import { DEFAULT_MAP_CONFIG } from "@/lib/map-config"

const DEFAULT_FILTERS = {
  type: "all",
  intensity: "all",
  showDensity: false,
  showMetroLines: false,
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [zoom, setZoom] = useState(CDMX_DEFAULT_ZOOM)
  const [mapConfig, setMapConfig] = useState<typeof DEFAULT_MAP_CONFIG>(DEFAULT_MAP_CONFIG)
  const [mapReadyPhase, setMapReadyPhase] = useState<MapReadyPhase>(hasMapboxToken ? "booting" : "ready")
  const [geoState, setGeoState] = useState<"pending" | "center_pending" | "settled">(hasMapboxToken ? "pending" : "settled")
  const [showLoader, setShowLoader] = useState(hasMapboxToken)
  const [isLoaderFading, setIsLoaderFading] = useState(false)
  const [popupEventId, setPopupEventId] = useState<string | null>(null)
  const [popupMetroStoryId, setPopupMetroStoryId] = useState<string | null>(null)
  const [selectedMetroStoryId, setSelectedMetroStoryId] = useState<string | null>(null)
  const [popupPhase, setPopupPhase] = useState<"entering" | "visible" | "exiting">("visible")
  const popupTransitionTimerRef = useRef<number | null>(null)

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

  const selectedEvent = EVENTS.find((e) => e.id === popupEventId) ?? null
  const selectedMetroStory = METRO_STORIES.find((s) => s.id === popupMetroStoryId) ?? null
  const popupContent = selectedEvent ?? selectedMetroStory

  const handleSelectEvent = useCallback((id: string) => {
    setMobileDrawerOpen(false)
    setSelectedMetroStoryId(null)
    setPopupMetroStoryId(null)
    if (selectedEventId === id && popupEventId === id) return

    setSelectedEventId(id)
    clearPopupTransitionTimer()

    const animDuration = Math.max(250, mapConfig.popupConfig.animDuration)
    const exitDuration = Math.max(120, Math.round(animDuration * 0.45))
    const hasPopupOpen = popupEventId || popupMetroStoryId

    if (hasPopupOpen) {
      setPopupPhase("exiting")
      popupTransitionTimerRef.current = window.setTimeout(() => {
        setPopupEventId(id)
        setPopupPhase("entering")
        popupTransitionTimerRef.current = window.setTimeout(() => {
          setPopupPhase("visible")
          popupTransitionTimerRef.current = null
        }, 70)
      }, exitDuration)
      return
    }

    setPopupEventId(id)
    setPopupPhase("entering")
    popupTransitionTimerRef.current = window.setTimeout(() => {
      setPopupPhase("visible")
      popupTransitionTimerRef.current = null
    }, 70)
  }, [clearPopupTransitionTimer, mapConfig.popupConfig.animDuration, popupEventId, popupMetroStoryId, selectedEventId])

  const handleSelectMetroStory = useCallback((id: string) => {
    setMobileDrawerOpen(false)
    setSelectedEventId(null)
    setPopupEventId(null)
    if (selectedMetroStoryId === id && popupMetroStoryId === id) return

    setSelectedMetroStoryId(id)
    clearPopupTransitionTimer()

    const animDuration = Math.max(250, mapConfig.popupConfig.animDuration)
    const exitDuration = Math.max(120, Math.round(animDuration * 0.45))
    const hasPopupOpen = popupEventId || popupMetroStoryId

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
  }, [clearPopupTransitionTimer, mapConfig.popupConfig.animDuration, popupEventId, popupMetroStoryId, selectedMetroStoryId])

  const handleFilterChange = useCallback(
    (key: string, value: string | boolean) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value }
        const params = new URLSearchParams(window.location.search)
        if (next.type !== "all") params.set("type", next.type)
        else params.delete("type")
        if (next.intensity !== "all") params.set("intensity", next.intensity)
        else params.delete("intensity")
        if (next.dateFrom) params.set("from", next.dateFrom)
        else params.delete("from")
        if (next.dateTo) params.set("to", next.dateTo)
        else params.delete("to")
        const q = params.toString()
        const url = q ? `?${q}` : window.location.pathname
        window.history.replaceState(null, "", url)
        return next
      })
    },
    []
  )

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

  const handleClosePopup = useCallback(() => {
    clearPopupTransitionTimer()
    setSelectedEventId(null)
    setSelectedMetroStoryId(null)
    const hasPopupOpen = popupEventId || popupMetroStoryId
    if (!hasPopupOpen) return
    setPopupPhase("exiting")
    const closeDelay = Math.max(120, Math.round(Math.max(250, mapConfig.popupConfig.animDuration) * 0.35))
    popupTransitionTimerRef.current = window.setTimeout(() => {
      setPopupEventId(null)
      setPopupMetroStoryId(null)
      setPopupPhase("visible")
      popupTransitionTimerRef.current = null
    }, closeDelay)
  }, [clearPopupTransitionTimer, mapConfig.popupConfig.animDuration, popupEventId, popupMetroStoryId])

  const filteredMetroStories = filterEventsInBounds(METRO_STORIES, CDMX_BOUNDS)
  const filteredEvents = filterEventsInBounds(EVENTS, CDMX_BOUNDS).filter((e) => {
    if (filters.type !== "all" && e.type !== filters.type) return false
    if (filters.intensity !== "all" && e.intensity !== filters.intensity) return false
    if (filters.dateFrom && e.date < filters.dateFrom) return false
    if (filters.dateTo && e.date > filters.dateTo) return false
    return true
  })

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
                metroStories={filteredMetroStories}
                selectedMetroStoryId={selectedMetroStoryId}
                onSelectMetroStory={handleSelectMetroStory}
                onZoomChange={setZoom}
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
            event={popupContent}
            variant={selectedMetroStory ? "metro" : "event"}
            onClose={handleClosePopup}
            popupConfig={mapConfig.popupConfig}
            phase={popupPhase}
          />

          {/* Instruction hint */}
          {!selectedEventId && !selectedMetroStoryId && (
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
