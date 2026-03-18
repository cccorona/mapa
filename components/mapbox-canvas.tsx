"use client"

import { createRoot } from "react-dom/client"
import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import type { ObservationEvent } from "@/lib/data"
import type { MetroStation, MetroStory } from "@/types/metro"
import { getSymbolForType, SYMBOLS } from "@/lib/icons"
import { SYMBOL_COLORS } from "@/lib/theme"
import { CDMX_BOUNDS, CDMX_CENTER, CDMX_DEFAULT_ZOOM } from "@/lib/map-bounds"
import { DEFAULT_MAP_CONFIG } from "@/lib/map-config"
import type { BoundaryGlowConfig, MapConfig } from "@/lib/map-config"
import { AtmosphericOverlay } from "@/components/atmospheric-overlay"
import { RainOverlay } from "@/components/rain-overlay"
import { SnowOverlay } from "@/components/snow-overlay"
import { getStationCodeForName } from "@/lib/event-layers"
import { createClient } from "@/lib/supabase/client"
import { LandmarkParticleIcon } from "@/components/landmark-particle-icon"
import { devLog } from "@/lib/dev-log"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

const CDMX_BOUNDARY_SOURCE_ID = "cdmx-boundary"
const CDMX_BOUNDARY_GLOW_LAYER_ID = "cdmx-boundary-glow"
const CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID = "cdmx-boundary-portal-glow"
const CDMX_BOUNDARY_LINE_LAYER_ID = "cdmx-boundary-line"
const CDMX_BOUNDARY_VEIL_LAYER_ID = "cdmx-boundary-veil"
const CDMX_BOUNDARY_GEOJSON_URL = "/cdmx-boundary.geojson"
const CDMX_EVENTS_SOURCE_ID = "cdmx-events"
const EVENTS_LAYER_ID = "events-layer"
const METRO_STATIONS_LAYER_ID = "metro-stations-layer"

const ESCENOGRAFIA_PREFIX = "escenografia-"

function geodataSourceId(groupCode: string): string {
  return `geodata-${groupCode}`
}
function geodataLineGlowLayerId(groupCode: string): string {
  return `geodata-${groupCode}-line-glow`
}
function geodataLineLayerId(groupCode: string): string {
  return `geodata-${groupCode}-line`
}
function geodataPointsLayerId(groupCode: string): string {
  return `geodata-${groupCode}-points`
}
type LandmarkFromApi = {
  id: string
  name: string
  lng: number
  lat: number
  icon_url: string
  icon_svg_url?: string | null
}

function roundCoord(c: number): number {
  return Math.round(c * 100000) / 100000
}

type PointFeature = {
  type: "Feature"
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: Record<string, string | number | boolean>
}

function buildEventsGeoJSON(
  events: ObservationEvent[],
  metroStations: MetroStation[],
  includeEvents: boolean,
  includeStations: boolean,
  metroStories: MetroStory[],
  visibleGroupCodes: string[]
): { type: "FeatureCollection"; features: PointFeature[] } {
  const stationIdToStory = new Map(metroStories.map((s) => [s.stationId, s]))
  const nameToStory = new Map<string, MetroStory>()
  metroStories.forEach((story) => {
    nameToStory.set(story.stationId, story)
  })
  const defaultGroup = visibleGroupCodes[0] ?? ""

  const eventFeatures: PointFeature[] = includeEvents
    ? events.map((e) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [roundCoord(e.coords.lng), roundCoord(e.coords.lat)],
        },
        properties: {
          group: e.group ?? defaultGroup,
          sub_layer: e.layer ?? "DEFAULT",
          sub_sub_layer: e.sublayerDetail ?? "",
          type: "point" as const,
          feature_type: "event" as const,
          eventId: e.id,
          eventType: e.type,
          intensity: e.intensity,
          color: SYMBOL_COLORS[getSymbolForType(e.type)] ?? "#8b7355",
          symbol: getSymbolForType(e.type),
        },
      }))
    : []

  const stationFeatures: PointFeature[] =
    includeStations && metroStations.length > 0 && visibleGroupCodes.length > 0
      ? metroStations.map((s) => {
          const story = stationIdToStory.get(s.id) ?? nameToStory.get(s.name)
          const stationCode = getStationCodeForName(s.name) ?? ""
          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [roundCoord(s.coords.lng), roundCoord(s.coords.lat)],
            },
            properties: {
              group: defaultGroup,
              sub_layer: "METRO",
              sub_sub_layer: stationCode,
              type: "point" as const,
              feature_type: "station" as const,
              stationId: s.id,
              name: s.name,
              line: s.line,
              hasStory: !!story,
              storyId: story?.id ?? "",
            },
          }
        })
      : []

  return {
    type: "FeatureCollection",
    features: [...eventFeatures, ...stationFeatures],
  }
}
export type MapReadyPhase = "booting" | "styleLoaded" | "centering" | "ready"

interface MapboxCanvasProps {
  events: ObservationEvent[]
  selectedEventId: string | null
  highlightedEventId: string | null
  onSelectEvent: (id: string) => void
  showDensity: boolean
  /** Grupos visibles (code -> visible). Geodata se carga por group_code al activar. */
  visibleGroups?: Record<string, boolean>
  /** Por grupo, qué layer_geodata están visibles (id -> boolean). Filtra lo que se pinta. */
  visibleLayerGeodata?: Record<string, Record<string, boolean>>
  metroStations?: MetroStation[]
  /** Visibilidad por layer id para capas del estilo con id escenografia-* */
  escenografiaVisible?: Record<string, boolean>
  /** Callback cuando el estilo carga y se descubren capas escenografia-* */
  onEscenografiaLayersLoaded?: (layers: { id: string }[]) => void
  metroStories?: MetroStory[]
  selectedMetroStoryId?: string | null
  onSelectMetroStory?: (id: string) => void
  onSelectStation?: (stationId: string) => void
  onZoomChange?: (zoom: number) => void
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void
  onReadyPhaseChange?: (phase: MapReadyPhase) => void
  onLandmarkClick?: (name: string, iconUrl: string, iconSvgUrl?: string | null) => void
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
  visibleGroups = {},
  visibleLayerGeodata = {},
  metroStations = [],
  escenografiaVisible = {},
  onEscenografiaLayersLoaded,
  metroStories = [],
  selectedMetroStoryId = null,
  onSelectMetroStory,
  onSelectStation,
  onZoomChange,
  onBoundsChange,
  onReadyPhaseChange,
  onLandmarkClick,
  mapStyle = "mapbox://styles/mapbox/light-v11",
  pitch = 0,
  bearing = 0,
  mapConfig,
  zoom = CDMX_DEFAULT_ZOOM,
}: MapboxCanvasProps) {
  devLog("[landmarks] MapboxCanvas render, token:", !!mapboxgl.accessToken)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
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
  const [landmarksList, setLandmarksList] = useState<LandmarkFromApi[]>([])
  const setLandmarksListRef = useRef(setLandmarksList)
  setLandmarksListRef.current = setLandmarksList
  const landmarksMarkersMapRef = useRef<Map<string, { marker: mapboxgl.Marker; root: ReturnType<typeof createRoot>; div: HTMLDivElement }>>(new Map())

  const onSelectEventRef = useRef(onSelectEvent)
  const onSelectMetroStoryRef = useRef(onSelectMetroStory)
  const onSelectStationRef = useRef(onSelectStation)
  const onLandmarkClickRef = useRef(onLandmarkClick)
  onSelectEventRef.current = onSelectEvent
  onSelectMetroStoryRef.current = onSelectMetroStory
  onSelectStationRef.current = onSelectStation
  onLandmarkClickRef.current = onLandmarkClick

  const projection = mapConfig?.projection ?? "mercator"
  const boundaryGlow = mapConfig?.boundaryGlow ?? DEFAULT_MAP_CONFIG.boundaryGlow
  const mapboxRain = mapConfig?.mapboxRain ?? DEFAULT_MAP_CONFIG.mapboxRain
  const mapboxSnow = mapConfig?.mapboxSnow ?? DEFAULT_MAP_CONFIG.mapboxSnow
  const visibleGroupCodes = Object.keys(visibleGroups).filter((k) => visibleGroups[k])
  const showEventsAndStations = true
  const showDensityEffective = showDensity && showEventsAndStations
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

    map.on("error", (e) => devLog("[Mapbox] error", { message: e.error?.message }))

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right")
    const emitBounds = () => {
      const b = map.getBounds()
      if (b) {
        const ne = b.getNorthEast()
        const sw = b.getSouthWest()
        onBoundsChange?.({ north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng })
      }
    }

    let moveendDebounceId: ReturnType<typeof setTimeout> | null = null
    const onMoveEnd = () => {
      if (moveendDebounceId) clearTimeout(moveendDebounceId)
      moveendDebounceId = setTimeout(() => {
        moveendDebounceId = null
        emitBounds()
      }, 250)
    }

    map.on("load", () => {
      devLog("[map] load event")
      emitReadyPhase("styleLoaded")
      map.setMaxBounds([
          [CDMX_BOUNDS.west, CDMX_BOUNDS.south],
          [CDMX_BOUNDS.east, CDMX_BOUNDS.north],
        ])
      onZoomChange?.(map.getZoom())
      emitBounds()
      setIsReady(true)
      devLog("[map] isReady=true")
    })
    map.on("zoomend", () => onZoomChange?.(map.getZoom()))
    map.on("moveend", onMoveEnd)
    mapRef.current = map
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize()
    })
    resizeObserver.observe(el)

    return () => {
      if (moveendDebounceId) clearTimeout(moveendDebounceId)
      map.off("moveend", onMoveEnd)
      resizeObserver.disconnect()
      emitReadyPhase("booting")
      setIsReady(false)
      hasCenteredSoulOnceRef.current = false
      waitingInitialCenterRef.current = false
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
  }, [mapStyle, projection, onReadyPhaseChange, onZoomChange, onBoundsChange])

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
    devLog("[landmarks] layers effect", { hasMap: !!mapRef.current, isReady })
    if (!mapRef.current || !isReady) return
    const map = mapRef.current

    const styleSupportsNativePrecipitation = mapStyle?.includes?.("mapbox/standard") ?? false

    const applyPrecipitation = () => {
      if (!styleSupportsNativePrecipitation) return
      requestAnimationFrame(() => {
        if (!mapRef.current?.isStyleLoaded()) return
        const m = mapRef.current
        try {
          const setRain = (m as { setRain?: (opt: Record<string, unknown>) => void }).setRain
          const setSnow = (m as { setSnow?: (opt: Record<string, unknown>) => void }).setSnow
          if (!setRain || !setSnow) return
          const zoomReveal = (val: number) =>
            ["interpolate", ["linear"], ["zoom"], 5, 0, 8, val] as unknown as [string, string, string, string, number, number, number]
          if (mapboxRain.enabled) {
            setRain({
              density: zoomReveal(0.5),
              intensity: 1.0,
              color: mapboxRain.color,
              opacity: 0.7,
              vignette: zoomReveal(1.0),
              "vignette-color": "#464646",
              direction: [0, 80],
              "droplet-size": [2.6, 18.2],
              "distortion-strength": 0.7,
              "center-thinning": 0,
            })
          } else {
            setRain({ density: 0, intensity: 0 })
          }
          if (mapboxSnow.enabled) {
            setSnow({
              density: zoomReveal(0.85),
              intensity: 1.0,
              "center-thinning": 0.1,
              direction: [0, 50],
              opacity: 1.0,
              color: mapboxSnow.color,
              "flake-size": 0.71,
              vignette: zoomReveal(0.3),
              "vignette-color": mapboxSnow.color,
            })
          } else {
            setSnow({ density: 0, intensity: 0 })
          }
        } catch {
          /* Native precipitation not supported */
        }
      })
    }

    const loadMapIcons = (): Promise<void> => {
      return Promise.all(
        SYMBOLS.map((symbol) => {
          if (map.hasImage(symbol)) return Promise.resolve()
          return new Promise<void>((resolve, reject) => {
            map.loadImage(`/icons/${symbol}@2x.png`, (err, image) => {
              if (err || !image) {
                reject(err ?? new Error(`Failed to load ${symbol}`))
                return
              }
              if (!map.hasImage(symbol)) {
                map.addImage(symbol, image, { pixelRatio: 2 })
              }
              resolve()
            })
          })
        })
      ).then(() => {})
    }

    const loadLandmarksFromApi = async (): Promise<void> => {
      devLog("[landmarks] loadLandmarksFromApi called")
      const supabase = createClient()
      const { data, error } = await supabase.rpc("get_landmarks")
      const list = (data ?? []) as LandmarkFromApi[]
      devLog("[landmarks] get_landmarks", { error: error?.message, count: list.length })
      setLandmarksListRef.current(list)
    }

    const addCustomLayers = () => {
      devLog("[landmarks] addCustomLayers", { styleLoaded: map.isStyleLoaded() })
      if (!map.isStyleLoaded()) return
      const initialBoundaryPaint = getBoundaryGlowPaints(boundaryGlow)
      const boundaryVisible = boundaryGlow.enabled ? "visible" : "none"

      if (!map.getSource(CDMX_BOUNDARY_SOURCE_ID)) {
        map.addSource(CDMX_BOUNDARY_SOURCE_ID, {
          type: "geojson",
          data: CDMX_BOUNDARY_GEOJSON_URL,
          buffer: 64,
        })
    }

    if (!map.getLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)) {
      map.addLayer({
        id: CDMX_BOUNDARY_VEIL_LAYER_ID,
        type: "fill",
        source: CDMX_BOUNDARY_SOURCE_ID,
        layout: { visibility: boundaryVisible },
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
        layout: { visibility: boundaryVisible },
        paint: {
          "line-color": "#8b7355",
          "line-opacity": initialBoundaryPaint.glowOpacity,
          "line-width": initialBoundaryPaint.glowWidth,
          "line-blur": initialBoundaryPaint.glowBlur,
        },
      })
    }

    if (!map.getLayer(CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID)) {
      map.addLayer({
        id: CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID,
        type: "line",
        source: CDMX_BOUNDARY_SOURCE_ID,
        layout: { visibility: boundaryVisible },
        paint: {
          "line-color": "rgba(74, 180, 200, 0.4)",
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 0.5,
            8, 0.45,
            10, 0.2,
            13, 0.35,
            16, 0.5,
            18, 0.55,
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 14,
            8, 12,
            10, 10,
            13, 16,
            16, 22,
            18, 28,
          ],
          "line-blur": 12,
        },
      })
    }

    if (!map.getLayer(CDMX_BOUNDARY_LINE_LAYER_ID)) {
      map.addLayer({
        id: CDMX_BOUNDARY_LINE_LAYER_ID,
        type: "line",
        source: CDMX_BOUNDARY_SOURCE_ID,
        layout: { visibility: boundaryVisible },
        paint: {
          "line-color": "#d4c9a8",
          "line-opacity": initialBoundaryPaint.lineOpacity,
          "line-width": initialBoundaryPaint.lineWidth,
        },
      })
    }

    // Geodata por grupo: un source + line/point layers por cada group_code visible.
    visibleGroupCodes.forEach((groupCode) => {
      const srcId = geodataSourceId(groupCode)
      if (!map.getSource(srcId)) {
        map.addSource(srcId, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        })
      }
      const visibleIds: string[] = Object.keys(visibleLayerGeodata[groupCode] ?? {}).filter(
        (id) => visibleLayerGeodata[groupCode][id] === true
      )
      const baseLineFilter: mapboxgl.Expression = ["all", ["==", ["get", "type"], "line"], ["==", ["get", "group"], groupCode]]
      const basePointFilter: mapboxgl.Expression = ["all", ["==", ["get", "type"], "point"], ["==", ["get", "group"], groupCode]]
      const layerIdFilter: mapboxgl.Expression = ["in", ["get", "layer_geodata_id"], ["literal", visibleIds]]
      const lineFilter: mapboxgl.Expression =
        ["all", baseLineFilter, layerIdFilter]
      const pointFilter: mapboxgl.Expression =
        ["all", basePointFilter, layerIdFilter]

      fetch(`/api/layer-geodata?group_code=${encodeURIComponent(groupCode)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Array<{ id: string; type: string; geojson?: { type?: string; features?: unknown[] } }>) => {
          const allFeatures: unknown[] = []
          ;(list ?? []).forEach((item) => {
            const layerGeodataId = String(item.id)
            const enrichLine = (f: { type?: string; geometry?: unknown; properties?: Record<string, unknown> }) => ({
              ...f,
              properties: {
                ...f.properties,
                group: groupCode,
                layer_geodata_id: layerGeodataId,
                type: "line" as const,
                feature_type: f.properties?.feature_type ?? "metro_line",
              },
            })
            const enrichPoint = (f: { type?: string; geometry?: unknown; properties?: Record<string, unknown> }) => ({
              ...f,
              properties: {
                ...f.properties,
                group: groupCode,
                layer_geodata_id: layerGeodataId,
                type: "point" as const,
                feature_type: f.properties?.feature_type ?? "geodata_point",
              },
            })
            if (item.type === "line") {
              const feats = item.geojson?.features ?? []
              allFeatures.push(...feats.map((f: { type?: string; geometry?: unknown; properties?: Record<string, unknown> }) => enrichLine(f)))
            }
            if (item.type === "point") {
              const feats = item.geojson?.features ?? []
              allFeatures.push(...feats.map((f: { type?: string; geometry?: unknown; properties?: Record<string, unknown> }) => enrichPoint(f)))
            }
          })
          const enriched = { type: "FeatureCollection" as const, features: allFeatures }
          const src = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined
          if (src) src.setData(enriched)
        })
        .catch(() => {})

      const visibility = "visible"
      const glowId = geodataLineGlowLayerId(groupCode)
      const lineId = geodataLineLayerId(groupCode)
      const pointsId = geodataPointsLayerId(groupCode)
      if (!map.getLayer(glowId)) {
        map.addLayer({
          id: glowId,
          type: "line",
          source: srcId,
          filter: lineFilter,
          layout: { visibility, "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#1a1a1a",
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 14, 14, 18, 18, 20],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 8, 18, 10],
            "line-opacity": 0.22,
          },
        })
      } else {
        map.setFilter(glowId, lineFilter)
        map.setLayoutProperty(glowId, "visibility", visibility)
      }
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: srcId,
          filter: lineFilter,
          layout: { visibility, "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["coalesce", ["get", "color"], "#666666"],
            "line-width": 4,
            "line-opacity": 0.9,
          },
        })
      } else {
        map.setFilter(lineId, lineFilter)
        map.setLayoutProperty(lineId, "visibility", visibility)
      }
      if (!map.getLayer(pointsId)) {
        map.addLayer({
          id: pointsId,
          type: "circle",
          source: srcId,
          filter: pointFilter,
          minzoom: 9,
          layout: { visibility },
          paint: {
            "circle-radius": 8,
            "circle-color": "rgba(0,163,224,0.6)",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "rgba(212,201,168,0.6)",
          },
        })
      } else {
        map.setFilter(pointsId, pointFilter)
        map.setLayoutProperty(pointsId, "visibility", visibility)
      }
    })

    // Ocultar capas de grupos que ya no están visibles.
    Object.keys(visibleGroups).forEach((groupCode) => {
      if (visibleGroups[groupCode]) return
      const hid = "none"
      ;[geodataLineGlowLayerId(groupCode), geodataLineLayerId(groupCode), geodataPointsLayerId(groupCode)].forEach((lid) => {
        if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", hid)
      })
    })

    // Events + stations: filtro por grupos visibles.
    if (!map.getSource(CDMX_EVENTS_SOURCE_ID)) {
      map.addSource(CDMX_EVENTS_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
    }
    const eventsStationsVisibility = visibleGroupCodes.length > 0 ? "visible" : "none"
    const groupFilter: mapboxgl.Expression =
      visibleGroupCodes.length > 0
        ? ["in", ["get", "group"], ["literal", visibleGroupCodes]]
        : ["==", ["get", "group"], ""]
    const stationFilter: mapboxgl.Expression = [
      "all",
      ["==", ["get", "type"], "point"],
      ["==", ["get", "feature_type"], "station"],
      groupFilter,
    ]
    const eventFilter: mapboxgl.Expression = [
      "all",
      ["==", ["get", "type"], "point"],
      ["==", ["get", "feature_type"], "event"],
      groupFilter,
    ]
    if (!map.getLayer(METRO_STATIONS_LAYER_ID)) {
      map.addLayer({
        id: METRO_STATIONS_LAYER_ID,
        type: "circle",
        source: CDMX_EVENTS_SOURCE_ID,
        minzoom: 9,
        layout: { visibility: eventsStationsVisibility },
        filter: stationFilter,
        paint: {
          "circle-radius": ["case", ["get", "hasStory"], 10, 8],
          "circle-color": ["case", ["get", "hasStory"], "rgba(0,163,224,0.85)", "rgba(0,163,224,0.5)"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(212,201,168,0.6)",
        },
      })
    } else {
      map.setLayoutProperty(METRO_STATIONS_LAYER_ID, "visibility", eventsStationsVisibility)
      map.setFilter(METRO_STATIONS_LAYER_ID, stationFilter)
    }
    if (!map.getLayer(EVENTS_LAYER_ID)) {
      map.addLayer({
        id: EVENTS_LAYER_ID,
        type: "symbol",
        source: CDMX_EVENTS_SOURCE_ID,
        minzoom: 12,
        filter: eventFilter,
        layout: {
          "icon-image": ["get", "symbol"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 15, 0.7, 18, 1],
          "icon-allow-overlap": false,
          "icon-ignore-placement": false,
        },
      })
    } else {
      map.setLayoutProperty(EVENTS_LAYER_ID, "visibility", eventsStationsVisibility)
      map.setFilter(EVENTS_LAYER_ID, eventFilter)
    }

    // Escenografía: descubrir capas del estilo con id escenografia-*
    const styleLayers = map.getStyle().layers ?? []
    const escenografiaIds = styleLayers.filter((l) => l.id.startsWith(ESCENOGRAFIA_PREFIX)).map((l) => ({ id: l.id }))
    if (escenografiaIds.length > 0) onEscenografiaLayersLoaded?.(escenografiaIds)

    // Keep aura layers above style layers.
    if (map.getLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)) map.moveLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)
    if (map.getLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)) map.moveLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)
    if (map.getLayer(CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID)) map.moveLayer(CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID)
    if (map.getLayer(CDMX_BOUNDARY_LINE_LAYER_ID)) map.moveLayer(CDMX_BOUNDARY_LINE_LAYER_ID)
    visibleGroupCodes.forEach((groupCode) => {
      ;[geodataLineGlowLayerId(groupCode), geodataLineLayerId(groupCode), geodataPointsLayerId(groupCode)].forEach((lid) => {
        if (map.getLayer(lid)) map.moveLayer(lid)
      })
    })
    if (map.getLayer(EVENTS_LAYER_ID)) map.moveLayer(EVENTS_LAYER_ID)
    if (map.getLayer(METRO_STATIONS_LAYER_ID)) map.moveLayer(METRO_STATIONS_LAYER_ID)

      applyPrecipitation()
    }

    const runLayersAndLandmarks = () => {
      devLog("[map] runLayersAndLandmarks")
      addCustomLayers()
      loadMapIcons().catch(() => {})
      loadLandmarksFromApi()
    }

    const onIdle = () => {
      devLog("[map] idle, running layers and landmarks")
      runLayersAndLandmarks()
      map.off("idle", onIdle)
    }
    if (map.isStyleLoaded()) {
      runLayersAndLandmarks()
    } else {
      devLog("[map] style not loaded, waiting for idle")
      map.once("idle", onIdle)
    }
    return () => map.off("idle", onIdle)
  }, [isReady, visibleGroups, visibleLayerGeodata, mapStyle, projection, boundaryGlow.enabled, mapboxRain.enabled, mapboxRain.color, mapboxSnow.enabled, mapboxSnow.color, onEscenografiaLayersLoaded])

  // Aplicar visibilidad de capas escenografía (estilo Mapbox).
  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    Object.entries(escenografiaVisible).forEach(([layerId, visible]) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none")
      }
    })
  }, [isReady, escenografiaVisible])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    const paint = getBoundaryGlowPaints(boundaryGlow)
    const visibility = boundaryGlow.enabled ? "visible" : "none"

    ;[CDMX_BOUNDARY_VEIL_LAYER_ID, CDMX_BOUNDARY_GLOW_LAYER_ID, CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID, CDMX_BOUNDARY_LINE_LAYER_ID].forEach((layerId) => {
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
    const map = mapRef.current
    const source = map.getSource(CDMX_EVENTS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (!source) return

    const geoJSON = buildEventsGeoJSON(
      events,
      metroStations,
      showEventsAndStations,
      showEventsAndStations,
      metroStories,
      visibleGroupCodes
    )
    source.setData(geoJSON)
  }, [events, metroStations, showEventsAndStations, metroStories, visibleGroupCodes, isReady])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    if (!map.getLayer(EVENTS_LAYER_ID)) return

    const sel = selectedEventId ?? ""
    map.setLayoutProperty(EVENTS_LAYER_ID, "icon-size", [
      "interpolate",
      ["linear"],
      ["zoom"],
      12,
      ["case", ["==", ["get", "eventId"], sel], 0.65, 0.5],
      15,
      ["case", ["==", ["get", "eventId"], sel], 0.9, 0.7],
      18,
      ["case", ["==", ["get", "eventId"], sel], 1.2, 1],
    ])
  }, [selectedEventId, isReady])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current

    const onEventsClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0]
      if (!f?.properties?.eventId) return
      e.preventDefault()
      onSelectEventRef.current((f.properties.eventId as string))
    }

    const onStationsClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0]
      const props = f?.properties
      if (!props?.stationId) return
      e.preventDefault()
      const hasStory = props.hasStory === true || props.hasStory === "true"
      const storyId = String(props.storyId ?? "")
      if (hasStory && storyId && onSelectMetroStoryRef.current) {
        onSelectMetroStoryRef.current(storyId)
      } else if (onSelectStationRef.current) {
        onSelectStationRef.current(props.stationId as string)
      }
    }

    map.on("click", EVENTS_LAYER_ID, onEventsClick)
    map.on("click", METRO_STATIONS_LAYER_ID, onStationsClick)
    map.getCanvas().style.cursor = ""
    const onEventsEnter = () => { map.getCanvas().style.cursor = "pointer" }
    const onEventsLeave = () => { map.getCanvas().style.cursor = "" }
    map.on("mouseenter", EVENTS_LAYER_ID, onEventsEnter)
    map.on("mouseleave", EVENTS_LAYER_ID, onEventsLeave)
    map.on("mouseenter", METRO_STATIONS_LAYER_ID, onEventsEnter)
    map.on("mouseleave", METRO_STATIONS_LAYER_ID, onEventsLeave)
    return () => {
      map.off("click", EVENTS_LAYER_ID, onEventsClick)
      map.off("click", METRO_STATIONS_LAYER_ID, onStationsClick)
      map.off("mouseenter", EVENTS_LAYER_ID, onEventsEnter)
      map.off("mouseleave", EVENTS_LAYER_ID, onEventsLeave)
      map.off("mouseenter", METRO_STATIONS_LAYER_ID, onEventsEnter)
      map.off("mouseleave", METRO_STATIONS_LAYER_ID, onEventsLeave)
    }
  }, [isReady])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    if (!map.getLayer(METRO_STATIONS_LAYER_ID)) return
    const visibility = visibleGroupCodes.length > 0 ? "visible" : "none"
    map.setLayoutProperty(METRO_STATIONS_LAYER_ID, "visibility", visibility)
  }, [isReady, visibleGroupCodes.length])

  useEffect(() => {
    if (!mapRef.current || !isReady) return
    const map = mapRef.current
    if (!map.getLayer(EVENTS_LAYER_ID)) return
    const visibility = showEventsAndStations ? "visible" : "none"
    map.setLayoutProperty(EVENTS_LAYER_ID, "visibility", visibility)
  }, [isReady, showEventsAndStations])

  useEffect(() => {
    const map = mapRef.current
    const list = landmarksList
    const idsInList = new Set(list.map((lm) => lm.id))
    devLog("[map] landmarks effect run", { hasMap: !!map, isReady, listLength: list.length, ids: list.map((l) => l.id) })

    if (!map || !isReady) {
      const n = landmarksMarkersMapRef.current.size
      landmarksMarkersMapRef.current.forEach(({ marker, root }) => {
        marker.remove()
        root.unmount()
      })
      landmarksMarkersMapRef.current.clear()
      if (n > 0) devLog("[map] landmarks cleared (no map/ready), was", n)
      return
    }

    const mapRef_ = landmarksMarkersMapRef.current

    // Quitar marcadores que ya no están en la lista
    mapRef_.forEach((obj, id) => {
      if (!idsInList.has(id)) {
        obj.marker.remove()
        obj.root.unmount()
        mapRef_.delete(id)
        devLog("[map] landmark marker removed", id)
      }
    })

    // Si no hay landmarks, listo
    if (list.length === 0) return

    // Añadir o actualizar marcador por cada landmark
    list.forEach((lm) => {
      const existing = mapRef_.get(lm.id)
      const renderContent = () => (
        <LandmarkParticleIcon
          id={lm.id}
          iconUrl={lm.icon_url || ""}
          iconSvgUrl={lm.icon_svg_url}
          name={lm.name}
          onClick={() =>
            onLandmarkClickRef.current?.(lm.name, lm.icon_url || "", lm.icon_svg_url)
          }
          particlesEnabled={false}
        />
      )

      if (existing) {
        devLog("[map] landmark update", { id: lm.id, hasSvg: !!lm.icon_svg_url })
        existing.marker.setLngLat([lm.lng, lm.lat])
        existing.root.render(renderContent())
      } else {
        devLog("[map] landmark add", { id: lm.id, hasSvg: !!lm.icon_svg_url })
        const div = document.createElement("div")
        const root = createRoot(div)
        root.render(renderContent())
        const marker = new mapboxgl.Marker({ element: div })
          .setLngLat([lm.lng, lm.lat])
          .addTo(map)
        mapRef_.set(lm.id, { marker, root, div })
      }
    })

    return () => {
      devLog("[map] landmarks effect cleanup", { count: mapRef_.size })
      const entries = Array.from(mapRef_.entries())
      mapRef_.clear()
      entries.forEach(([, { marker, root }]) => {
        marker.remove()
        queueMicrotask(() => root.unmount())
      })
    }
  }, [isReady, landmarksList])

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

    if (showDensityEffective && events.length > 0) {
      if (!mapRef.current.getSource(heatmapSourceId)) {
        mapRef.current.addSource(heatmapSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: events.map((e) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [roundCoord(e.coords.lng), roundCoord(e.coords.lat)],
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
              coordinates: [roundCoord(e.coords.lng), roundCoord(e.coords.lat)],
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

    // Keep CDMX aura and point layers above heatmap when density layer is toggled/updated.
    if (mapRef.current.getLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)) mapRef.current.moveLayer(CDMX_BOUNDARY_VEIL_LAYER_ID)
    if (mapRef.current.getLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)) mapRef.current.moveLayer(CDMX_BOUNDARY_GLOW_LAYER_ID)
    if (mapRef.current.getLayer(CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID)) mapRef.current.moveLayer(CDMX_BOUNDARY_PORTAL_GLOW_LAYER_ID)
    if (mapRef.current.getLayer(CDMX_BOUNDARY_LINE_LAYER_ID)) mapRef.current.moveLayer(CDMX_BOUNDARY_LINE_LAYER_ID)
    visibleGroupCodes.forEach((groupCode) => {
      ;[geodataLineGlowLayerId(groupCode), geodataLineLayerId(groupCode), geodataPointsLayerId(groupCode)].forEach((lid) => {
        if (mapRef.current?.getLayer(lid)) mapRef.current.moveLayer(lid)
      })
    })
    if (mapRef.current.getLayer(EVENTS_LAYER_ID)) mapRef.current.moveLayer(EVENTS_LAYER_ID)
    if (mapRef.current.getLayer(METRO_STATIONS_LAYER_ID)) mapRef.current.moveLayer(METRO_STATIONS_LAYER_ID)
  }, [showDensityEffective, events, isReady, visibleGroups])

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

  const styleSupportsNativePrecipitation = mapStyle?.includes?.("mapbox/standard") ?? false
  const showMist = cfg?.overlays?.mist ?? false
  const showVignette = cfg?.overlays?.vignette ?? false
  const showAtmospheric = cfg?.overlays?.atmospheric ?? false
  const showRain =
    (cfg?.overlays?.rain ?? false) || (mapboxRain.enabled && !styleSupportsNativePrecipitation)
  const showSnow = mapboxSnow.enabled && !styleSupportsNativePrecipitation
  const zoomOverlayFactor = interpolateZoomFactor(zoom)
  const mistOpacity = ((cfg?.opacity?.mist ?? 50) / 100) * zoomOverlayFactor
  const vignetteOpacity = ((cfg?.opacity?.vignette ?? 100) / 100) * zoomOverlayFactor
  const atmosphericOpacity = ((cfg?.opacity?.atmospheric ?? 80) / 100) * zoomOverlayFactor
  const rainOpacity = (cfg?.opacity?.rain ?? 65) / 100

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
          style={{ width: "100%", height: "100%", position: "relative", zIndex: 0 }}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 20 }}
          aria-hidden
        >
          {showMist && (
            <div
              className="absolute inset-0"
              aria-hidden
              style={{
                background: `
                  radial-gradient(ellipse 60% 45% at 38% 52%, rgba(26,48,64,0.45) 0%, transparent 70%),
                  radial-gradient(ellipse 50% 40% at 72% 35%, rgba(30,43,40,0.35) 0%, transparent 65%),
                  radial-gradient(ellipse 40% 30% at 55% 75%, rgba(17,24,32,0.4) 0%, transparent 60%)
                `,
                opacity: mistOpacity,
              }}
            />
          )}

          {showVignette && (
            <div
              className="absolute inset-0"
              aria-hidden
              style={{
                background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 50%, rgba(5,8,10,0.7) 100%)",
                opacity: vignetteOpacity,
              }}
            />
          )}

          {showAtmospheric && (
            <AtmosphericOverlay zoom={zoom} opacity={atmosphericOpacity} />
          )}

          {showRain && <RainOverlay opacity={rainOpacity} />}
          {showSnow && <SnowOverlay opacity={0.6} />}
        </div>
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
  if (zoom <= 10) return 0.85
  if (zoom >= 18) return 0.2
  if (zoom <= 14) return lerp(0.85, 0.7, (zoom - 10) / 4)
  return lerp(0.7, 0.2, (zoom - 14) / 4)
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
      5, 0.06 * veilScale,
      8, 0.08 * veilScale,
      10, 0.02 * veilScale,
      13, 0.045 * veilScale,
      16, 0.08 * veilScale,
      18, 0.12 * veilScale,
    ],
    glowOpacity: [
      "interpolate",
      ["linear"],
      ["zoom"],
      5, 0.7 * glowScale,
      8, 0.65 * glowScale,
      10, 0.35 * glowScale,
      13, 0.55 * glowScale,
      16, 0.78 * glowScale,
      18, 0.96 * glowScale,
    ],
    glowWidth: [
      "interpolate",
      ["linear"],
      ["zoom"],
      5, glowWidth * 0.5,
      8, glowWidth * 0.45,
      10, glowWidth * 0.35,
      13, glowWidth * 0.6,
      16, glowWidth * 0.9,
      18, glowWidth * 1.12,
    ],
    glowBlur: [
      "interpolate",
      ["linear"],
      ["zoom"],
      5, glowBlur * 0.8,
      8, glowBlur * 0.7,
      10, glowBlur * 0.4,
      13, glowBlur * 0.65,
      16, glowBlur * 0.9,
      18, glowBlur * 1.08,
    ],
    lineOpacity: [
      "interpolate",
      ["linear"],
      ["zoom"],
      5, 0.9 * lineScale,
      8, 0.85 * lineScale,
      10, 0.45 * lineScale,
      13, 0.66 * lineScale,
      16, 0.88 * lineScale,
      18, 1 * lineScale,
    ],
    lineWidth: [
      "interpolate",
      ["linear"],
      ["zoom"],
      5, lineWidth * 0.9,
      8, lineWidth * 0.75,
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
