"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { MapboxOverlay } from "@deck.gl/mapbox"
import { ScatterplotLayer } from "@deck.gl/layers"
import { CDMX_BOUNDS, CDMX_CENTER } from "@/lib/map-bounds"
import { validateColor } from "@/lib/validate-color"
import { GEO_POINT_ID_KEY } from "@/lib/geo-point-id"

const EDITOR_FLOW_TIME_MAX = 1.2
const EDITOR_FLOW_TIME_MAX_LOOP = 3
const EDITOR_FLOW_REPEATS = 3
const EDITOR_FLOW_DEVIATION_SCALE = 0.00015
const EDITOR_FLOW_JITTER_SCALE = 0.00002

function extendPathForConstantFlow(path: [number, number][], phase: number): { path: [number, number][]; timestamps: number[] } {
  if (path.length < 2) return { path, timestamps: path.map((_, i) => i / (path.length - 1 || 1) + phase) }
  const n = path.length
  const extendedPath: [number, number][] = [...path]
  const extendedTimestamps: number[] = path.map((_, i) => i / (n - 1) + phase)
  for (let r = 1; r < EDITOR_FLOW_REPEATS; r++) {
    for (let i = 1; i < n; i++) {
      extendedPath.push(path[i])
      extendedTimestamps.push(r + i / (n - 1) + phase)
    }
  }
  return { path: extendedPath, timestamps: extendedTimestamps }
}

type FlowParticleDatum = { position: [number, number]; color: [number, number, number]; radius: number }

/** Partícula persistente: path propio, fase, tamaño y velocidad (más grande = más lenta). */
type FlowParticleDef = {
  offsetPath: [number, number][]
  timestamps: number[]
  phase: number
  radius: number
  speedFactor: number
  color: [number, number, number]
}

function interpolatePathPosition(path: [number, number][], timestamps: number[], t: number): [number, number] | null {
  if (path.length < 2 || timestamps.length !== path.length) return null
  const n = path.length - 1
  if (t <= timestamps[0]) return path[0]
  if (t >= timestamps[n]) return path[n]
  for (let i = 0; i < n; i++) {
    if (t >= timestamps[i] && t <= timestamps[i + 1]) {
      const d = timestamps[i + 1] - timestamps[i]
      const f = d > 0 ? (t - timestamps[i]) / d : 0
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f]
    }
  }
  return null
}

function hexToRgb(hex: string): [number, number, number] {
  if (hex == null || typeof hex !== "string" || !hex.trim()) {
    throw new Error("Color requerido para efecto flow")
  }
  const s = hex.trim()
  const m6 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(s)
  if (m6) return [parseInt(m6[1], 16), parseInt(m6[2], 16), parseInt(m6[3], 16)]
  const m3 = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(s)
  if (m3) return [parseInt(m3[1] + m3[1], 16), parseInt(m3[2] + m3[2], 16), parseInt(m3[3] + m3[3], 16)]
  const rgb = /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(s)
  if (rgb) return [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)]
  throw new Error(`Color inválido: "${hex}" (use #RRGGBB, #RGB o rgb(r,g,b))`)
}

/** Valor determinista en [-1, 1] sin sin/cos para evitar ondas visibles. */
function flowHashUnit(particleIndex: number, vertexIndex: number): number {
  let h = (particleIndex * 7919 + vertexIndex * 7877) >>> 0
  h = (h ^ (h >>> 16)) * 0x85ebca6b
  h = (h ^ (h >>> 13)) * 0xc2b2ae35
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

/** bandWidthScale: ancho de banda (p. ej. lineWidth/4). Partículas se distribuyen en una banda perpendicular al path. */
function offsetPath(path: [number, number][], deviation: number, particleIndex: number, bandWidthScale = 1): [number, number][] {
  if (path.length < 2 || (deviation <= 0 && bandWidthScale <= 0)) return path
  const scale = Math.max(0, bandWidthScale) * EDITOR_FLOW_DEVIATION_SCALE * (deviation || 1)
  if (scale <= 0) return path
  const out: [number, number][] = []
  for (let i = 0; i < path.length; i++) {
    const [lng, lat] = path[i]
    let dx = 0, dy = 0
    if (i < path.length - 1) {
      const next = path[i + 1]
      dx = next[0] - lng
      dy = next[1] - lat
    } else if (i > 0) {
      const prev = path[i - 1]
      dx = lng - prev[0]
      dy = lat - prev[1]
    }
    const len = Math.hypot(dx, dy) || 1
    const u = flowHashUnit(particleIndex, i)
    const perpLng = (-dy / len) * scale * u
    const perpLat = (dx / len) * scale * u
    out.push([lng + perpLng, lat + perpLat])
  }
  return out
}

/** Timestamps 0..1 por longitud de arco y curvatura: en curvas se avanza más lento. */
function pathToTimestamps(path: [number, number][], curvatureWeight = 0.4): number[] {
  if (path.length < 2) return path.map((_, i) => i)
  const n = path.length
  const costs: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6
    let curvature = 0
    if (i > 0 && i + 2 < n) {
      const p0 = path[i - 1]
      const p1 = path[i]
      const p2 = path[i + 1]
      const p3 = path[i + 2]
      const d1x = p1[0] - p0[0], d1y = p1[1] - p0[1]
      const d2x = p2[0] - p1[0], d2y = p2[1] - p1[1]
      const d3x = p3[0] - p2[0], d3y = p3[1] - p2[1]
      const l1 = Math.hypot(d1x, d1y) || 1
      const l2 = Math.hypot(d2x, d2y) || 1
      const l3 = Math.hypot(d3x, d3y) || 1
      const ang1 = Math.atan2(d2y / l2 - d1y / l1, d2x / l2 - d1x / l1)
      const ang2 = Math.atan2(d3y / l3 - d2y / l2, d3x / l3 - d2x / l2)
      curvature = Math.abs(ang1) + Math.abs(ang2)
    }
    costs.push(len * (1 + curvatureWeight * curvature))
  }
  const total = costs.reduce((s, c) => s + c, 0) || 1
  const out: number[] = [0]
  let acc = 0
  for (let i = 0; i < costs.length; i++) {
    acc += costs[i]
    out.push(acc / total)
  }
  return out
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

const EDITOR_SOURCE_ID = "geodata-editor-source"
const EDITOR_POINTS_LAYER_ID = "geodata-editor-points"
const EDITOR_LINE_LAYER_ID = "geodata-editor-line"
const EDITOR_FILL_LAYER_ID = "geodata-editor-fill"
const EDITOR_DRAWING_SOURCE_ID = "geodata-editor-drawing-source"
const EDITOR_DRAWING_FILL_LAYER_ID = "geodata-editor-drawing-fill"
const EDITOR_DRAWING_LINE_LAYER_ID = "geodata-editor-drawing-line"

type GeoJSONFeature = {
  type: "Feature"
  geometry: { type: string; coordinates: unknown }
  properties?: Record<string, unknown>
}

type GeoJSONFeatureCollection = {
  type: "FeatureCollection"
  features: GeoJSONFeature[]
}

type LayerGeodataItem = {
  id: string
  name: string
  type: string
  group_id: string
  geojson?: { type?: string; features?: GeoJSONFeature[] }
}

function mergeGeodataToFeatureCollection(items: LayerGeodataItem[]): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = []
  items.forEach((item) => {
    const list = item.geojson?.features ?? []
    const layerGeodataId = item.id
    list.forEach((f) => {
      if (f.type !== "Feature" || !f.geometry) return
      features.push({
        ...f,
        properties: { ...f.properties, layer_geodata_id: layerGeodataId },
      })
    })
  })
  return { type: "FeatureCollection", features }
}

function getBoundsFromFeatures(fc: GeoJSONFeatureCollection): [[number, number], [number, number]] | null {
  if (!fc.features?.length) return null
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  const expand = (coord: number[]) => {
    const lng = Number(coord[0]), lat = Number(coord[1])
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
  }
  const expandCoords = (coords: unknown): void => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") expand(coords as number[])
      else coords.forEach(expandCoords)
    }
  }
  fc.features.forEach((f) => {
    const g = f.geometry
    if (g?.coordinates) expandCoords(g.coordinates)
  })
  if (minLng === Infinity) return null
  const pad = 0.005
  return [[minLng - pad, minLat - pad], [maxLng + pad, maxLat + pad]]
}

const DEFAULT_STROKE = "#0a9bb3"
const DEFAULT_FILL = "#0a9bb3"
const DEFAULT_FILL_OPACITY = 0.35

/** Mapbox fill-color no acepta hex con alpha; devuelve color sólido. Valida antes. */
function toSolidFillColor(hex: string): string {
  validateColor(hex)
  if (/^#[0-9A-Fa-f]{8}$/.test(hex.trim())) return hex.trim().slice(0, 7)
  return hex.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

type EditingLayer = {
  id: string
  name: string
  type: string
  geojson: { type: string; features: Array<{ geometry: { type: string; coordinates: number[][] | number[][][] }; properties?: Record<string, unknown> }> }
}

interface GeodataEditorMapProps {
  /** Para guardar nuevos: categoría (group_id). Requerido al crear. */
  groupId?: string | null
  /** Para cargar: filtrar por grupo. null = cargar todo el geodata. */
  groupCode?: string | null
  /** Capa seleccionada para trabajar (añadir puntos, unirlos). En drawLine solo se aceptan puntos de esta capa. */
  selectedLayerId?: string | null
  /** group_id de la capa seleccionada; se usa al guardar la línea creada desde «Unir puntos». */
  selectedLayerGroupId?: string | null
  /** Tipo de la capa seleccionada (point/line/polygon). */
  selectedLayerType?: string | null
  onSaved?: () => void
  /** Cuando se edita una línea/polígono existente, carga su geometría en el editor. */
  editingLayer?: EditingLayer | null
  /** Llamado al cancelar la edición (el padre debe limpiar editingLayer). */
  onCancelEdit?: () => void
  onPointSelect?: (params: {
    layerGeodataId: string
    /** Identidad estable del punto en el GeoJSON (properties.geo_point_id) */
    geo_point_id: string
    featureIndex: number
    name: string
    label: string
    coordinates: [number, number]
    location_container_id?: string | null
    geojson: { type: "FeatureCollection"; features: GeoJSONFeature[] }
  }) => void
  className?: string
  /** Si true, opciones (botones + formulario) a la izquierda y mapa a la derecha en 2 columnas. */
  layoutThreeColumns?: boolean
  /** Items ya cargados (p. ej. desde admin). Si se pasan, no se hace fetch y se usan estos. */
  items?: LayerGeodataItem[] | null
}

export function GeodataEditorMap({
  groupId = null,
  groupCode = null,
  selectedLayerId = null,
  selectedLayerGroupId = null,
  selectedLayerType = null,
  onSaved,
  editingLayer = null,
  onCancelEdit,
  onPointSelect,
  className = "",
  layoutThreeColumns = false,
  items: itemsProp = null,
}: GeodataEditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null)
  const deckOverlayRef = useRef<InstanceType<typeof MapboxOverlay> | null>(null)
  const [items, setItems] = useState<LayerGeodataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<"select" | "drawLine">("select")
  const [drawingPoints, setDrawingPoints] = useState<number[][]>([])
  const [lineName, setLineName] = useState("")
  const [lineStrokeColor, setLineStrokeColor] = useState(DEFAULT_STROKE)
  const [lineFillColor, setLineFillColor] = useState(DEFAULT_FILL)
  const [lineFillOpacity, setLineFillOpacity] = useState(DEFAULT_FILL_OPACITY)
  const [closeLine, setCloseLine] = useState(false)
  const [lineWidth, setLineWidth] = useState(4)
  const [lineEffect, setLineEffect] = useState<"" | "glow" | "dashed" | "flow">("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [flowParticleCount, setFlowParticleCount] = useState(500)
  const [flowPathDeviation, setFlowPathDeviation] = useState(0.3)
  const [flowTrailLength, setFlowTrailLength] = useState(0.02)
  const [flowAnimating, setFlowAnimating] = useState(true)
  const [flowConstantFlow, setFlowConstantFlow] = useState(true)
  const [flowWidthMinPixels, setFlowWidthMinPixels] = useState(1.5)
  const [flowWidthMaxPixels, setFlowWidthMaxPixels] = useState(4)
  const [flowWidthScale, setFlowWidthScale] = useState(1)
  const [flowFadeTrail, setFlowFadeTrail] = useState(true)
  const [flowCapRounded, setFlowCapRounded] = useState(true)
  const [flowJointRounded, setFlowJointRounded] = useState(true)
  const [flowBillboard, setFlowBillboard] = useState(false)
  const [flowMiterLimit, setFlowMiterLimit] = useState(4)
  const [flowTime, setFlowTime] = useState(0)
  const [flowFps, setFlowFps] = useState<number | null>(null)
  const [flowJitter, setFlowJitter] = useState(0.5)
  const [flowWindStyleWhite, setFlowWindStyleWhite] = useState(false)
  const flowWindStyleWhiteRef = useRef(flowWindStyleWhite)
  flowWindStyleWhiteRef.current = flowWindStyleWhite
  const flowFpsSetRef = useRef(setFlowFps)
  flowFpsSetRef.current = setFlowFps
  const flowFpsFrameCountRef = useRef(0)
  const flowFpsLastTimeRef = useRef(performance.now())
  const flowJitterRef = useRef(flowJitter)
  flowJitterRef.current = flowJitter
  const flowTimeRef = useRef(0)
  flowTimeRef.current = flowTime
  const flowParticleCountRef = useRef(flowParticleCount)
  const flowPathDeviationRef = useRef(flowPathDeviation)
  const flowTrailLengthRef = useRef(flowTrailLength)
  const flowAnimatingRef = useRef(flowAnimating)
  const flowConstantFlowRef = useRef(flowConstantFlow)
  const flowWidthMinPixelsRef = useRef(flowWidthMinPixels)
  const flowWidthMaxPixelsRef = useRef(flowWidthMaxPixels)
  const flowWidthScaleRef = useRef(flowWidthScale)
  const flowFadeTrailRef = useRef(flowFadeTrail)
  const flowCapRoundedRef = useRef(flowCapRounded)
  const flowJointRoundedRef = useRef(flowJointRounded)
  const flowBillboardRef = useRef(flowBillboard)
  const flowMiterLimitRef = useRef(flowMiterLimit)
  const editorParticleSystemsRef = useRef<{
    config: { pathLen: number; colorKey: string; N: number; deviation: number; wMin: number; wMax: number; bandWidthScale: number }
    particles: FlowParticleDef[]
  } | null>(null)
  flowParticleCountRef.current = flowParticleCount
  flowPathDeviationRef.current = flowPathDeviation
  flowTrailLengthRef.current = flowTrailLength
  flowAnimatingRef.current = flowAnimating
  flowConstantFlowRef.current = flowConstantFlow
  flowWidthMinPixelsRef.current = flowWidthMinPixels
  flowWidthMaxPixelsRef.current = flowWidthMaxPixels
  flowWidthScaleRef.current = flowWidthScale
  flowFadeTrailRef.current = flowFadeTrail
  flowCapRoundedRef.current = flowCapRounded
  flowJointRoundedRef.current = flowJointRounded
  flowBillboardRef.current = flowBillboard
  flowMiterLimitRef.current = flowMiterLimit
  flowJitterRef.current = flowJitter

  const loadGeodata = useCallback(async () => {
    const url = groupCode
      ? `/api/layer-geodata?group_code=${encodeURIComponent(groupCode)}`
      : "/api/layer-geodata"
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) ?? []
      setItems(data)
    }
    setLoading(false)
  }, [groupCode])

  const useExternalItems = itemsProp != null
  const effectiveItems = useExternalItems ? itemsProp : items

  useEffect(() => {
    if (useExternalItems) {
      setLoading(false)
      return
    }
    setLoading(true)
    loadGeodata()
  }, [loadGeodata, useExternalItems])

  useEffect(() => {
    if (!editingLayer?.geojson?.features?.length) return
    const feat = editingLayer.geojson.features[0]
    const geom = feat?.geometry
    if (!geom?.coordinates) return
    let coords: number[][]
    let isPoly = false
    if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
      coords = geom.coordinates as number[][]
    } else if (geom.type === "Polygon" && Array.isArray(geom.coordinates) && geom.coordinates[0]?.length) {
      const ring = geom.coordinates[0] as number[][]
      coords = ring[0]?.every((c, i) => c === ring[ring.length - 1]?.[i]) ? ring.slice(0, -1) : ring
      isPoly = true
    } else {
      return
    }
    if (coords.length < 2) return
    const props = feat?.properties ?? {}
    setDrawingPoints(coords)
    setLineName((props.name as string) ?? editingLayer.name ?? "Línea")
    setLineStrokeColor((props.color as string) ?? DEFAULT_STROKE)
    setLineFillColor((props.fillColor as string) ?? DEFAULT_FILL)
    setLineFillOpacity(Number.isFinite(Number(props.fillOpacity)) ? Number(props.fillOpacity) : DEFAULT_FILL_OPACITY)
    setLineWidth(Number.isFinite(Number(props.lineWidth)) ? Number(props.lineWidth) : 4)
    setLineEffect((props.effect as "" | "glow" | "dashed" | "flow") ?? "")
    setCloseLine(isPoly)
    setMode("drawLine")
  }, [editingLayer])

  const mergedGeoJSON = mergeGeodataToFeatureCollection(
    editingLayer ? effectiveItems.filter((i) => i.id !== editingLayer.id) : effectiveItems
  )
  const pointFeatures = mergedGeoJSON.features.filter((f) => f.geometry?.type === "Point")
  const lineFeatures = mergedGeoJSON.features.filter((f) => f.geometry?.type === "LineString")
  const polygonFeatures = mergedGeoJSON.features.filter((f) => f.geometry?.type === "Polygon")

  useEffect(() => {
    const el = containerRef.current
    if (!el || !mapboxgl.accessToken) return

    const map = new mapboxgl.Map({
      container: el,
      style: "mapbox://styles/mapbox/light-v11",
      center: CDMX_CENTER,
      zoom: 10,
      maxBounds: [
        [CDMX_BOUNDS.west, CDMX_BOUNDS.south],
        [CDMX_BOUNDS.east, CDMX_BOUNDS.north],
      ],
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right")
    mapRef.current = map

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)

    map.once("load", () => {
      setMapReady(true)
      map.fitBounds(
        [
          [CDMX_BOUNDS.west, CDMX_BOUNDS.south],
          [CDMX_BOUNDS.east, CDMX_BOUNDS.north],
        ],
        { padding: 24, duration: 0, maxZoom: 12 }
      )
      if (!deckOverlayRef.current) {
        const overlay = new MapboxOverlay({ interleaved: true, layers: [] })
        map.addControl(overlay)
        deckOverlayRef.current = overlay
      }
    })

    return () => {
      setMapReady(false)
      const overlay = deckOverlayRef.current
      if (overlay && mapRef.current) {
        mapRef.current.removeControl(overlay)
        if ("finalize" in overlay && typeof overlay.finalize === "function") overlay.finalize()
        deckOverlayRef.current = null
      }
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const pointData: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: pointFeatures,
    }
    const lineData: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: lineFeatures,
    }
    const polygonData: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: polygonFeatures,
    }

    if (!map.getSource(EDITOR_SOURCE_ID)) {
      map.addSource(EDITOR_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
    }
    const allFeatures = [...pointFeatures, ...lineFeatures, ...polygonFeatures]
    ;(map.getSource(EDITOR_SOURCE_ID) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: allFeatures,
    })

    ;[EDITOR_FILL_LAYER_ID, EDITOR_LINE_LAYER_ID, EDITOR_POINTS_LAYER_ID].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id)
    })

    map.addLayer({
      id: EDITOR_FILL_LAYER_ID,
      type: "fill",
      source: EDITOR_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": ["to-color", ["coalesce", ["get", "fillColor"], ["get", "color"], "#0a9bb3"]],
        "fill-opacity": ["coalesce", ["get", "fillOpacity"], 0.35],
        "fill-outline-color": ["to-color", ["coalesce", ["get", "color"], "#0a9bb3"]],
      },
    })
    map.addLayer({
      id: EDITOR_LINE_LAYER_ID,
      type: "line",
      source: EDITOR_SOURCE_ID,
      filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["to-color", ["coalesce", ["get", "color"], "#0a9bb3"]],
        "line-width": 3,
        "line-opacity": 0.9,
      },
    })
    map.addLayer({
      id: EDITOR_POINTS_LAYER_ID,
      type: "circle",
      source: EDITOR_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 10,
        "circle-color": ["to-color", ["coalesce", ["get", "color"], "#00a3e0"]],
        "circle-stroke-width": 2,
        "circle-stroke-color": ["to-color", ["coalesce", ["get", "color"], "#d4c9a8"]],
      },
    })

    const bounds = getBoundsFromFeatures(mergedGeoJSON)
    if (bounds && allFeatures.length > 0) map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 300 })
  }, [effectiveItems, pointFeatures.length, lineFeatures.length, polygonFeatures.length, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || mode !== "drawLine") return

    if (!map.getSource(EDITOR_DRAWING_SOURCE_ID)) {
      map.addSource(EDITOR_DRAWING_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
    }

    const hasPolygon = closeLine && drawingPoints.length >= 3
    const drawingData =
      drawingPoints.length < 2
        ? { type: "FeatureCollection" as const, features: [] }
        : {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                geometry: {
                  type: hasPolygon ? "Polygon" : "LineString",
                  coordinates: hasPolygon ? [[...drawingPoints, drawingPoints[0]]] : drawingPoints,
                },
                properties: {},
              },
            ],
          }
    ;(map.getSource(EDITOR_DRAWING_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(drawingData)

    if (!map.getLayer(EDITOR_DRAWING_LINE_LAYER_ID)) {
      map.addLayer({
        id: EDITOR_DRAWING_LINE_LAYER_ID,
        type: "line",
        source: EDITOR_DRAWING_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": toSolidFillColor(lineStrokeColor),
          "line-width": lineWidth,
          "line-opacity": 0.9,
          "line-dasharray": lineEffect === "dashed" ? [4, 2] : lineEffect === "flow" ? [8, 4] : [1, 0],
        },
      })
    }
    map.setPaintProperty(EDITOR_DRAWING_LINE_LAYER_ID, "line-color", toSolidFillColor(lineStrokeColor))
    map.setPaintProperty(EDITOR_DRAWING_LINE_LAYER_ID, "line-width", lineWidth)
    map.setPaintProperty(EDITOR_DRAWING_LINE_LAYER_ID, "line-dasharray", lineEffect === "dashed" ? [4, 2] : lineEffect === "flow" ? [8, 4] : [1, 0])
    const lineVisibility = lineEffect === "flow" ? "none" : "visible"
    if (map.getLayer(EDITOR_DRAWING_LINE_LAYER_ID)) {
      map.setLayoutProperty(EDITOR_DRAWING_LINE_LAYER_ID, "visibility", lineVisibility)
    }

    if (!map.getLayer(EDITOR_DRAWING_FILL_LAYER_ID)) {
      map.addLayer(
        {
          id: EDITOR_DRAWING_FILL_LAYER_ID,
          type: "fill",
          source: EDITOR_DRAWING_SOURCE_ID,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "fill-color": toSolidFillColor(lineFillColor),
            "fill-opacity": lineFillOpacity,
            "fill-outline-color": toSolidFillColor(lineStrokeColor),
          },
        },
        EDITOR_DRAWING_LINE_LAYER_ID
      )
    }
    map.setPaintProperty(EDITOR_DRAWING_FILL_LAYER_ID, "fill-color", toSolidFillColor(lineFillColor))
    map.setPaintProperty(EDITOR_DRAWING_FILL_LAYER_ID, "fill-opacity", lineFillOpacity)
    map.setPaintProperty(EDITOR_DRAWING_FILL_LAYER_ID, "fill-outline-color", toSolidFillColor(lineStrokeColor))
  }, [mode, drawingPoints, closeLine, lineStrokeColor, lineFillColor, lineFillOpacity, lineWidth, lineEffect])

  // Animación partículas (ScatterplotLayer): simulación por partícula con path propio, fase, tamaño y velocidad.
  useEffect(() => {
    const map = mapRef.current
    const overlay = deckOverlayRef.current
    if (!map || !overlay || lineEffect !== "flow" || drawingPoints.length < 2) {
      if (overlay) overlay.setProps({ layers: [] })
      map?.triggerRepaint?.()
      editorParticleSystemsRef.current = null
      return
    }
    const path = drawingPoints as [number, number][]
    const color = hexToRgb(lineStrokeColor)
    let rafId = 0

    function ensureEditorParticlesInitialized() {
      const N = Math.max(1, Math.min(2000, flowParticleCountRef.current))
      const deviation = flowPathDeviationRef.current
      const bandWidthScale = lineWidth / 4
      const wMin = flowWidthMinPixelsRef.current
      const wMax = Math.max(wMin + 0.25, flowWidthMaxPixelsRef.current)
      const colorKey = color.join(",")
      const prev = editorParticleSystemsRef.current
      if (
        prev &&
        prev.config.pathLen === path.length &&
        prev.config.colorKey === colorKey &&
        prev.config.N === N &&
        prev.config.deviation === deviation &&
        prev.config.wMin === wMin &&
        prev.config.wMax === wMax &&
        prev.config.bandWidthScale === bandWidthScale
      )
        return
      const particles: FlowParticleDef[] = []
      for (let k = 0; k < N; k++) {
        const offsetedPath = offsetPath(path, deviation, k, bandWidthScale)
        const timestamps = pathToTimestamps(offsetedPath)
        const phase = k / N
        const u = flowHashUnit(k, 0)
        const radius = Math.max(0.01, wMin + ((u + 1) / 2) * (wMax - wMin))
        const speedFactor = Math.max(0.01, wMin) / Math.max(0.01, radius)
        particles.push({
          offsetPath: offsetedPath,
          timestamps,
          phase,
          radius,
          speedFactor,
          color,
        })
      }
      editorParticleSystemsRef.current = {
        config: { pathLen: path.length, colorKey, N, deviation, wMin, wMax, bandWidthScale },
        particles,
      }
    }

    const tick = () => {
      const constantFlow = flowConstantFlowRef.current
      const timeMax = constantFlow ? EDITOR_FLOW_TIME_MAX : EDITOR_FLOW_TIME_MAX_LOOP
      if (flowAnimatingRef.current) {
        const t = (flowTimeRef.current + 0.004) % timeMax
        flowTimeRef.current = t
      }
      ensureEditorParticlesInitialized()
      const globalT = flowTimeRef.current
      const baseTravelTime = EDITOR_FLOW_TIME_MAX
      const particleData: FlowParticleDatum[] = []
      const jitter = flowJitterRef.current
      const particles = editorParticleSystemsRef.current?.particles
      if (particles) {
        particles.forEach((p) => {
          const localT = (globalT / baseTravelTime) * p.speedFactor + p.phase
          let progress: number
          if (constantFlow) {
            progress = ((localT % 1) + 1) % 1
          } else {
            if (localT > 1) return
            progress = Math.min(1, Math.max(0, localT))
          }
          const pos = interpolatePathPosition(p.offsetPath, p.timestamps, progress)
          if (!pos) return
          let posJ: [number, number] = pos
          if (jitter > 0) {
            const s = EDITOR_FLOW_JITTER_SCALE * jitter
            posJ = [
              pos[0] + (Math.random() * 2 - 1) * s,
              pos[1] + (Math.random() * 2 - 1) * s,
            ]
          }
          particleData.push({ position: posJ, color: p.color, radius: p.radius })
        })
      }
      const zoom = map.getZoom()
      const zoomScale = zoom < 10 ? Math.pow(2, Math.max(0, 10 - zoom) / 4) : 1
      overlay.setProps({
        layers:
          particleData.length > 0
            ? [
                new ScatterplotLayer<FlowParticleDatum>({
                  id: "editor-flow-particles",
                  data: particleData,
                  getPosition: (d) => d.position,
                  getFillColor: (d) => (flowWindStyleWhiteRef.current ? [255, 255, 255, 220] : [...d.color, 220]),
                  getRadius: (d) => Math.max(0.5, d.radius * zoomScale),
                  radiusUnits: "pixels",
                }),
              ]
            : [],
      })
      map.triggerRepaint()
      flowFpsFrameCountRef.current += 1
      if (flowFpsFrameCountRef.current >= 60) {
        const now = performance.now()
        const elapsed = (now - flowFpsLastTimeRef.current) / 1000
        if (elapsed > 0) flowFpsSetRef.current?.(Math.round(60 / elapsed))
        flowFpsFrameCountRef.current = 0
        flowFpsLastTimeRef.current = now
      }
      rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [lineEffect, drawingPoints, lineStrokeColor, lineWidth, mapReady])

  useEffect(() => {
    if (lineEffect !== "flow") return
    const id = setInterval(() => setFlowTime(flowTimeRef.current), 120)
    return () => clearInterval(id)
  }, [lineEffect])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(EDITOR_POINTS_LAYER_ID)) return

    const onPointClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0]
      if (!f?.geometry || (f.geometry as { type: string }).type !== "Point") return
      e.preventDefault()
      const coords = (f.geometry as { type: "Point"; coordinates: [number, number] }).coordinates
      const props = (f.properties ?? {}) as Record<string, unknown>
      const layerGeodataId = String(props.layer_geodata_id ?? "")
      const nameFromMap = String(props.name ?? "")
      const labelFromMap = String(props.label ?? "")

      if (mode === "drawLine") {
        if (selectedLayerId && layerGeodataId !== selectedLayerId) return
        setDrawingPoints((prev) => [...prev, [coords[0], coords[1]]])
        return
      }
      const item = effectiveItems.find((i) => i.id === layerGeodataId)
      const features = item?.geojson?.features ?? []
      const geoPointIdFromMap =
        typeof props[GEO_POINT_ID_KEY] === "string" ? String(props[GEO_POINT_ID_KEY]).trim() : ""
      let featureIndex = -1
      if (geoPointIdFromMap) {
        featureIndex = features.findIndex(
          (feat) => feat.properties?.[GEO_POINT_ID_KEY] === geoPointIdFromMap
        )
      }
      if (featureIndex < 0) {
        featureIndex = features.findIndex(
          (feat) =>
            feat.geometry?.type === "Point" &&
            Array.isArray((feat.geometry as { coordinates: number[] }).coordinates) &&
            (feat.geometry as { coordinates: number[] }).coordinates[0] === coords[0] &&
            (feat.geometry as { coordinates: number[] }).coordinates[1] === coords[1]
        )
      }
      const idx = featureIndex >= 0 ? featureIndex : 0
      const feat = features[idx]
      const srcProps = (feat?.properties ?? {}) as Record<string, unknown>
      const geo_point_id =
        typeof srcProps[GEO_POINT_ID_KEY] === "string"
          ? String(srcProps[GEO_POINT_ID_KEY]).trim()
          : geoPointIdFromMap
      const resolvedName = String(srcProps.name ?? nameFromMap)
      const resolvedLabel = String(srcProps.label ?? labelFromMap)
      const resolvedContainerId =
        typeof srcProps.location_container_id === "string"
          ? srcProps.location_container_id
          : srcProps.location_container_id === null
            ? null
            : typeof props.location_container_id === "string"
              ? props.location_container_id
              : props.location_container_id === null
                ? null
                : undefined
      const geojson = item?.geojson ? { type: "FeatureCollection" as const, features: item.geojson.features } : { type: "FeatureCollection" as const, features: [] }
      onPointSelect?.({
        layerGeodataId,
        geo_point_id,
        featureIndex: idx,
        name: resolvedName,
        label: resolvedLabel,
        coordinates: [coords[0], coords[1]],
        location_container_id: resolvedContainerId,
        geojson,
      })
    }

    map.on("click", EDITOR_POINTS_LAYER_ID, onPointClick)
    const onPointEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapGeoJSONFeature[] }) => {
      map.getCanvas().style.cursor = "pointer"
      const f = e.features?.[0]
      if (!f?.geometry || (f.geometry as { type: string }).type !== "Point") return
      const coords = (f.geometry as { type: "Point"; coordinates: [number, number] }).coordinates
      const props = (f.properties ?? {}) as Record<string, unknown>
      const name = String(props.name ?? "Punto")
      const label = String(props.label ?? "")
      const text = label ? `${name}${label !== name ? ` — ${label}` : ""}` : name
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove()
        hoverPopupRef.current = null
      }
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "geodata-editor-hover-popup" })
        .setLngLat([coords[0], coords[1]])
        .setHTML(`<div class="font-mono text-xs text-[var(--parchment)] whitespace-nowrap">${escapeHtml(text)}</div>`)
        .addTo(map)
      hoverPopupRef.current = popup
      popup.on("close", () => { hoverPopupRef.current = null })
    }
    const onPointLeave = () => {
      map.getCanvas().style.cursor = ""
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove()
        hoverPopupRef.current = null
      }
    }
    map.on("mouseenter", EDITOR_POINTS_LAYER_ID, onPointEnter)
    map.on("mouseleave", EDITOR_POINTS_LAYER_ID, onPointLeave)
    return () => {
      map.off("click", EDITOR_POINTS_LAYER_ID, onPointClick)
      map.off("mouseenter", EDITOR_POINTS_LAYER_ID, onPointEnter)
      map.off("mouseleave", EDITOR_POINTS_LAYER_ID, onPointLeave)
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove()
        hoverPopupRef.current = null
      }
    }
  }, [mode, onPointSelect, effectiveItems, selectedLayerId])

  const handleSaveLine = async () => {
    setSaveError(null)
    if (drawingPoints.length < 2) {
      setSaveError("Añade al menos 2 puntos a la línea")
      return
    }
    const effectiveGroupId = selectedLayerGroupId ?? groupId
    if (!editingLayer && !effectiveGroupId) {
      setSaveError("Selecciona una capa de puntos o categoría para la nueva capa")
      return
    }
    let geojson: { type: "FeatureCollection"; features: unknown[] }
    try {
      validateColor(lineStrokeColor)
      if (closeLine && drawingPoints.length >= 3) validateColor(lineFillColor)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Color inválido")
      return
    }
    const name = lineName.trim() || "Línea"
    const isPolygon = closeLine && drawingPoints.length >= 3
    const coordinates = isPolygon ? [...drawingPoints, drawingPoints[0]] : drawingPoints
    const geometry = isPolygon
      ? { type: "Polygon" as const, coordinates: [coordinates] }
      : { type: "LineString" as const, coordinates: drawingPoints }
    geojson = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry,
          properties: {
            name,
            color: toSolidFillColor(lineStrokeColor),
            fillColor: isPolygon ? toSolidFillColor(lineFillColor) : undefined,
            fillOpacity: isPolygon ? lineFillOpacity : undefined,
            lineWidth,
            ...(lineEffect ? { effect: lineEffect } : {}),
          },
        },
      ],
    }
    setSaving(true)
    try {
      const isEditing = !!editingLayer
      const res = await fetch(
        isEditing ? `/api/admin/layer-geodata` : "/api/admin/layer-geodata",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            isEditing
              ? { id: editingLayer.id, name, geojson }
              : {
                  group_id: effectiveGroupId,
                  sublayer_id: null,
                  sub_sublayer_id: null,
                  name,
                  type: isPolygon ? "polygon" : "line",
                  geojson,
                }
          ),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDrawingPoints([])
        setLineName("")
        setCloseLine(false)
        setLineEffect("")
        setLineWidth(4)
        if (!useExternalItems) await loadGeodata()
        onSaved?.()
      } else {
        setSaveError(data.error ?? "Error al guardar")
      }
    } finally {
      setSaving(false)
    }
  }

  const clearDrawing = () => {
    setDrawingPoints([])
    setSaveError(null)
  }

  if (!mapboxgl.accessToken) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--parchment-dim)] font-mono text-xs ${className}`}
        style={{ minHeight: 320 }}
      >
        Configura NEXT_PUBLIC_MAPBOX_TOKEN para editar.
      </div>
    )
  }

  const controlsBlock = (
      <>
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`px-2 py-1 font-mono text-xs rounded border ${mode === "select" ? "bg-[var(--primary)]/20 border-[var(--primary)]" : "border-[var(--panel-border)]"}`}
          >
            Seleccionar punto
          </button>
          <button
            type="button"
            onClick={() => { setMode("drawLine"); clearDrawing() }}
            disabled={!selectedLayerId || selectedLayerType !== "point"}
            title={!selectedLayerId ? "Selecciona una capa de puntos primero" : selectedLayerType !== "point" ? "Solo disponible para capas de puntos" : undefined}
            className={`px-2 py-1 font-mono text-xs rounded border ${mode === "drawLine" ? "bg-[var(--primary)]/20 border-[var(--primary)]" : "border-[var(--panel-border)]"} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Unir puntos (línea)
          </button>
        </div>
        {mode === "drawLine" && (
          <div className="border border-[var(--panel-border)] rounded-lg p-3 mb-2" style={{ background: "var(--panel-bg)" }}>
            <h4 className="font-mono text-[10px] text-[var(--parchment-dim)] uppercase mb-2">Nueva línea</h4>
            <div className="space-y-2">
            <label className="block">
              <span className="font-mono text-[10px] text-[var(--parchment-dim)] block">Nombre</span>
              <input
                type="text"
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
                placeholder="opcional"
                className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1 w-full bg-transparent text-[var(--parchment)]"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] text-[var(--parchment-dim)] block">Ancho de línea ({Number.isFinite(lineWidth) ? lineWidth : 4})</span>
              <input
                type="range"
                min={1}
                max={16}
                value={Number.isFinite(lineWidth) ? lineWidth : 4}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-full max-w-[200px]"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="block">
                <span className="font-mono text-[10px] text-[var(--parchment-dim)] block">Borde</span>
                <input
                  type="color"
                  value={lineStrokeColor}
                  onChange={(e) => setLineStrokeColor(e.target.value)}
                  className="w-8 h-6 rounded border border-[var(--panel-border)] cursor-pointer"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] text-[var(--parchment-dim)] block">Relleno</span>
                <input
                  type="color"
                  value={lineFillColor}
                  onChange={(e) => setLineFillColor(e.target.value)}
                  className="w-8 h-6 rounded border border-[var(--panel-border)] cursor-pointer"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] text-[var(--parchment-dim)] block">Opacidad relleno</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={Number.isFinite(lineFillOpacity) ? lineFillOpacity : DEFAULT_FILL_OPACITY}
                  onChange={(e) => setLineFillOpacity(Number(e.target.value))}
                  className="w-20"
                />
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={closeLine}
                onChange={(e) => setCloseLine(e.target.checked)}
                className="rounded"
              />
              <span className="font-mono text-xs text-[var(--parchment)]">Cerrar línea (polígono)</span>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Efecto</span>
              <select
                value={lineEffect}
                onChange={(e) => {
                  const v = e.target.value
                  setLineEffect((v === "glow" || v === "dashed" || v === "flow" ? v : "") as "" | "glow" | "dashed" | "flow")
                }}
                className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1 bg-transparent text-[var(--parchment)]"
              >
                <option value="">Ninguno</option>
                <option value="glow">Brillo (glow)</option>
                <option value="dashed">Discontinua</option>
                <option value="flow">Flujo (agua)</option>
              </select>
              {lineEffect === "flow" && (
                <div className="mt-2 p-2 rounded border border-[var(--panel-border)] space-y-2" style={{ background: "var(--background)" }}>
                  <p className="font-mono text-[10px] text-[var(--parchment-dim)] italic">Parámetros flujo (preview)</p>
                  <span className="font-mono text-[10px] text-[var(--parchment-dim)]" title="Frames por segundo">FPS: {flowFps ?? "—"}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flowWindStyleWhite}
                      onChange={(e) => setFlowWindStyleWhite(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Estilo wind (blanco)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flowAnimating}
                      onChange={(e) => setFlowAnimating(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Animación</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flowConstantFlow}
                      onChange={(e) => {
                        const v = e.target.checked
                        setFlowConstantFlow(v)
                        if (v && flowTime > EDITOR_FLOW_TIME_MAX) setFlowTime(flowTime % EDITOR_FLOW_TIME_MAX)
                        if (!v && flowTime > EDITOR_FLOW_TIME_MAX_LOOP) setFlowTime(flowTime % EDITOR_FLOW_TIME_MAX_LOOP)
                      }}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)]" title="Desaparecen al final y se sigue emitiendo">Flujo constante</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16">Tiempo (playhead)</span>
                    <input
                      type="range"
                      min={0}
                      max={flowConstantFlow ? EDITOR_FLOW_TIME_MAX : EDITOR_FLOW_TIME_MAX_LOOP}
                      step={0.01}
                      value={Math.min(flowTime, flowConstantFlow ? EDITOR_FLOW_TIME_MAX : EDITOR_FLOW_TIME_MAX_LOOP)}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        flowTimeRef.current = v
                        setFlowTime(v)
                      }}
                      className="flex-1 max-w-[120px]"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-8">{flowTime.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16">Partículas</span>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={flowParticleCount}
                      onChange={(e) => setFlowParticleCount(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
                      className="font-mono text-xs w-14 px-1 py-0.5 rounded border border-[var(--panel-border)] bg-transparent text-[var(--parchment)]"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16">Desviación</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={flowPathDeviation}
                      onChange={(e) => setFlowPathDeviation(Number(e.target.value))}
                      className="flex-1 max-w-[120px]"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-8">{flowPathDeviation.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16" title="Ruido en posición">Vibración</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={flowJitter}
                      onChange={(e) => setFlowJitter(Number(e.target.value))}
                      className="flex-1 max-w-[120px]"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-8">{flowJitter.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16" title="Corto = puntos, largo = líneas">Rastro</span>
                    <input
                      type="range"
                      min={0.01}
                      max={0.2}
                      step={0.01}
                      value={flowTrailLength}
                      onChange={(e) => setFlowTrailLength(Number(e.target.value))}
                      className="flex-1 max-w-[120px]"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-8">{flowTrailLength.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2" title="Radio mínimo de cada punto (0.01–20 px)">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16">Tamaño min</span>
                    <input
                      type="range"
                      min={0.01}
                      max={20}
                      step={0.1}
                      value={flowWidthMinPixels}
                      onChange={(e) => setFlowWidthMinPixels(Number(e.target.value))}
                      className="flex-1 max-w-[120px]"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-8">{flowWidthMinPixels.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2" title="Radio máximo de cada punto (0.01–20 px)">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16">Tamaño max</span>
                    <input
                      type="number"
                      min={0.01}
                      max={20}
                      step={0.1}
                      value={flowWidthMaxPixels}
                      onChange={(e) => setFlowWidthMaxPixels(Math.max(0.01, Math.min(20, Number(e.target.value) || 0.01)))}
                      className="font-mono text-xs w-14 px-1 py-0.5 rounded border border-[var(--panel-border)] bg-transparent text-[var(--parchment)]"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16">Escala ancho</span>
                    <input
                      type="range"
                      min={0.25}
                      max={3}
                      step={0.25}
                      value={flowWidthScale}
                      onChange={(e) => setFlowWidthScale(Number(e.target.value))}
                      className="flex-1 max-w-[120px]"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-8">{flowWidthScale.toFixed(2)}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flowFadeTrail}
                      onChange={(e) => setFlowFadeTrail(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Desvanecimiento</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flowCapRounded}
                      onChange={(e) => setFlowCapRounded(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Extremos redondos</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flowJointRounded}
                      onChange={(e) => setFlowJointRounded(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Uniones redondas</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flowBillboard}
                      onChange={(e) => setFlowBillboard(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Billboard</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--parchment-dim)] w-16">Miter limit</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={flowMiterLimit}
                      onChange={(e) => setFlowMiterLimit(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                      className="font-mono text-xs w-10 px-1 py-0.5 rounded border border-[var(--panel-border)] bg-transparent text-[var(--parchment)]"
                    />
                  </label>
                </div>
              )}
            </label>
            <p className="font-mono text-[10px] text-[var(--parchment-dim)]">
              Clic en puntos del mapa en orden. Puntos en la línea: {drawingPoints.length}
            </p>
            <p className="font-mono text-[10px] text-[var(--parchment-dim)] italic">
              La línea y el relleno se ven en el mapa tal como quedarán al guardar.
            </p>
            <p className="font-mono text-[10px] text-[var(--parchment-dim)]">
              Cada guardado crea una capa independiente (GeoJSON en layer_geodata). Ej: 12 líneas de metro = 12 capas.
            </p>
            {saveError && <p className="font-mono text-xs text-[var(--destructive)]">{saveError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveLine}
                disabled={saving || drawingPoints.length < 2}
                className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
              >
                {saving ? "Guardando…" : editingLayer ? "Guardar cambios" : "Guardar línea"}
              </button>
              {editingLayer ? (
                <button
                  type="button"
                  onClick={() => { clearDrawing(); onCancelEdit?.() }}
                  className="px-3 py-1.5 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment)] hover:bg-[var(--panel-bg)] rounded"
                >
                  Cancelar edición
                </button>
              ) : (
                <button
                  type="button"
                  onClick={clearDrawing}
                  className="px-3 py-1.5 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment)] hover:bg-[var(--panel-bg)] rounded"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
        )}
      </>
    )

    const mapBlock = (
      <>
        <div
          ref={containerRef}
          className="w-full flex-1 min-h-[320px] rounded-lg border border-[var(--panel-border)] overflow-hidden bg-[var(--background)]"
        />
        {loading && (
          <p className="mt-2 font-mono text-[10px] text-[var(--parchment-dim)]">Cargando geodata…</p>
        )}
      </>
    )

    if (layoutThreeColumns) {
      return (
        <div className={`flex flex-row gap-4 min-h-0 flex-1 min-w-0 ${className}`}>
          <div className="flex flex-col w-[260px] shrink-0 overflow-y-auto max-h-[calc(100vh-10rem)]">
            {controlsBlock}
          </div>
          <div className="flex-1 min-w-0 flex flex-col min-h-[320px]">
            {mapBlock}
          </div>
        </div>
      )
    }

    return (
      <div className={`flex flex-col min-h-0 ${className}`}>
        {controlsBlock}
        {mapBlock}
      </div>
    )
  }
