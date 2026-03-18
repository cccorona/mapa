"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import type { CatalogTreeGroup } from "@/lib/catalog-db"
import { GeodataPreviewMap } from "@/components/geodata-preview-map"

type GeodataRow = {
  id: string
  name: string
  type: string
  group_id: string
  sublayer_id: string | null
  sub_sublayer_id: string | null
  created_at: string
}

export default function AdminCapasPage() {
  const [tree, setTree] = useState<CatalogTreeGroup[]>([])
  const [geodata, setGeodata] = useState<GeodataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCapaId, setSelectedCapaId] = useState("")
  const [geodataForm, setGeodataForm] = useState({
    name: "",
    type: "line" as "point" | "line" | "polygon",
    geojsonText: "",
  })
  const [pointForm, setPointForm] = useState({ name: "", lat: "", lng: "" })
  const [submittingGeodata, setSubmittingGeodata] = useState(false)
  const [submittingPoint, setSubmittingPoint] = useState(false)
  const [geodataError, setGeodataError] = useState<string | null>(null)
  const [pointError, setPointError] = useState<string | null>(null)

  const loadCatalog = async () => {
    const res = await fetch("/api/admin/layer-catalog", { credentials: "include" })
    if (res.ok) setTree((await res.json()) ?? [])
  }

  const loadGeodata = async () => {
    const res = await fetch("/api/admin/layer-geodata", { credentials: "include" })
    if (res.ok) setGeodata((await res.json()) ?? [])
  }

  useEffect(() => {
    let done = false
    async function load() {
      await Promise.all([loadCatalog(), loadGeodata()])
      if (!done) setLoading(false)
    }
    load()
    return () => { done = true }
  }, [])

  const handleSubmitGeodata = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeodataError(null)
    if (!selectedCapaId || !geodataForm.name.trim() || !geodataForm.geojsonText.trim()) {
      setGeodataError("Elige capa, nombre y pega el GeoJSON")
      return
    }
    let geojson: unknown
    try {
      const parsed = JSON.parse(geodataForm.geojsonText)
      geojson = Array.isArray(parsed) ? { type: "FeatureCollection", features: parsed } : parsed
    } catch {
      setGeodataError("GeoJSON inválido")
      return
    }
    setSubmittingGeodata(true)
    try {
      const res = await fetch("/api/admin/layer-geodata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          group_id: selectedCapaId,
          sublayer_id: null,
          sub_sublayer_id: null,
          name: geodataForm.name.trim(),
          type: geodataForm.type,
          geojson,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setGeodataForm({ ...geodataForm, name: "", geojsonText: "" })
        await loadGeodata()
      } else {
        setGeodataError(data.error ?? "Error al guardar")
      }
    } finally {
      setSubmittingGeodata(false)
    }
  }

  const handleAddPoint = async (e: React.FormEvent) => {
    e.preventDefault()
    setPointError(null)
    if (!selectedCapaId) {
      setPointError("Elige una capa")
      return
    }
    const lat = parseFloat(pointForm.lat)
    const lng = parseFloat(pointForm.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setPointError("Lat y lng deben ser números")
      return
    }
    const geojson = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lng, lat] },
          properties: { name: pointForm.name.trim() || "Punto" },
        },
      ],
    }
    setSubmittingPoint(true)
    try {
      const res = await fetch("/api/admin/layer-geodata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          group_id: selectedCapaId,
          sublayer_id: null,
          sub_sublayer_id: null,
          name: pointForm.name.trim() || "Punto",
          type: "point" as const,
          geojson,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPointForm({ name: "", lat: "", lng: "" })
        await loadGeodata()
      } else {
        setPointError(data.error ?? "Error al guardar")
      }
    } finally {
      setSubmittingPoint(false)
    }
  }

  const groupName = (id: string) => tree.find((g) => g.id === id)?.name ?? id
  const geodataForCapa = selectedCapaId ? geodata.filter((gd) => gd.group_id === selectedCapaId) : geodata

  const previewGeojson = useMemo(() => {
    const text = geodataForm.geojsonText.trim()
    if (!text) return null
    try {
      const parsed = JSON.parse(text)
      const fc = Array.isArray(parsed) ? { type: "FeatureCollection" as const, features: parsed } : parsed
      if (fc?.type === "FeatureCollection" && Array.isArray(fc.features)) return fc
      return null
    } catch {
      return null
    }
  }, [geodataForm.geojsonText])

  const previewSinglePoint = useMemo(() => {
    const lat = parseFloat(pointForm.lat)
    const lng = parseFloat(pointForm.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    return null
  }, [pointForm.lat, pointForm.lng])

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-[1600px] mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl font-medium text-[var(--parchment)]">
            Capas
          </h1>
          <Link
            href="/admin"
            className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
          >
            Volver a admin
          </Link>
        </div>

        {loading ? (
          <p className="font-mono text-sm text-[var(--parchment-dim)]">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px),1fr] gap-8 items-start">
            <div className="min-w-0">
            {/* Bloque 1: Selector de capa desde BD (TRANSPORTE, VEGETACION, LANDMARKS) */}
            <section className="mb-8">
              <h2 className="font-serif text-lg font-medium text-[var(--parchment)] mb-4">
                Capa (catálogo desde BD)
              </h2>
              <p className="font-mono text-xs text-[var(--parchment-dim)] mb-3">
                Elige la capa a la que quieres añadir geopuntos. Transporte, Vegetación o Landmarks.
              </p>
              <select
                value={selectedCapaId}
                onChange={(e) => setSelectedCapaId(e.target.value)}
                className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] min-w-[220px]"
              >
                <option value="">Elegir capa</option>
                {tree.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} — {g.name}
                  </option>
                ))}
              </select>
            </section>

            {/* Bloque 2: Geodata para la capa elegida */}
            {selectedCapaId && (
              <section className="space-y-8 mb-10">
                <h2 className="font-serif text-lg font-medium text-[var(--parchment)]">
                  Geodata para {groupName(selectedCapaId)}
                </h2>

                {/* 2a: Cargar GeoJSON (array completo) */}
                <div className="border border-[var(--panel-border)] rounded-lg p-4" style={{ background: "var(--panel-bg)" }}>
                  <h3 className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--parchment-dim)] mb-3">
                    Cargar GeoJSON (array completo)
                  </h3>
                  <form onSubmit={handleSubmitGeodata} className="space-y-3">
                    <div className="flex flex-wrap gap-4">
                      <label className="block">
                        <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Nombre</span>
                        <input
                          type="text"
                          value={geodataForm.name}
                          onChange={(e) => setGeodataForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="ej. Líneas Metro CDMX"
                          className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-48"
                        />
                      </label>
                      <label className="block">
                        <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Tipo</span>
                        <select
                          value={geodataForm.type}
                          onChange={(e) => setGeodataForm((p) => ({ ...p, type: e.target.value as "point" | "line" | "polygon" }))}
                          className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)]"
                        >
                          <option value="point">Punto</option>
                          <option value="line">Línea</option>
                          <option value="polygon">Polígono</option>
                        </select>
                      </label>
                    </div>
                    <div className="rounded border border-[var(--panel-border)] bg-[var(--background)]/50 p-3 font-mono text-[10px] text-[var(--parchment-dim)] space-y-2">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--parchment)]/80 mb-1.5">Qué tipo elegir</p>
                      <p><strong className="text-[var(--parchment)]">Punto (point):</strong> Un lugar en el mapa (una coordenada por feature). Geometría: <code className="opacity-90">Point</code> → <code className="opacity-90">coordinates: [lng, lat]</code>. Ejemplo: marcadores, paradas, estaciones.</p>
                      <p><strong className="text-[var(--parchment)]">Línea (line):</strong> Secuencia de puntos unidos (trayecto, ruta). Geometría: <code className="opacity-90">LineString</code> → <code className="opacity-90">[[lng1,lat1],[lng2,lat2],...]</code> o <code className="opacity-90">MultiLineString</code>. Ejemplo: líneas de metro, ejes viales.</p>
                      <p><strong className="text-[var(--parchment)]">Polígono (polygon):</strong> Área cerrada (contorno). Geometría: <code className="opacity-90">Polygon</code> → <code className="opacity-90">[[[lng,lat],...]]</code> (primer anillo = borde; más anillos = huecos) o <code className="opacity-90">MultiPolygon</code>. Ejemplo: zonas, colonias, perímetros.</p>
                    </div>
                    <label className="block">
                      <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">GeoJSON: FeatureCollection con features de geometry Point, LineString o Polygon</span>
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <input
                          type="file"
                          accept=".geojson,.json,application/geo+json,application/json"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setGeodataError(null)
                            const reader = new FileReader()
                            reader.onload = () => {
                              const text = typeof reader.result === "string" ? reader.result : ""
                              try {
                                JSON.parse(text)
                                setGeodataForm((p) => ({ ...p, geojsonText: text }))
                              } catch {
                                setGeodataError("El archivo no es un JSON válido")
                              }
                            }
                            reader.readAsText(file, "UTF-8")
                            e.target.value = ""
                          }}
                          className="font-mono text-[10px] text-[var(--parchment-dim)] file:mr-2 file:rounded file:border file:border-[var(--panel-border)] file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[var(--parchment)] file:text-xs"
                        />
                        <span className="font-mono text-[10px] text-[var(--parchment-dim)]">o pega el JSON abajo</span>
                      </div>
                      <textarea
                        value={geodataForm.geojsonText}
                        onChange={(e) => setGeodataForm((p) => ({ ...p, geojsonText: e.target.value }))}
                        placeholder='{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-99.13,19.43]},"properties":{}}]}'
                        rows={6}
                        className="font-mono text-[10px] border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full"
                      />
                    </label>
                    {geodataError && <p className="font-mono text-xs text-[var(--destructive)]">{geodataError}</p>}
                    <button
                      type="submit"
                      disabled={submittingGeodata}
                      className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
                    >
                      {submittingGeodata ? "Guardando…" : "Cargar datos geo"}
                    </button>
                  </form>
                </div>

                {/* 2b: Añadir punto (uno por uno) */}
                <div className="border border-[var(--panel-border)] rounded-lg p-4" style={{ background: "var(--panel-bg)" }}>
                  <h3 className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--parchment-dim)] mb-3">
                    Añadir punto (uno por uno)
                  </h3>
                  <form onSubmit={handleAddPoint} className="flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Nombre</span>
                      <input
                        type="text"
                        value={pointForm.name}
                        onChange={(e) => setPointForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="opcional"
                        className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-32"
                      />
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Lat</span>
                      <input
                        type="text"
                        value={pointForm.lat}
                        onChange={(e) => setPointForm((p) => ({ ...p, lat: e.target.value }))}
                        placeholder="19.43"
                        className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-24"
                      />
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Lng</span>
                      <input
                        type="text"
                        value={pointForm.lng}
                        onChange={(e) => setPointForm((p) => ({ ...p, lng: e.target.value }))}
                        placeholder="-99.14"
                        className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-24"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submittingPoint}
                      className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
                    >
                      {submittingPoint ? "Guardando…" : "Añadir punto"}
                    </button>
                  </form>
                  {pointError && <p className="font-mono text-xs text-[var(--destructive)] mt-2">{pointError}</p>}
                </div>
              </section>
            )}

            {/* Listado geodata cargados */}
            <section>
              <h3 className="font-mono text-xs text-[var(--parchment-dim)] mb-2">
                {selectedCapaId ? `Datos geo en ${groupName(selectedCapaId)}` : "Datos geo cargados (todas las capas)"}
              </h3>
              {geodataForCapa.length === 0 ? (
                <p className="font-mono text-xs text-[var(--parchment-dim)] italic">Ninguno aún.</p>
              ) : (
                <ul className="space-y-1">
                  {geodataForCapa.map((gd) => (
                    <li key={gd.id} className="font-mono text-xs text-[var(--parchment)]">
                      {gd.name} ({gd.type})
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </div>
            {/* Preview mapa: todo el lado derecho, cuadrado y encierra CDMX */}
            <div className="w-full lg:sticky lg:top-6 flex flex-col min-h-0">
              <h3 className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--parchment-dim)] mb-2 shrink-0">
                Vista previa
              </h3>
              <GeodataPreviewMap
                geojson={previewGeojson}
                type={geodataForm.type}
                singlePoint={previewSinglePoint}
                className="w-full aspect-square"
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
