"use client"

import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { CDMX_BOUNDS, CDMX_CENTER } from "@/lib/map-bounds"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

const PREVIEW_SOURCE_ID = "geodata-preview-source"
const PREVIEW_LAYER_POINT_ID = "geodata-preview-point"
const PREVIEW_LAYER_LINE_ID = "geodata-preview-line"
const PREVIEW_LAYER_FILL_ID = "geodata-preview-fill"

type GeoJSONFeatureCollection = {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    geometry: { type: string; coordinates: unknown }
    properties?: Record<string, unknown>
  }>
}

function getBounds(
  geojson: GeoJSONFeatureCollection | null,
  singlePoint: { lat: number; lng: number } | null
): [[number, number], [number, number]] | null {
  if (singlePoint && Number.isFinite(singlePoint.lat) && Number.isFinite(singlePoint.lng)) {
    const pad = 0.01
    return [
      [singlePoint.lng - pad, singlePoint.lat - pad],
      [singlePoint.lng + pad, singlePoint.lat + pad],
    ]
  }
  if (!geojson?.features?.length) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  const expand = (coord: number[]) => {
    const lng = Number(coord[0])
    const lat = Number(coord[1])
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
  }
  const expandCoords = (coords: unknown): void => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        expand(coords as number[])
      } else {
        coords.forEach(expandCoords)
      }
    }
  }
  geojson.features.forEach((f) => {
    const g = f.geometry
    if (g?.coordinates) expandCoords(g.coordinates)
  })
  if (minLng === Infinity) return null
  const pad = 0.002
  return [
    [minLng - pad, minLat - pad],
    [maxLng + pad, maxLat + pad],
  ]
}

interface GeodataPreviewMapProps {
  geojson: GeoJSONFeatureCollection | null
  type: "point" | "line" | "polygon"
  singlePoint: { lat: number; lng: number } | null
  className?: string
}

export function GeodataPreviewMap({
  geojson,
  type,
  singlePoint,
  className = "",
}: GeodataPreviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  const hasData =
    (geojson?.features?.length ?? 0) > 0 ||
    (singlePoint != null &&
      Number.isFinite(singlePoint.lat) &&
      Number.isFinite(singlePoint.lng))

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
      map.fitBounds(
        [
          [CDMX_BOUNDS.west, CDMX_BOUNDS.south],
          [CDMX_BOUNDS.east, CDMX_BOUNDS.north],
        ],
        { padding: 24, duration: 0, maxZoom: 12 }
      )
    })

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const data =
      geojson?.features?.length
        ? geojson
        : singlePoint != null &&
            Number.isFinite(singlePoint.lat) &&
            Number.isFinite(singlePoint.lng)
          ? {
              type: "FeatureCollection" as const,
              features: [
                {
                  type: "Feature" as const,
                  geometry: {
                    type: "Point" as const,
                    coordinates: [singlePoint.lng, singlePoint.lat],
                  },
                  properties: {},
                },
              ],
            }
          : { type: "FeatureCollection" as const, features: [] }

    const setup = () => {
      if (!map.getSource(PREVIEW_SOURCE_ID)) {
        map.addSource(PREVIEW_SOURCE_ID, {
          type: "geojson",
          data: data,
        })
      }
      const src = map.getSource(PREVIEW_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (src) src.setData(data)

      const layerIds = [PREVIEW_LAYER_POINT_ID, PREVIEW_LAYER_LINE_ID, PREVIEW_LAYER_FILL_ID]
      layerIds.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id)
      })

      if (type === "point") {
        map.addLayer({
          id: PREVIEW_LAYER_POINT_ID,
          type: "circle",
          source: PREVIEW_SOURCE_ID,
          paint: {
            "circle-radius": 8,
            "circle-color": "#0a9bb3",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        })
      } else if (type === "line") {
        map.addLayer({
          id: PREVIEW_LAYER_LINE_ID,
          type: "line",
          source: PREVIEW_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#0a9bb3",
            "line-width": 3,
            "line-opacity": 0.9,
          },
        })
      } else if (type === "polygon") {
        map.addLayer({
          id: PREVIEW_LAYER_FILL_ID,
          type: "fill",
          source: PREVIEW_SOURCE_ID,
          paint: {
            "fill-color": "#0a9bb3",
            "fill-opacity": 0.4,
            "fill-outline-color": "#0a9bb3",
          },
        })
      }

      if (data.features.length > 0) {
        const bounds = getBounds(geojson, singlePoint)
        if (bounds) {
          map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 300 })
        }
      }
    }

    if (map.isStyleLoaded()) {
      setup()
    } else {
      map.once("style.load", setup)
    }
  }, [geojson, type, singlePoint])

  if (!mapboxgl.accessToken) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--parchment-dim)] font-mono text-xs ${className}`}
        style={{ minHeight: 320 }}
      >
        Configura NEXT_PUBLIC_MAPBOX_TOKEN para previsualizar.
      </div>
    )
  }

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-[280px] rounded-lg border border-[var(--panel-border)] overflow-hidden bg-[var(--background)]"
      />
      {!hasData && (
        <p className="mt-2 font-mono text-[10px] text-[var(--parchment-dim)] shrink-0">
          Pega GeoJSON válido o añade lat/lng para previsualizar.
        </p>
      )}
    </div>
  )
}
