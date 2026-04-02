"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import type { CatalogTreeGroup } from "@/lib/catalog-db"
import { EVENT_TYPES, EMOTIONAL_INTENSITY_SCALE } from "@/lib/constants"
import { EventForm } from "@/components/event-form"
import { GeodataEditorMap } from "@/components/geodata-editor-map"
import { GEO_POINT_ID_KEY } from "@/lib/geo-point-id"

type ModerationEventRow = {
  id: string
  title: string | null
  description: string
  occurred_at: string
  event_type: string
  emotional_intensity: string
  is_anonymous: boolean
  location_label: string | null
  location_container_id?: string | null
  status?: string
}

function eventTypeLabel(code: string): string {
  return EVENT_TYPES.find((t) => t.value === code)?.label ?? code
}

function emotionalIntensityLabel(value: string): string {
  return EMOTIONAL_INTENSITY_SCALE.find((i) => i.value === value)?.label ?? value
}

function AddCategoryForm({ onAdded }: { onAdded: () => void }) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!code.trim() || !name.trim()) {
      setError("Código y nombre requeridos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/layer-catalog/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim().toUpperCase().replace(/\s/g, "_"), name: name.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCode("")
        setName("")
        onAdded()
      } else {
        setError(data.error ?? "Error al crear")
      }
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código (ej. INDICATORS)"
          className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] flex-1"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (ej. Indicadores)"
          className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] flex-1"
        />
      </div>
      {error && <p className="font-mono text-[10px] text-[var(--destructive)]">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="px-2 py-1 font-mono text-[10px] border border-[var(--primary)] text-[var(--primary)] rounded hover:bg-[var(--primary)]/10 disabled:opacity-50"
      >
        {saving ? "Creando…" : "Añadir categoría"}
      </button>
    </form>
  )
}

type GeodataRow = {
  id: string
  name: string
  type: string
  group_id: string
  sublayer_id: string | null
  sub_sublayer_id: string | null
  geojson?: { type?: string; features?: unknown[] }
  created_at: string
}

export default function AdminCapasPage() {
  const [tree, setTree] = useState<CatalogTreeGroup[]>([])
  const [geodata, setGeodata] = useState<GeodataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLayer, setSelectedLayer] = useState<GeodataRow | null>(null)
  const [selectedCategoryForCreate, setSelectedCategoryForCreate] = useState("")
  const [listFilterCategoryId, setListFilterCategoryId] = useState("")
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
  const [leftPanelOpen, setLeftPanelOpen] = useState({ capa: true, geodata: true, list: true })
  const [pointLabelModal, setPointLabelModal] = useState<{
    layerGeodataId: string
    geo_point_id: string
    featureIndex: number
    name: string
    label: string
    coordinates: [number, number]
    location_container_id?: string | null
    geojson: { type: "FeatureCollection"; features: Array<{ type: "Feature"; geometry: unknown; properties?: Record<string, unknown> }> }
  } | null>(null)
  const [pointLabelSaving, setPointLabelSaving] = useState(false)
  const [pointLabelError, setPointLabelError] = useState<string | null>(null)
  const [containerEvents, setContainerEvents] = useState<ModerationEventRow[]>([])
  const [containerEventsLoading, setContainerEventsLoading] = useState(false)
  const [unassignedEvents, setUnassignedEvents] = useState<ModerationEventRow[]>([])
  const [unassignedLoading, setUnassignedLoading] = useState(false)
  const [unassignedError, setUnassignedError] = useState<string | null>(null)
  const [detailEvent, setDetailEvent] = useState<ModerationEventRow | null>(null)
  const [newEventModalOpen, setNewEventModalOpen] = useState(false)
  const [assigningEventId, setAssigningEventId] = useState<string | null>(null)
  const [convertingToContainer, setConvertingToContainer] = useState(false)
  const [modalContainerId, setModalContainerId] = useState<string | null>(null)
  const [editingLayer, setEditingLayer] = useState<{
    id: string
    name: string
    type: string
    geojson: { type: string; features: Array<{ geometry: { type: string; coordinates: number[][] | number[][][] }; properties?: Record<string, unknown> }> }
  } | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [newPointLayerName, setNewPointLayerName] = useState("")
  const [creatingPointLayer, setCreatingPointLayer] = useState(false)
  const [creatingPointLayerError, setCreatingPointLayerError] = useState<string | null>(null)

  const loadCatalog = async () => {
    const res = await fetch("/api/admin/layer-catalog", { credentials: "include" })
    if (res.ok) setTree((await res.json()) ?? [])
  }

  const loadGeodata = async () => {
    const res = await fetch("/api/admin/layer-geodata", { credentials: "include" })
    if (res.ok) setGeodata((await res.json()) ?? [])
  }

  const loadContainerEvents = useCallback(async (containerId: string) => {
    setContainerEventsLoading(true)
    try {
      const res = await fetch(`/api/admin/events?container_id=${encodeURIComponent(containerId)}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setContainerEvents(data.data ?? [])
      } else {
        setContainerEvents([])
      }
    } finally {
      setContainerEventsLoading(false)
    }
  }, [])

  const loadUnassignedEvents = useCallback(async () => {
    setUnassignedLoading(true)
    setUnassignedError(null)
    try {
      const res = await fetch("/api/admin/events?unassigned_only=1&pageSize=100", { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setUnassignedEvents((data.data ?? []) as ModerationEventRow[])
      } else {
        setUnassignedEvents([])
        setUnassignedError(typeof data.error === "string" ? data.error : "Error al cargar eventos sin contenedor")
      }
    } finally {
      setUnassignedLoading(false)
    }
  }, [])

  useEffect(() => {
    let done = false
    async function load() {
      try {
        await Promise.all([loadCatalog(), loadGeodata()])
      } finally {
        if (!done) setLoading(false)
      }
    }
    load()
    return () => { done = true }
  }, [])

  useEffect(() => {
    if (tree.length > 0 && !selectedCategoryForCreate) setSelectedCategoryForCreate(tree[0].id)
  }, [tree, selectedCategoryForCreate])

  useEffect(() => {
    if (pointLabelModal && modalContainerId) {
      loadContainerEvents(modalContainerId)
      loadUnassignedEvents()
    } else if (!pointLabelModal) {
      setContainerEvents([])
      setUnassignedEvents([])
      setUnassignedError(null)
      setDetailEvent(null)
      setNewEventModalOpen(false)
    }
  }, [pointLabelModal, modalContainerId, loadContainerEvents, loadUnassignedEvents])

  useEffect(() => {
    const id = selectedLayer?.id
    if (!id) return
    const next = geodata.find((g) => g.id === id)
    if (next) setSelectedLayer(next)
    else setSelectedLayer(null)
  }, [geodata, selectedLayer?.id])

  const handleSubmitGeodata = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeodataError(null)
    if (!selectedCategoryForCreate || !geodataForm.name.trim() || !geodataForm.geojsonText.trim()) {
      setGeodataError("Elige categoría, nombre y pega el GeoJSON")
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
          group_id: selectedCategoryForCreate,
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
    if (!selectedLayer || selectedLayer.type !== "point") {
      setPointError("Selecciona una capa de puntos primero")
      return
    }
    const lat = parseFloat(pointForm.lat)
    const lng = parseFloat(pointForm.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setPointError("Lat y lng deben ser números")
      return
    }
    const newFeature = {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lng, lat] as [number, number] },
      properties: {
        name: pointForm.name.trim() || "Punto",
        [GEO_POINT_ID_KEY]: crypto.randomUUID(),
      },
    }
    setSubmittingPoint(true)
    try {
      const getRes = await fetch(`/api/admin/layer-geodata/${selectedLayer.id}`, { credentials: "include" })
      if (!getRes.ok) {
        setPointError("No se pudo cargar la capa")
        return
      }
      const layerData = await getRes.json()
      const currentFeatures = layerData.geojson?.features ?? []
      const geojson = {
        type: "FeatureCollection" as const,
        features: [...currentFeatures, newFeature],
      }
      const res = await fetch("/api/admin/layer-geodata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selectedLayer.id, geojson }),
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

  const handleCreateEmptyPointLayer = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingPointLayerError(null)
    if (!selectedCategoryForCreate || !newPointLayerName.trim()) {
      setCreatingPointLayerError("Elige categoría y nombre")
      return
    }
    setCreatingPointLayer(true)
    try {
      const res = await fetch("/api/admin/layer-geodata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          group_id: selectedCategoryForCreate,
          sublayer_id: null,
          sub_sublayer_id: null,
          name: newPointLayerName.trim(),
          type: "point" as const,
          geojson: { type: "FeatureCollection", features: [] },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setNewPointLayerName("")
        await loadGeodata()
        if (data?.id) {
          setSelectedLayer({
            id: data.id,
            name: data.name ?? newPointLayerName.trim(),
            type: "point",
            group_id: data.group_id ?? selectedCategoryForCreate,
            sublayer_id: data.sublayer_id ?? null,
            sub_sublayer_id: data.sub_sublayer_id ?? null,
            created_at: data.created_at ?? "",
          })
        }
      } else {
        setCreatingPointLayerError(data.error ?? "Error al crear")
      }
    } finally {
      setCreatingPointLayer(false)
    }
  }

  const groupName = (id: string) => tree.find((g) => g.id === id)?.name ?? id
  const geodataFiltered = listFilterCategoryId ? geodata.filter((gd) => gd.group_id === listFilterCategoryId) : geodata

  const handleEditLayer = async (id: string) => {
    setEditLoading(true)
    try {
      const res = await fetch(`/api/admin/layer-geodata/${id}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        if (data.geojson && (data.type === "line" || data.type === "polygon")) {
          setEditingLayer({ id: data.id, name: data.name, type: data.type, geojson: data.geojson })
        }
      }
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteLayer = async (id: string) => {
    const res = await fetch(`/api/admin/layer-geodata/${id}`, { method: "DELETE", credentials: "include" })
    if (res.ok) {
      setDeleteConfirmId(null)
      setEditingLayer((prev) => (prev?.id === id ? null : prev))
      setSelectedLayer((prev) => (prev?.id === id ? null : prev))
      await loadGeodata()
    }
  }


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

        <div className="flex flex-row gap-8 items-start w-full">
            <div className="w-[380px] shrink-0 min-w-[320px] overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
            {loading ? (
              <p className="font-mono text-sm text-[var(--parchment-dim)]">Cargando capas…</p>
            ) : (
            <>
            {/* Gestionar categorías */}
            <section className="mb-6">
              <button
                type="button"
                onClick={() => setLeftPanelOpen((p) => ({ ...p, capa: !p.capa }))}
                className="flex items-center justify-between w-full font-serif text-lg font-medium text-[var(--parchment)] mb-2"
              >
                Categorías del mapa
                <span className="font-mono text-sm text-[var(--parchment-dim)]">{leftPanelOpen.capa ? "−" : "+"}</span>
              </button>
              {leftPanelOpen.capa && (
              <>
              <p className="font-mono text-xs text-[var(--parchment-dim)] mb-2">
                Grupos para organizar capas (Transporte, Indicadores, etc.).
              </p>
              <ul className="font-mono text-xs text-[var(--parchment)] space-y-1 mb-2">
                {tree.map((g) => (
                  <li key={g.id}>{g.code} — {g.name}</li>
                ))}
              </ul>
              <AddCategoryForm onAdded={loadCatalog} />
              </>
              )}
            </section>

            {/* Seleccionar capa */}
            <section className="mb-6">
              <h2 className="font-serif text-lg font-medium text-[var(--parchment)] mb-2">
                Seleccionar capa
              </h2>
              <p className="font-mono text-xs text-[var(--parchment-dim)] mb-2">
                Elige una capa para añadir puntos, editarlos o unirlos en una línea.
              </p>
              <label className="block mb-2">
                <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Filtro por categoría</span>
                <select
                  value={listFilterCategoryId}
                  onChange={(e) => setListFilterCategoryId(e.target.value)}
                  className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full mt-1"
                >
                  <option value="">Todas</option>
                  {tree.map((g) => (
                    <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                  ))}
                </select>
              </label>
              {geodataFiltered.length === 0 ? (
                <p className="font-mono text-xs text-[var(--parchment-dim)] italic">Ninguna aún. Crea una abajo.</p>
              ) : (
                <ul className="space-y-2">
                  {geodataFiltered.map((gd) => (
                    <li
                      key={gd.id}
                      className={`flex items-center justify-between gap-2 font-mono text-xs rounded px-2 py-2 border cursor-pointer transition-colors ${
                        selectedLayer?.id === gd.id
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--parchment)]"
                          : "border-[var(--panel-border)] text-[var(--parchment)] hover:bg-[var(--panel-bg)]"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex-1 text-left min-w-0 truncate"
                        onClick={() => {
                          setSelectedLayer(gd)
                          setEditingLayer(null)
                        }}
                      >
                        {gd.name} ({gd.type}) — {groupName(gd.group_id)}
                      </button>
                      <span className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {(gd.type === "line" || gd.type === "polygon") && (
                          <button
                            type="button"
                            onClick={() => handleEditLayer(gd.id)}
                            disabled={editLoading}
                            className="px-1.5 py-0.5 font-mono text-[10px] border border-[var(--panel-border)] rounded hover:bg-[var(--panel-bg)] disabled:opacity-50"
                          >
                            Editar
                          </button>
                        )}
                        {deleteConfirmId === gd.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeleteLayer(gd.id)}
                              className="px-1.5 py-0.5 font-mono text-[10px] border border-[var(--destructive)] text-[var(--destructive)] rounded hover:bg-[var(--destructive)]/10"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-1.5 py-0.5 font-mono text-[10px] border border-[var(--panel-border)] rounded"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(gd.id)}
                            className="px-1.5 py-0.5 font-mono text-[10px] border border-[var(--panel-border)] rounded hover:bg-[var(--destructive)]/10 text-[var(--destructive)]"
                          >
                            Eliminar
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Trabajar con capa seleccionada */}
              {selectedLayer && (
                <div className="mt-4 p-4 rounded-lg border border-[var(--panel-border)]" style={{ background: "var(--panel-bg)" }}>
                  <h3 className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--parchment-dim)] mb-3">
                    Trabajar con: {selectedLayer.name}
                  </h3>
                  {selectedLayer.type === "point" ? (
                    <>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-mono text-[10px] text-[var(--parchment-dim)] uppercase mb-2">Añadir punto</h4>
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
                        <p className="font-mono text-[10px] text-[var(--parchment-dim)]">
                          Editar punto: haz clic en un punto del mapa para cambiar nombre/label.
                        </p>
                        <p className="font-mono text-[10px] text-[var(--parchment-dim)]">
                          Unir puntos: usa el botón «Unir puntos (línea)» en el mapa y haz clic en los puntos en orden para crear una línea.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleEditLayer(selectedLayer.id)}
                        disabled={editLoading}
                        className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
                      >
                        Editar geometría
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Crear nuevo */}
            <section className="space-y-6 mb-8">
              <button
                type="button"
                onClick={() => setLeftPanelOpen((p) => ({ ...p, geodata: !p.geodata }))}
                className="flex items-center justify-between w-full font-serif text-lg font-medium text-[var(--parchment)] mb-2"
              >
                Crear nueva capa
                <span className="font-mono text-sm text-[var(--parchment-dim)]">{leftPanelOpen.geodata ? "−" : "+"}</span>
              </button>
              {leftPanelOpen.geodata && (
              <>
              <label className="block">
                <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Categoría (para la nueva capa)</span>
                <select
                  value={selectedCategoryForCreate || tree[0]?.id || ""}
                  onChange={(e) => setSelectedCategoryForCreate(e.target.value)}
                  className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full mt-1"
                >
                  {tree.length === 0 && <option value="">Sin categorías (añade una arriba)</option>}
                  {tree.map((g) => (
                    <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                  ))}
                </select>
              </label>
                {/* Cargar GeoJSON (array completo) */}
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

                {/* Nueva capa de puntos vacía */}
                <div className="border border-[var(--panel-border)] rounded-lg p-4" style={{ background: "var(--panel-bg)" }}>
                  <h3 className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--parchment-dim)] mb-3">
                    Nueva capa de puntos
                  </h3>
                  <p className="font-mono text-[10px] text-[var(--parchment-dim)] mb-2">
                    Crea una capa vacía para añadir puntos manualmente y luego unirlos en una línea.
                  </p>
                  <form onSubmit={handleCreateEmptyPointLayer} className="flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Nombre</span>
                      <input
                        type="text"
                        value={newPointLayerName}
                        onChange={(e) => setNewPointLayerName(e.target.value)}
                        placeholder="ej. Estaciones Metro L2"
                        className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-48"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={creatingPointLayer || !selectedCategoryForCreate}
                      className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
                    >
                      {creatingPointLayer ? "Creando…" : "Crear capa de puntos"}
                    </button>
                  </form>
                  {creatingPointLayerError && <p className="font-mono text-xs text-[var(--destructive)] mt-2">{creatingPointLayerError}</p>}
                </div>
              </>
              )}
            </section>
            </>
            )}
            </div>
            {/* Mapa: siempre visible */}
            <div className="flex-1 min-w-0 sticky top-6 flex flex-col min-h-[400px]">
              <h3 className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--parchment-dim)] mb-2 shrink-0">
                Mapa (todas las capas)
              </h3>
              <GeodataEditorMap
                groupId={selectedLayer?.type === "point" ? selectedLayer.group_id : selectedCategoryForCreate || null}
                groupCode={null}
                selectedLayerId={selectedLayer?.id ?? null}
                selectedLayerGroupId={selectedLayer?.group_id ?? null}
                selectedLayerType={selectedLayer?.type ?? null}
                items={selectedLayer ? [selectedLayer] : []}
                onSaved={async () => {
                  await loadGeodata()
                  setEditingLayer(null)
                }}
                editingLayer={editingLayer}
                onCancelEdit={() => setEditingLayer(null)}
                onPointSelect={(params) => {
                  if (selectedLayer && params.layerGeodataId !== selectedLayer.id) return
                  setPointLabelModal(params)
                  setModalContainerId(params.location_container_id ?? null)
                }}
                layoutThreeColumns
                className="w-full h-full"
              />
            </div>
          </div>

        {/* Modal: editar label de punto */}
        {pointLabelModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              if (!pointLabelSaving) {
                if (detailEvent || newEventModalOpen) {
                  setDetailEvent(null)
                  setNewEventModalOpen(false)
                  return
                }
                setPointLabelModal(null)
                setModalContainerId(null)
              }
            }}
          >
            <div
              key={`${pointLabelModal.layerGeodataId}-${pointLabelModal.geo_point_id}-${pointLabelModal.location_container_id ?? "none"}`}
              className="border border-[var(--panel-border)] rounded-lg p-4 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
              style={{ background: "var(--panel-bg)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-lg text-[var(--parchment)] mb-3">Editar punto</h3>
              <div className="space-y-4">
                <label className="block">
                  <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Nombre</span>
                  <input
                    type="text"
                    defaultValue={pointLabelModal.name}
                    id="point-label-name"
                    className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 w-full bg-transparent text-[var(--parchment)]"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] text-[var(--parchment-dim)] block mb-1">Label (popup al tocar)</span>
                  <input
                    type="text"
                    defaultValue={pointLabelModal.label}
                    id="point-label-label"
                    className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 w-full bg-transparent text-[var(--parchment)]"
                  />
                </label>

                {/* Punto contenedor */}
                <div className="border-t border-[var(--panel-border)] pt-3">
                  <h4 className="font-mono text-[10px] text-[var(--parchment-dim)] uppercase mb-2">Punto contenedor</h4>
                  {!modalContainerId ? (
                    <button
                      type="button"
                      disabled={convertingToContainer}
                      onClick={async () => {
                        if (!pointLabelModal) return
                        setPointLabelError(null)
                        setConvertingToContainer(true)
                        try {
                          const lat = pointLabelModal.coordinates[1]
                          const lng = pointLabelModal.coordinates[0]
                          const label = pointLabelModal.name?.trim() || pointLabelModal.label?.trim() || null
                          const res = await fetch("/api/admin/containers", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ lat, lng, label }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok || !data.id) {
                            setPointLabelError(data.error ?? "Error al convertir")
                            return
                          }
                          const features = [...(pointLabelModal.geojson.features ?? [])]
                          let idx = features.findIndex(
                            (f) => f.properties?.[GEO_POINT_ID_KEY] === pointLabelModal.geo_point_id
                          )
                          if (idx < 0 && !pointLabelModal.geo_point_id) {
                            idx = pointLabelModal.featureIndex
                          }
                          if (idx < 0 || idx >= features.length) {
                            setPointLabelError("No se encontró el punto en la capa")
                            return
                          }
                          const feat = features[idx]
                          features[idx] = {
                            ...feat,
                            properties: { ...feat.properties, location_container_id: data.id },
                          }
                          const patchRes = await fetch("/api/admin/layer-geodata", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                              id: pointLabelModal.layerGeodataId,
                              geojson: { type: "FeatureCollection", features },
                            }),
                          })
                          if (patchRes.ok) {
                            setModalContainerId(data.id)
                            await loadGeodata()
                          } else {
                            const patchData = await patchRes.json().catch(() => ({}))
                            setPointLabelError(patchData.error ?? "Error al guardar")
                          }
                        } finally {
                          setConvertingToContainer(false)
                        }
                      }}
                      className="px-2 py-1 font-mono text-[10px] border border-[var(--primary)] text-[var(--primary)] rounded hover:bg-[var(--primary)]/10 disabled:opacity-50"
                    >
                      {convertingToContainer ? "Convirtiendo…" : "Convertir en contenedor"}
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[var(--parchment)]">Es punto contenedor</span>
                      <button
                        type="button"
                        onClick={() => setModalContainerId(null)}
                        className="px-2 py-1 font-mono text-[10px] border border-[var(--destructive)]/50 text-[var(--destructive)] rounded hover:bg-[var(--destructive)]/10"
                      >
                        Dejar de ser contenedor
                      </button>
                    </div>
                  )}
                </div>

                {/* Eventos: vinculados + disponibles (sin contenedor) */}
                {modalContainerId && (
                  <div className="border-t border-[var(--panel-border)] pt-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-mono text-[10px] text-[var(--parchment-dim)] uppercase mb-2">En este punto</h4>
                        {containerEventsLoading ? (
                          <p className="font-mono text-xs text-[var(--parchment-dim)]">Cargando…</p>
                        ) : containerEvents.length === 0 ? (
                          <p className="font-mono text-xs text-[var(--parchment-dim)] italic">Ningún evento asociado</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
                            {containerEvents.map((ev) => (
                              <div
                                key={ev.id}
                                className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border border-[var(--panel-border)]"
                                style={{ background: "var(--background)" }}
                              >
                                <span className="font-mono text-xs text-[var(--parchment)] truncate flex-1" title={ev.title ?? undefined}>
                                  {ev.title || "Sin título"}
                                </span>
                                <span className="font-mono text-[10px] text-[var(--parchment-dim)] shrink-0">
                                  {ev.occurred_at ? new Date(ev.occurred_at).toLocaleDateString() : "—"}
                                </span>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setDetailEvent(ev)}
                                    className="px-2 py-0.5 font-mono text-[10px] border border-[var(--panel-border)] rounded hover:bg-[var(--panel-bg)]"
                                  >
                                    Detalle
                                  </button>
                                  <Link
                                    href="/admin"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-0.5 font-mono text-[10px] border border-[var(--panel-border)] rounded hover:bg-[var(--panel-bg)]"
                                  >
                                    Admin
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/admin/events/${ev.id}/container`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          credentials: "include",
                                          body: JSON.stringify({ location_container_id: null }),
                                        })
                                        if (res.ok) {
                                          setContainerEvents((prev) => prev.filter((e) => e.id !== ev.id))
                                          await loadUnassignedEvents()
                                        }
                                      } catch {
                                        /* ignore */
                                      }
                                    }}
                                    className="px-2 py-0.5 font-mono text-[10px] border border-[var(--destructive)]/50 text-[var(--destructive)] rounded hover:bg-[var(--destructive)]/10"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setNewEventModalOpen(true)}
                          className="px-2 py-1 font-mono text-[10px] border border-[var(--primary)] text-[var(--primary)] rounded hover:bg-[var(--primary)]/10"
                        >
                          Nueva observación
                        </button>
                      </div>
                      <div className="border-t lg:border-t-0 lg:border-l border-[var(--panel-border)] pt-3 lg:pt-0 lg:pl-4">
                        <h4 className="font-mono text-[10px] text-[var(--parchment-dim)] uppercase mb-2">Sin contenedor</h4>
                        {unassignedLoading ? (
                          <p className="font-mono text-xs text-[var(--parchment-dim)]">Cargando…</p>
                        ) : unassignedError ? (
                          <p className="font-mono text-xs text-[var(--destructive)]">{unassignedError}</p>
                        ) : unassignedEvents.length === 0 ? (
                          <p className="font-mono text-xs text-[var(--parchment-dim)] italic">No hay eventos sin contenedor</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {unassignedEvents.map((ev) => (
                              <div
                                key={ev.id}
                                className="flex flex-wrap items-center gap-1.5 py-1.5 px-2 rounded border border-[var(--panel-border)]"
                                style={{ background: "var(--background)" }}
                              >
                                <span className="font-mono text-xs text-[var(--parchment)] truncate flex-1 min-w-[120px]" title={ev.title ?? undefined}>
                                  {ev.title?.trim() ||
                                    (ev.description.length > 48 ? `${ev.description.slice(0, 48)}…` : ev.description)}
                                </span>
                                <span className="font-mono text-[10px] text-[var(--parchment-dim)] shrink-0">
                                  {ev.occurred_at ? new Date(ev.occurred_at).toLocaleDateString() : "—"}
                                </span>
                                <div className="flex gap-1 shrink-0 w-full sm:w-auto justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setDetailEvent(ev)}
                                    className="px-2 py-0.5 font-mono text-[10px] border border-[var(--panel-border)] rounded hover:bg-[var(--panel-bg)]"
                                  >
                                    Detalle
                                  </button>
                                  <button
                                    type="button"
                                    disabled={assigningEventId === ev.id}
                                    onClick={async () => {
                                      if (!modalContainerId) return
                                      setAssigningEventId(ev.id)
                                      try {
                                        const res = await fetch(`/api/admin/events/${ev.id}/container`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          credentials: "include",
                                          body: JSON.stringify({ location_container_id: modalContainerId }),
                                        })
                                        if (res.ok) {
                                          await loadContainerEvents(modalContainerId)
                                          await loadUnassignedEvents()
                                        }
                                      } finally {
                                        setAssigningEventId(null)
                                      }
                                    }}
                                    className="px-2 py-0.5 font-mono text-[10px] border border-[var(--primary)] text-[var(--primary)] rounded hover:bg-[var(--primary)]/10 disabled:opacity-50"
                                  >
                                    {assigningEventId === ev.id ? "…" : "Asignar"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {pointLabelError && <p className="font-mono text-xs text-[var(--destructive)]">{pointLabelError}</p>}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!pointLabelSaving) {
                        setDetailEvent(null)
                        setNewEventModalOpen(false)
                        setPointLabelModal(null)
                        setModalContainerId(null)
                      }
                    }}
                    className="px-3 py-1.5 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment)] rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pointLabelSaving}
                    onClick={async () => {
                      const nameEl = document.getElementById("point-label-name") as HTMLInputElement | null
                      const labelEl = document.getElementById("point-label-label") as HTMLInputElement | null
                      const name = nameEl?.value.trim() ?? pointLabelModal.name
                      const label = labelEl?.value.trim() ?? pointLabelModal.label
                      setPointLabelError(null)
                      setPointLabelSaving(true)
                      try {
                        const features = [...(pointLabelModal.geojson.features ?? [])]
                        let idx = features.findIndex(
                          (f) => f.properties?.[GEO_POINT_ID_KEY] === pointLabelModal.geo_point_id
                        )
                        if (idx < 0 && !pointLabelModal.geo_point_id) {
                          idx = pointLabelModal.featureIndex
                        }
                        if (idx < 0 || idx >= features.length) {
                          setPointLabelError("No se encontró el punto en la capa")
                          return
                        }
                        const feat = features[idx]
                        features[idx] = {
                          ...feat,
                          properties: {
                            ...feat.properties,
                            name,
                            label,
                            location_container_id: modalContainerId ?? null,
                          },
                        }
                        const res = await fetch("/api/admin/layer-geodata", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ id: pointLabelModal.layerGeodataId, geojson: { type: "FeatureCollection", features } }),
                        })
                        const data = await res.json().catch(() => ({}))
                        if (res.ok) {
                          setDetailEvent(null)
                          setNewEventModalOpen(false)
                          setPointLabelModal(null)
                          setModalContainerId(null)
                          await loadGeodata()
                        } else {
                          setPointLabelError(data.error ?? "Error al guardar")
                        }
                      } finally {
                        setPointLabelSaving(false)
                      }
                    }}
                    className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
                  >
                    {pointLabelSaving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {pointLabelModal && detailEvent && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-detail-title"
            onClick={() => setDetailEvent(null)}
          >
            <div
              className="border border-[var(--panel-border)] rounded-lg p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
              style={{ background: "var(--panel-bg)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="event-detail-title" className="font-serif text-lg text-[var(--parchment)] mb-3">
                Detalle de la observación
              </h3>
              <dl className="space-y-3 text-[var(--parchment)]">
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Título</dt>
                  <dd className="font-serif text-sm mt-0.5">{detailEvent.title?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Descripción</dt>
                  <dd className="font-serif text-sm mt-0.5 whitespace-pre-wrap">{detailEvent.description}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Fecha</dt>
                  <dd className="font-mono text-xs mt-0.5">
                    {detailEvent.occurred_at ? new Date(detailEvent.occurred_at).toLocaleString() : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Tipo</dt>
                  <dd className="font-mono text-xs mt-0.5">{eventTypeLabel(detailEvent.event_type)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Intensidad</dt>
                  <dd className="font-mono text-xs mt-0.5">
                    {emotionalIntensityLabel(detailEvent.emotional_intensity)} ({detailEvent.emotional_intensity})
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Ubicación (texto)</dt>
                  <dd className="font-mono text-xs mt-0.5">{detailEvent.location_label?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Anónimo</dt>
                  <dd className="font-mono text-xs mt-0.5">{detailEvent.is_anonymous ? "Sí" : "No"}</dd>
                </div>
                {detailEvent.status != null && (
                  <div>
                    <dt className="font-mono text-[10px] uppercase text-[var(--parchment-dim)]">Estado</dt>
                    <dd className="font-mono text-xs mt-0.5">{detailEvent.status}</dd>
                  </div>
                )}
              </dl>
              <div className="flex justify-end mt-4 pt-3 border-t border-[var(--panel-border)]">
                <button
                  type="button"
                  onClick={() => setDetailEvent(null)}
                  className="px-3 py-1.5 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment)] rounded hover:bg-[var(--background)]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {pointLabelModal && newEventModalOpen && modalContainerId && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-event-modal-title"
            onClick={() => setNewEventModalOpen(false)}
          >
            <div
              className="border border-[var(--panel-border)] rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
              style={{ background: "var(--panel-bg)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="new-event-modal-title" className="font-serif text-lg text-[var(--parchment)] mb-3">
                Nueva observación
              </h3>
              <EventForm
                key={`${modalContainerId}-${newEventModalOpen}`}
                defaultContainerId={modalContainerId}
                skipNavigationRedirect
                onSuccess={() => {
                  setNewEventModalOpen(false)
                  void loadContainerEvents(modalContainerId)
                  void loadUnassignedEvents()
                }}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
