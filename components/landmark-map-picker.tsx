"use client"

import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { CDMX_BOUNDS, CDMX_CENTER } from "@/lib/map-bounds"
import { roundCoord } from "@/lib/utils"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

const PICKER_SOURCE_ID = "landmark-picker-point"
const PICKER_LAYER_ID = "landmark-picker-layer"
const PICKER_IMAGE_ID = "landmark-picker-icon"

interface LandmarkMapPickerProps {
  lat: number | null
  lng: number | null
  onSelect: (lat: number, lng: number) => void
  /** URL del icono (object URL del file) para previsualizar cómo se verá el landmark */
  previewImageUrl?: string | null
  className?: string
}

export function LandmarkMapPicker({
  lat,
  lng,
  onSelect,
  previewImageUrl,
  className = "",
}: LandmarkMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const el = containerRef.current
    if (!el || !mapboxgl.accessToken) return

    const map = new mapboxgl.Map({
      container: el,
      style: "mapbox://styles/mapbox/light-v11",
      center: CDMX_CENTER,
      zoom: 11,
      maxBounds: [
        [CDMX_BOUNDS.west, CDMX_BOUNDS.south],
        [CDMX_BOUNDS.east, CDMX_BOUNDS.north],
      ],
    })

    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      const roundedLat = roundCoord(e.lngLat.lat)
      const roundedLng = roundCoord(e.lngLat.lng)
      onSelectRef.current(roundedLat, roundedLng)
    }
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right")
    map.on("click", onMapClick)
    mapRef.current = map

    const ro = new ResizeObserver(() => {
      map.resize()
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Añadir source + layer del punto y actualizar posición
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const hasPoint = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)

    const setupLayer = () => {
      if (!map.getSource(PICKER_SOURCE_ID)) {
        map.addSource(PICKER_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        })
      }
      const src = map.getSource(PICKER_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData({
          type: "FeatureCollection",
          features: hasPoint
            ? [
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [lng!, lat!] },
                  properties: {},
                },
              ]
            : [],
        })
      }

      if (!map.getLayer(PICKER_LAYER_ID)) {
        map.addLayer({
          id: PICKER_LAYER_ID,
          type: "symbol",
          source: PICKER_SOURCE_ID,
          layout: {
            "icon-image": map.hasImage(PICKER_IMAGE_ID) ? PICKER_IMAGE_ID : "marker-15",
            "icon-size": map.hasImage(PICKER_IMAGE_ID) ? 0.5 : 1,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        })
      }
    }

    if (map.isStyleLoaded()) {
      setupLayer()
    } else {
      map.once("style.load", setupLayer)
    }
  }, [lat, lng])

  // Cargar imagen de previsualización como icono del pin y actualizar capa
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const run = () => {
      if (!map.isStyleLoaded()) return

      if (!previewImageUrl) {
        if (map.hasImage(PICKER_IMAGE_ID)) map.removeImage(PICKER_IMAGE_ID)
        if (map.getLayer(PICKER_LAYER_ID)) {
          map.setLayoutProperty(PICKER_LAYER_ID, "icon-image", "marker-15")
          map.setLayoutProperty(PICKER_LAYER_ID, "icon-size", 1)
        }
        return
      }

      map.loadImage(previewImageUrl, (err, image) => {
        if (err || !image) return
        if (!map.isStyleLoaded()) return
        if (map.hasImage(PICKER_IMAGE_ID)) map.removeImage(PICKER_IMAGE_ID)
        map.addImage(PICKER_IMAGE_ID, image, { pixelRatio: 2 })
        if (map.getLayer(PICKER_LAYER_ID)) {
          map.setLayoutProperty(PICKER_LAYER_ID, "icon-image", PICKER_IMAGE_ID)
          map.setLayoutProperty(PICKER_LAYER_ID, "icon-size", 0.5)
        }
      })
    }

    if (map.isStyleLoaded()) {
      run()
    } else {
      map.once("style.load", run)
    }

    return () => {
      if (map.isStyleLoaded() && map.hasImage(PICKER_IMAGE_ID)) {
        map.removeImage(PICKER_IMAGE_ID)
      }
    }
  }, [previewImageUrl])

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <p className="font-mono text-[10px] text-[var(--parchment-dim)] mb-2 shrink-0">
        Clic en el mapa para colocar el pin. Coordenadas con 5 decimales (mismo formato del mapa).
      </p>
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-[280px] rounded-lg border border-[var(--panel-border)] overflow-hidden"
        style={{ background: "var(--background)" }}
      />
      {lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && (
        <p className="mt-2 font-mono text-[10px] text-[var(--parchment-dim)] shrink-0">
          Lat {lat.toFixed(5)} · Lng {lng.toFixed(5)}
        </p>
      )}
    </div>
  )
}
