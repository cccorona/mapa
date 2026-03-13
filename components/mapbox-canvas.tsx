"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import type { ObservationEvent } from "@/lib/data"
import type { MetroStory } from "@/types/metro"
import { EVENT_TYPE_TO_SYMBOL } from "@/lib/constants"
import { CDMX_BOUNDS, CDMX_CENTER, CDMX_DEFAULT_ZOOM } from "@/lib/map-bounds"
import { DEFAULT_MAP_CONFIG } from "@/lib/map-config"
import type { BoundaryGlowConfig, MapConfig } from "@/lib/map-config"
import { AtmosphericOverlay } from "@/components/atmospheric-overlay"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

const CDMX_BOUNDARY_SOURCE_ID = "cdmx-boundary"
const CDMX_BOUNDARY_GLOW_LAYER_ID = "cdmx-boundary-glow"
const CDMX_BOUNDARY_LINE_LAYER_ID = "cdmx-boundary-line"
const CDMX_BOUNDARY_VEIL_LAYER_ID = "cdmx-boundary-veil"
const CDMX_BOUNDARY_GEOJSON_URL = "/cdmx-boundary.geojson"
const CDMX_METRO_SOURCE_ID = "cdmx-metro-lines"
const CDMX_METRO_LINE_LAYER_ID = "cdmx-metro-line"
const CDMX_METRO_GEOJSON_URL = "/cdmx-metro-lines.geojson"
export type MapReadyPhase = "booting" | "styleLoaded" | "centering" | "ready"

interface MapboxCanvasProps {
  events: ObservationEvent[]
  selectedEventId: string | null
  highlightedEventId: string | null
  onSelectEvent: (id: string) => void
  showDensity: boolean
  showMetroLines?: boolean
  metroStories?: MetroStory[]
  selectedMetroStoryId?: string | null
  onSelectMetroStory?: (id: string) => void
  onZoomChange?: (zoom: number) => void
  onReadyPhaseChange?: (phase: MapReadyPhase) => void
  mapStyle?: string
  pitch?: number
  bearing?: number
  mapConfig?: MapConfig
  zoom?: number
}

export function MapboxCanvas({
  events,
  selectedEventId,
  onSelectEvent,
  showDensity,
  showMetroLines = false,
  metroStories = [],
  selectedMetroStoryId = null,
  onSelectMetroStory,
  onZoomChange,
  onReadyPhaseChange,
  mapStyle = "mapbox://styles/mapbox/light-v11",
  pitch = 0,
  bearing = 0,
  mapConfig,
  zoom = CDMX_DEFAULT_ZOOM,
}: MapboxCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const metroMarkersRef = useRef<mapboxgl.Marker[]>([])
  const soulMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const materializationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const materializationTimeoutRef = useRef<number | null>(null)
  const hasCenteredSoulOnceRef = useRef(false)
  const waitingInitialCenterRef = useRef(false)
  const currentReadyPhaseRef = useRef<MapReadyPhase>("booting")
  const lastCenteredSoulRef = useRef<string | null>(null)
  const lastCenteredEventRef = useRef<string | null>(null)
  const lastMaterializedEventRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const projection = mapConfig?.projection ?? "mercator"
  const boundaryGlow = mapConfig?.boundaryGlow ?? DEFAULT_MAP_CONFIG.boundaryGlow
  const emitReadyPhase = (phase: MapReadyPhase) => {
    if (currentReadyPhaseRef.current === phase) return
    currentReadyPhaseRef.current = phase
    onReadyPhaseChange?.(phase)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el || !mapboxgl.accessToken) return
    emitReadyPhase("booting")

    const initialZoom = mapConfig?.zoom ?? CDMX_DEFAULT_ZOOM

    const map = new mapboxgl.Map({
      container: el,
      style: mapStyle,
      projection: projection as "mercator" | "globe",
      center: CDMX_CENTER,
      zoom: initialZoom,
      pitch,
      bearing,
    })

    map.on("error", (e) => console.error("[Mapbox]", e.error))

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right")
    map.on("load", () => {
      emitReadyPhase("styleLoaded")
      map.setMaxBounds([
          [CDMX_BOUNDS.west, CDMX_BOUNDS.south],
          [CDMX_BOUNDS.east, CDMX_BOUNDS.north],
        ])
      // Permitimos alejar más en Mercator para encuadrar completo el contorno CDMX.
      map.setMinZoom(projection === "globe" ? 3 : 8)
      map.setMaxZoom(18)
      onZoomChange?.(map.getZoom())
      setIsReady(true)
    })
    map.on("zoomend", () => onZoomChange?.(map.getZoom()))
    mapRef.current = map
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize()
    })
    resizeObserver.observe(el)

    return () => {
      resizeObserver.disconnect()
      emitReadyPhase("booting")
      hasCenteredSoulOnceRef.current = false
      waitingInitialCenterRef.current = false
      metroMarkersRef.current.forEach((m) => m.remove())
      metroMarkersRef.current = []
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      soulMarkerRef.current?.remove()
      soulMarkerRef.current = null
      materializationMarkerRef.current?.remove()
      materializationMarkerRef.current = null
      if (materializationTimeoutRef.current) {
        window.clearTimeout(materializationTimeoutRef.current)
        materializationTimeoutRef.current = null
      }
      lastCenteredSoulRef.current = null
      lastCenteredEventRef.current = null
      lastMaterializedEventRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [mapStyle, projection, onReadyPhaseChange, onZoomChange])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current

    const trySetReady = () => {
      if (!map.isStyleLoaded()) return
      if (map.isMoving()) return
      if (waitingInitialCenterRef.current) return
      emitReadyPhase("ready")
    }

    const onIdle = () => {
      trySetReady()
    }
    map.on("idle", onIdle)
    const raf = window.requestAnimationFrame(trySetReady)
    return () => {
      window.cancelAnimationFrame(raf)
      map.off("idle", onIdle)
    }
  }, [isReady])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setPitch(pitch)
  }, [pitch])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setBearing(bearing)
  }, [bearing])

  const targetZoom = mapConfig?.zoom ?? CDMX_DEFAULT_ZOOM
  const markerSize = getEventMarkerSize(zoom)
  const markerOffsetY = Math.round(markerSize * -0.45)
  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const currentZoom = mapRef.current.getZoom()
    if (Math.abs(currentZoom - targetZoom) > 0.01) {
      mapRef.current.setZoom(targetZoom)
    }
  }, [targetZoom, isReady])

  const standardConfig = mapConfig?.standardConfig
  useEffect(() => {
    if (!mapRef.current || !isReady || !standardConfig) return
    if (!mapStyle?.includes?.("standard")) return
    const map = mapRef.current

    const apply = () => {
      try {
        if (!map.isStyleLoaded()) return
        map.setConfigProperty("basemap", "lightPreset", standardConfig.lightPreset)
        map.setConfigProperty("basemap", "show3dObjects", standardConfig.show3dObjects)
      } catch {
        // Standard config solo aplica cuando el estilo está listo
      }
    }

    let onReady: (() => void) | null = null
    if (map.isStyleLoaded()) {
      apply()
    } else {
      onReady = () => {
        if (map.isStyleLoaded() && onReady) {
          apply()
          map.off("idle", onReady)
        }
      }
      map.on("idle", onReady)
    }

    return () => {
      if (onReady) map.off("idle", onReady)
    }
  }, [mapStyle, isReady, standardConfig?.lightPreset, standardConfig?.show3dObjects])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    const initialBoundaryPaint = getBoundaryGlowPaints(DEFAULT_MAP_CONFIG.boundaryGlow)

    if (!map.getSource(CDMX_BOUNDARY_SOURCE_ID)) {
      map.addSource(CDMX_BOUNDARY_SOURCE_ID, {
        type: "geojson",
        data: CDMX_BOUNDARY_GEOJSON_URL,
      })
    }

    if (!map.getLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)) {
      map.addLayer({
        id: CDMX_BOUNDARY_VEIL_LAYER_ID,
        type: "fill",
        source: CDMX_BOUNDARY_SOURCE_ID,
        layout: {
          visibility: DEFAULT_MAP_CONFIG.boundaryGlow.enabled ? "visible" : "none",
        },
        paint: {
          "fill-color": "#4a7c6f",
          "fill-opacity": initialBoundaryPaint.veilOpacity,
        },
      })
    }

    if (!map.getLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)) {
      map.addLayer({
        id: CDMX_BOUNDARY_GLOW_LAYER_ID,
        type: "line",
        source: CDMX_BOUNDARY_SOURCE_ID,
        layout: {
          visibility: DEFAULT_MAP_CONFIG.boundaryGlow.enabled ? "visible" : "none",
        },
        paint: {
          "line-color": "#8b7355",
          "line-opacity": initialBoundaryPaint.glowOpacity,
          "line-width": initialBoundaryPaint.glowWidth,
          "line-blur": initialBoundaryPaint.glowBlur,
        },
      })
    }

    if (!map.getLayer(CDMX_BOUNDARY_LINE_LAYER_ID)) {
      map.addLayer({
        id: CDMX_BOUNDARY_LINE_LAYER_ID,
        type: "line",
        source: CDMX_BOUNDARY_SOURCE_ID,
        layout: {
          visibility: DEFAULT_MAP_CONFIG.boundaryGlow.enabled ? "visible" : "none",
        },
        paint: {
          "line-color": "#d4c9a8",
          "line-opacity": initialBoundaryPaint.lineOpacity,
          "line-width": initialBoundaryPaint.lineWidth,
        },
      })
    }

    // Metro lines layer (above boundary, below markers)
    if (!map.getSource(CDMX_METRO_SOURCE_ID)) {
      map.addSource(CDMX_METRO_SOURCE_ID, {
        type: "geojson",
        data: CDMX_METRO_GEOJSON_URL,
      })
    }
    if (!map.getLayer(CDMX_METRO_LINE_LAYER_ID)) {
      map.addLayer({
        id: CDMX_METRO_LINE_LAYER_ID,
        type: "line",
        source: CDMX_METRO_SOURCE_ID,
        layout: {
          visibility: "none",
        },
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#666666"],
          "line-width": 4,
          "line-opacity": 0.9,
        },
      })
    }

    // Keep aura layers above style layers so the portal edge remains visible.
    if (map.getLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)) map.moveLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)
    if (map.getLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)) map.moveLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)
    if (map.getLayer(CDMX_BOUNDARY_LINE_LAYER_ID)) map.moveLayer(CDMX_BOUNDARY_LINE_LAYER_ID)
    if (map.getLayer(CDMX_METRO_LINE_LAYER_ID)) map.moveLayer(CDMX_METRO_LINE_LAYER_ID)
  }, [isReady, mapStyle, projection])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    const visibility = showMetroLines ? "visible" : "none"
    if (map.getLayer(CDMX_METRO_LINE_LAYER_ID)) {
      map.setLayoutProperty(CDMX_METRO_LINE_LAYER_ID, "visibility", visibility)
    }
  }, [isReady, showMetroLines])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    const paint = getBoundaryGlowPaints(boundaryGlow)
    const visibility = boundaryGlow.enabled ? "visible" : "none"

    ;[CDMX_BOUNDARY_VEIL_LAYER_ID, CDMX_BOUNDARY_GLOW_LAYER_ID, CDMX_BOUNDARY_LINE_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility)
      }
    })

    if (map.getLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)) {
      map.setPaintProperty(CDMX_BOUNDARY_VEIL_LAYER_ID, "fill-opacity", paint.veilOpacity)
    }
    if (map.getLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)) {
      map.setPaintProperty(CDMX_BOUNDARY_GLOW_LAYER_ID, "line-opacity", paint.glowOpacity)
      map.setPaintProperty(CDMX_BOUNDARY_GLOW_LAYER_ID, "line-width", paint.glowWidth)
      map.setPaintProperty(CDMX_BOUNDARY_GLOW_LAYER_ID, "line-blur", paint.glowBlur)
    }
    if (map.getLayer(CDMX_BOUNDARY_LINE_LAYER_ID)) {
      map.setPaintProperty(CDMX_BOUNDARY_LINE_LAYER_ID, "line-opacity", paint.lineOpacity)
      map.setPaintProperty(CDMX_BOUNDARY_LINE_LAYER_ID, "line-width", paint.lineWidth)
    }
  }, [
    isReady,
    boundaryGlow.enabled,
    boundaryGlow.veilOpacity,
    boundaryGlow.glowOpacity,
    boundaryGlow.glowWidth,
    boundaryGlow.glowBlur,
    boundaryGlow.lineOpacity,
    boundaryGlow.lineWidth,
  ])

  useEffect(() => {
    if (!mapRef.current || !isReady) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    events.forEach((event) => {
      const el = document.createElement("div")
      el.className = "mapbox-marker"
      el.dataset.eventId = event.id
      const symbol = EVENT_TYPE_TO_SYMBOL[event.type] ?? "vela"
      const isSelected = selectedEventId === event.id
      el.innerHTML = getMarkerSvg(symbol, isSelected, Math.round(markerSize * 0.85))
      el.style.cursor = "pointer"
      el.style.width = `${Math.round(markerSize)}px`
      el.style.height = `${Math.round(markerSize)}px`
      el.style.display = "flex"
      el.style.alignItems = "center"
      el.style.justifyContent = "center"
      el.style.filter = isSelected
        ? "drop-shadow(0 0 14px rgba(139,115,85,0.95)) drop-shadow(0 0 28px rgba(139,115,85,0.65)) drop-shadow(0 0 44px rgba(180,150,100,0.35))"
        : "drop-shadow(0 0 10px rgba(74,124,111,0.65)) drop-shadow(0 0 18px rgba(74,124,111,0.4)) drop-shadow(0 0 30px rgba(74,124,111,0.25))"
      // Animate only the internal svg to avoid overriding Mapbox marker transform.
      const innerSvg = el.querySelector("svg")
      if (innerSvg && typeof innerSvg.animate === "function") {
        innerSvg.animate(
          [
            { transform: "translateY(0px)" },
            { transform: "translateY(-3px)" },
            { transform: "translateY(0px)" },
          ],
          {
            duration: 2200 + Math.random() * 900,
            iterations: Infinity,
            easing: "ease-in-out",
          }
        )
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([event.coords.lng, event.coords.lat])
        .setOffset([0, markerOffsetY])
        .addTo(mapRef.current!)

      el.addEventListener("click", () => onSelectEvent(event.id))
      markersRef.current.push(marker)
    })

    // Metro station markers (only when showMetroLines and stations have stories)
    metroMarkersRef.current.forEach((m) => m.remove())
    metroMarkersRef.current = []

    if (showMetroLines && metroStories.length > 0 && onSelectMetroStory) {
      const metroSize = Math.round(markerSize * 0.7)
      const getMetroSvg = (selected: boolean) => {
        const stroke = selected ? "rgba(212,201,168,0.95)" : "rgba(0,163,224,0.9)"
        const fill = selected ? "rgba(139,115,85,0.2)" : "rgba(0,163,224,0.15)"
        const textFill = selected ? "rgba(212,201,168,0.95)" : "rgba(0,163,224,0.95)"
        return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:${metroSize}px;height:${metroSize}px">
          <circle cx="12" cy="12" r="9" stroke="${stroke}" stroke-width="1.5" fill="${fill}"/>
          <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="${textFill}">M</text>
        </svg>`
      }
      metroStories.forEach((story) => {
        const el = document.createElement("div")
        el.className = "mapbox-marker mapbox-metro-marker"
        el.dataset.storyId = story.id
        const isSelected = selectedMetroStoryId === story.id
        el.innerHTML = getMetroSvg(isSelected)
        el.style.cursor = "pointer"
        el.style.width = `${metroSize}px`
        el.style.height = `${metroSize}px`
        el.style.display = "flex"
        el.style.alignItems = "center"
        el.style.justifyContent = "center"
        el.style.filter = isSelected
          ? "drop-shadow(0 0 10px rgba(139,115,85,0.8)) drop-shadow(0 0 20px rgba(139,115,85,0.5))"
          : "drop-shadow(0 0 8px rgba(0,163,224,0.6))"
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([story.coords.lng, story.coords.lat])
          .setOffset([0, markerOffsetY])
          .addTo(mapRef.current!)
        el.addEventListener("click", () => onSelectMetroStory(story.id))
        metroMarkersRef.current.push(marker)
      })
    }
  }, [events, selectedEventId, selectedMetroStoryId, isReady, onSelectEvent, onSelectMetroStory, markerOffsetY, markerSize, showMetroLines, metroStories])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    soulMarkerRef.current?.remove()
    soulMarkerRef.current = null

    const soulOrb = mapConfig?.soulOrb
    if (!soulOrb?.enabled) return

    const el = createSoulOrbElement(soulOrb.color)
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([soulOrb.lng, soulOrb.lat])
      .setOffset([0, soulOrb.offsetY])
      .addTo(mapRef.current)

    soulMarkerRef.current = marker
  }, [
    isReady,
    mapConfig?.soulOrb?.enabled,
    mapConfig?.soulOrb?.color,
    mapConfig?.soulOrb?.lat,
    mapConfig?.soulOrb?.lng,
    mapConfig?.soulOrb?.offsetY,
  ])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const soulOrb = mapConfig?.soulOrb
    if (!soulOrb?.enabled) return
    if (!Number.isFinite(soulOrb.lat) || !Number.isFinite(soulOrb.lng)) return

    const centerKey = `${soulOrb.lat.toFixed(6)},${soulOrb.lng.toFixed(6)}`
    if (lastCenteredSoulRef.current === centerKey) return
    lastCenteredSoulRef.current = centerKey
    const isInitialCenter = !hasCenteredSoulOnceRef.current
    if (isInitialCenter) {
      waitingInitialCenterRef.current = true
      emitReadyPhase("centering")
    }

    mapRef.current.flyTo({
      center: [soulOrb.lng, soulOrb.lat],
      zoom: mapRef.current.getZoom(),
      duration: 900,
      essential: true,
    })
    if (isInitialCenter) {
      hasCenteredSoulOnceRef.current = true
      const map = mapRef.current
      const onMoveEnd = () => {
        waitingInitialCenterRef.current = false
        emitReadyPhase("ready")
      }
      map.once("moveend", onMoveEnd)
    }
  }, [isReady, mapConfig?.soulOrb?.enabled, mapConfig?.soulOrb?.lat, mapConfig?.soulOrb?.lng])

  useEffect(() => {
    if (!mapRef.current || !isReady || !selectedEventId) return
    const selectedEvent = events.find((event) => event.id === selectedEventId)
    if (!selectedEvent) return

    const eventKey = `${selectedEvent.id}:${selectedEvent.coords.lat.toFixed(6)},${selectedEvent.coords.lng.toFixed(6)}`
    if (lastCenteredEventRef.current !== eventKey) {
      lastCenteredEventRef.current = eventKey
      mapRef.current.flyTo({
        center: [selectedEvent.coords.lng, selectedEvent.coords.lat],
        zoom: mapRef.current.getZoom(),
        duration: 900,
        essential: true,
      })
    }

    if (lastMaterializedEventRef.current === eventKey) return
    lastMaterializedEventRef.current = eventKey

    materializationMarkerRef.current?.remove()
    materializationMarkerRef.current = null
    if (materializationTimeoutRef.current) {
      window.clearTimeout(materializationTimeoutRef.current)
      materializationTimeoutRef.current = null
    }

    const el = createMaterializationElement(markerSize)
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([selectedEvent.coords.lng, selectedEvent.coords.lat])
      .setOffset([0, markerOffsetY - Math.round(markerSize * 0.15)])
      .addTo(mapRef.current)
    materializationMarkerRef.current = marker

    materializationTimeoutRef.current = window.setTimeout(() => {
      materializationMarkerRef.current?.remove()
      materializationMarkerRef.current = null
      materializationTimeoutRef.current = null
    }, 1150)
  }, [events, isReady, markerOffsetY, markerSize, selectedEventId])

  useEffect(() => {
    if (!mapRef.current || !isReady) return

    const heatmapLayerId = "events-heatmap"
    const heatmapSourceId = "events-heatmap-source"

    if (showDensity && events.length > 0) {
      if (!mapRef.current.getSource(heatmapSourceId)) {
        mapRef.current.addSource(heatmapSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: events.map((e) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [e.coords.lng, e.coords.lat],
              },
              properties: { intensity: parseInt(e.intensity, 10) || 3 },
            })),
          },
        })
        mapRef.current.addLayer({
          id: heatmapLayerId,
          type: "heatmap",
          source: heatmapSourceId,
          paint: {
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 0.5,
              15, 2,
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["get", "intensity"],
              1, 8,
              5, 20,
            ],
            "heatmap-opacity": 0.4,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(13,17,23,0)",
              0.3, "rgba(74,124,111,0.2)",
              0.6, "rgba(139,115,85,0.4)",
              1, "rgba(139,115,85,0.6)",
            ],
          },
        })
      } else {
        ;(mapRef.current.getSource(heatmapSourceId) as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: events.map((e) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [e.coords.lng, e.coords.lat],
            },
            properties: { intensity: parseInt(e.intensity, 10) || 3 },
          })),
        })
      }
      mapRef.current.setLayoutProperty(heatmapLayerId, "visibility", "visible")
    } else {
      if (mapRef.current.getLayer(heatmapLayerId)) {
        mapRef.current.setLayoutProperty(heatmapLayerId, "visibility", "none")
      }
    }

    // Keep CDMX aura above heatmap when density layer is toggled/updated.
    if (mapRef.current.getLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)) mapRef.current.moveLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)
    if (mapRef.current.getLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)) mapRef.current.moveLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)
    if (mapRef.current.getLayer(CDMX_BOUNDARY_LINE_LAYER_ID)) mapRef.current.moveLayer(CDMX_BOUNDARY_LINE_LAYER_ID)
  }, [showDensity, events, isReady])

  const cfg = mapConfig
  const f = cfg?.filter ?? { sepia: 0, hueRotate: 0, saturate: 100, contrast: 100, brightness: 100 }
  const hasFilter =
    cfg &&
    (cfg.artisticMode !== "none" ||
      f.sepia > 0 ||
      f.hueRotate !== 0 ||
      f.saturate !== 100 ||
      f.contrast !== 100 ||
      f.brightness !== 100)
  const filterStyle = hasFilter
    ? {
        filter: `sepia(${Math.min(1, f.sepia / 100)}) hue-rotate(${f.hueRotate}deg) saturate(${Math.max(0, f.saturate / 100)}) contrast(${Math.max(0, f.contrast / 100)}) brightness(${Math.max(0, f.brightness / 100)})`,
      }
    : undefined

  const showMist = cfg?.overlays?.mist ?? false
  const showVignette = cfg?.overlays?.vignette ?? false
  const showAtmospheric = cfg?.overlays?.atmospheric ?? false
  const zoomOverlayFactor = interpolateZoomFactor(zoom)
  const mistOpacity = ((cfg?.opacity?.mist ?? 70) / 100) * zoomOverlayFactor
  const vignetteOpacity = ((cfg?.opacity?.vignette ?? 100) / 100) * zoomOverlayFactor
  const atmosphericOpacity = ((cfg?.opacity?.atmospheric ?? 100) / 100) * zoomOverlayFactor

  if (!mapboxgl.accessToken) {
    return (
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <div className="text-center px-6">
          <p className="font-mono text-sm text-[var(--parchment-dim)] mb-2">
            Configura <code className="text-[var(--sepia)]">NEXT_PUBLIC_MAPBOX_TOKEN</code>
          </p>
          <p className="font-serif text-xs text-[var(--parchment-dim)] opacity-70">
            Añade tu token de Mapbox en .env.local para habilitar el mapa.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0"
        style={filterStyle}
      >
        <div
          ref={containerRef}
          id="map"
          style={{ width: "100%", height: "100%" }}
        />

        {showMist && (
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background: `
                radial-gradient(ellipse 60% 45% at 38% 52%, rgba(26,48,64,0.45) 0%, transparent 70%),
                radial-gradient(ellipse 50% 40% at 72% 35%, rgba(30,43,40,0.35) 0%, transparent 65%),
                radial-gradient(ellipse 40% 30% at 55% 75%, rgba(17,24,32,0.4) 0%, transparent 60%)
              `,
              opacity: mistOpacity,
              zIndex: 1,
            }}
          />
        )}

        {showVignette && (
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 50%, rgba(5,8,10,0.7) 100%)",
              opacity: vignetteOpacity,
              zIndex: 2,
            }}
          />
        )}

        {showAtmospheric && (
          <AtmosphericOverlay zoom={zoom} opacity={atmosphericOpacity} />
        )}
      </div>

      {/* Controls label */}
      <div className="absolute bottom-6 left-6 z-10">
        <span className="font-mono text-[9px] tracking-[0.2em] text-[var(--parchment-dim)] opacity-40 uppercase">
          {events.length} registros cartografiados
        </span>
      </div>
    </div>
  )
}

function getMarkerSvg(symbol: string, selected: boolean, size: number): string {
  const scale = selected ? 1.35 : 1
  const opacity = selected ? 1 : 0.8
  const svgStyle = `width:${size}px;height:${size}px;transform:scale(${scale});opacity:${opacity}`

  const svgs: Record<string, string> = {
    vela: `<svg viewBox="0 0 24 24" fill="none" style="${svgStyle}">
      <path d="M12 10 C12 10 10 7 11 4.5 C12 2 14 3.5 14 5.5 C14 8 12 10 12 10Z" fill="rgba(200,160,80,0.85)"/>
      <line x1="12" y1="10" x2="12" y2="13" stroke="rgba(180,140,60,0.6)" stroke-width="1"/>
      <rect x="9.5" y="13" width="5" height="8" rx="1" fill="rgba(200,170,100,0.7)"/>
      <ellipse cx="12" cy="21" rx="3" ry="0.8" fill="rgba(139,115,85,0.4)"/>
    </svg>`,
    grieta: `<svg viewBox="0 0 24 24" fill="none" style="${svgStyle}">
      <path d="M5 4 L10 10 L8 12 L15 20" stroke="rgba(74,124,111,0.8)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 10 L16 7" stroke="rgba(74,124,111,0.4)" stroke-width="0.8" stroke-linecap="round"/>
    </svg>`,
    hilo: `<svg viewBox="0 0 24 24" fill="none" style="${svgStyle}">
      <path d="M3 12 C6 8 10 18 14 12 C18 6 22 16 24 12" stroke="rgba(180,150,100,0.75)" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="14" y1="8" x2="14" y2="5" stroke="rgba(180,150,100,0.5)" stroke-width="0.8"/>
      <line x1="14" y1="16" x2="14" y2="20" stroke="rgba(180,150,100,0.4)" stroke-width="0.7" stroke-dasharray="1.5 1.5"/>
    </svg>`,
    puerta: `<svg viewBox="0 0 24 24" fill="none" style="${svgStyle}">
      <rect x="6" y="3" width="12" height="18" rx="0.5" stroke="rgba(160,184,160,0.7)" stroke-width="1.2"/>
      <circle cx="16" cy="12" r="1" fill="rgba(160,184,160,0.6)"/>
      <line x1="6" y1="3" x2="6" y2="21" stroke="rgba(160,184,160,0.25)" stroke-width="0.5"/>
    </svg>`,
    documento: `<svg viewBox="0 0 24 24" fill="none" style="${svgStyle}">
      <path d="M6 4 L12 4 L15 7 L15 20 L6 20 Z" stroke="rgba(139,115,85,0.8)" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M12 4 L12 7 L15 7" stroke="rgba(139,115,85,0.6)" stroke-width="1.2" stroke-linejoin="round"/>
      <line x1="8" y1="10" x2="13" y2="10" stroke="rgba(180,150,100,0.6)" stroke-width="0.8"/>
      <line x1="8" y1="13" x2="13" y2="13" stroke="rgba(180,150,100,0.5)" stroke-width="0.8"/>
    </svg>`,
    germen: `<svg viewBox="0 0 24 24" fill="none" style="${svgStyle}">
      <ellipse cx="12" cy="20" rx="3" ry="1.5" stroke="rgba(74,124,111,0.6)" stroke-width="0.9"/>
      <path d="M12 16 C12 12 9 9 12 5 C15 9 12 12 12 16" stroke="rgba(160,184,160,0.8)" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="12" cy="6" r="1.5" fill="rgba(200,170,100,0.6)"/>
    </svg>`,
    cruz: `<svg viewBox="0 0 24 24" fill="none" style="${svgStyle}">
      <line x1="12" y1="2" x2="12" y2="22" stroke="rgba(139,115,85,0.7)" stroke-width="1.2"/>
      <line x1="4" y1="12" x2="20" y2="12" stroke="rgba(139,115,85,0.7)" stroke-width="1.2"/>
      <circle cx="12" cy="12" r="3" stroke="rgba(139,115,85,0.4)" stroke-width="0.8"/>
    </svg>`,
  }
  return svgs[symbol] ?? svgs.vela
}

function createSoulOrbElement(color: string): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "soul-orb-marker"
  el.style.width = "32px"
  el.style.height = "32px"
  el.style.borderRadius = "9999px"
  el.style.pointerEvents = "none"
  el.style.background = `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.25) 0%, ${color} 35%, rgba(0,0,0,0.95) 78%, rgba(0,0,0,0.1) 100%)`
  el.style.boxShadow = "0 0 18px rgba(0,0,0,0.55), 0 0 38px rgba(0,0,0,0.35), inset 0 0 10px rgba(255,255,255,0.08)"
  el.style.opacity = "0.95"
  return el
}

function createMaterializationElement(size: number): HTMLDivElement {
  const el = document.createElement("div")
  const ringSize = Math.max(36, Math.round(size * 1.15))
  el.style.width = `${ringSize}px`
  el.style.height = `${ringSize}px`
  el.style.borderRadius = "9999px"
  el.style.pointerEvents = "none"
  const pulse = document.createElement("div")
  pulse.style.width = "100%"
  pulse.style.height = "100%"
  pulse.style.borderRadius = "9999px"
  pulse.style.border = "1px solid rgba(212,201,168,0.7)"
  pulse.style.background = "radial-gradient(circle, rgba(212,201,168,0.3) 0%, rgba(139,115,85,0.16) 45%, rgba(139,115,85,0) 72%)"
  pulse.style.boxShadow = "0 0 18px rgba(212,201,168,0.5), 0 0 34px rgba(139,115,85,0.35)"
  el.appendChild(pulse)
  if (typeof pulse.animate === "function") {
    pulse.animate(
      [
        { transform: "scale(0.35)", opacity: 0.05 },
        { transform: "scale(1)", opacity: 0.9, offset: 0.45 },
        { transform: "scale(1.45)", opacity: 0 },
      ],
      { duration: 1100, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
    )
  }
  return el
}

function interpolateZoomFactor(zoom: number): number {
  if (zoom <= 10) return 0.3
  if (zoom >= 18) return 0.2
  if (zoom <= 14) return lerp(0.3, 0.6, (zoom - 10) / 4)
  return lerp(0.6, 0.2, (zoom - 14) / 4)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

function getEventMarkerSize(zoom: number): number {
  if (zoom <= 12) return 54
  if (zoom >= 18) return 42
  if (zoom <= 16) return lerp(54, 46, (zoom - 12) / 4)
  return lerp(46, 42, (zoom - 16) / 2)
}

function getBoundaryGlowPaints(config: BoundaryGlowConfig) {
  const veilScale = clamp(config.veilOpacity / 100, 0, 1)
  const glowScale = clamp(config.glowOpacity / 100, 0, 1)
  const glowWidth = clamp(config.glowWidth, 1, 24)
  const glowBlur = clamp(config.glowBlur, 0, 8)
  const lineScale = clamp(config.lineOpacity / 100, 0, 1)
  const lineWidth = clamp(config.lineWidth, 0.5, 4)

  return {
    veilOpacity: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 0.02 * veilScale,
      13, 0.045 * veilScale,
      16, 0.08 * veilScale,
      18, 0.12 * veilScale,
    ],
    glowOpacity: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 0.35 * glowScale,
      13, 0.55 * glowScale,
      16, 0.78 * glowScale,
      18, 0.96 * glowScale,
    ],
    glowWidth: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, glowWidth * 0.35,
      13, glowWidth * 0.6,
      16, glowWidth * 0.9,
      18, glowWidth * 1.12,
    ],
    glowBlur: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, glowBlur * 0.4,
      13, glowBlur * 0.65,
      16, glowBlur * 0.9,
      18, glowBlur * 1.08,
    ],
    lineOpacity: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 0.45 * lineScale,
      13, 0.66 * lineScale,
      16, 0.88 * lineScale,
      18, 1 * lineScale,
    ],
    lineWidth: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, lineWidth * 0.45,
      13, lineWidth * 0.65,
      16, lineWidth * 0.88,
      18, lineWidth,
    ],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
