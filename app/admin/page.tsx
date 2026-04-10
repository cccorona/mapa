"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { METRO_LINE2_COORDS } from "@/lib/metro-station-coords"
import { getStationNameByCode, getStationCodeForName } from "@/lib/event-layers"
import { FM_MHZ_MAX, FM_MHZ_MIN } from "@/lib/radio-constants"

const STATION_NAMES = Object.keys(METRO_LINE2_COORDS) as string[]

const LAYER_DEFAULT = "DEFAULT"
const LAYER_METRO = "METRO"
const METRO_LINEA2 = "LINEA2"

type EventRow = {
  id: string
  event_type: string
  occurred_at: string
  description: string
  title?: string | null
  status: string
  location_label?: string | null
  layer?: string | null
  sublayer?: string | null
  sublayer_detail?: string | null
  location_container_id?: string | null
  frequency_mhz?: number | null
  audio_url?: string | null
}

type LandmarkRow = {
  id: string
  name: string
  lng: number
  lat: number
  icon_url: string
}

const PAGE_SIZE = 20

export default function AdminPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedStationByEvent, setSelectedStationByEvent] = useState<Record<string, string>>({})
  const [selectedLayerByEvent, setSelectedLayerByEvent] = useState<Record<string, "DEFAULT" | "METRO">>({})
  const [landmarks, setLandmarks] = useState<LandmarkRow[]>([])
  const [landmarkSubmitting, setLandmarkSubmitting] = useState(false)
  const [landmarkForm, setLandmarkForm] = useState({
    name: "",
    lng: "",
    lat: "",
  })
  const [landmarkFile, setLandmarkFile] = useState<File | null>(null)
  const [containers, setContainers] = useState<{ id: string; lat: number; lng: number; label: string | null }[]>([])
  const [containerAssigningId, setContainerAssigningId] = useState<string | null>(null)
  const [radioFormByEvent, setRadioFormByEvent] = useState<
    Record<string, { frequency: string; audioUrl: string }>
  >({})
  const [radioSavingId, setRadioSavingId] = useState<string | null>(null)

  const hasMore = events.length < total

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [eventsRes, landmarksRes, containersRes] = await Promise.all([
        fetch(`/api/admin/events?page=1&pageSize=${PAGE_SIZE}`, { credentials: "include" }),
        supabase.rpc("get_landmarks"),
        fetch("/api/admin/containers", { credentials: "include" }),
      ])
      const eventsPayload = eventsRes.ok ? await eventsRes.json() : {}
      const list = eventsPayload.data ?? []
      const totalCount = typeof eventsPayload.total === "number" ? eventsPayload.total : list.length
      const rows = list.map((r: EventRow) => ({
        id: r.id,
        event_type: r.event_type,
        occurred_at: r.occurred_at,
        description: r.description,
        title: r.title ?? null,
        status: r.status,
        location_label: r.location_label ?? null,
        layer: r.layer ?? null,
        sublayer: r.sublayer ?? null,
        sublayer_detail: r.sublayer_detail ?? null,
        location_container_id: r.location_container_id ?? null,
        frequency_mhz: r.frequency_mhz ?? null,
        audio_url: r.audio_url ?? null,
      }))
      setEvents(rows)
      setTotal(totalCount)
      setPage(1)
      setLandmarks((landmarksRes.data ?? []) as LandmarkRow[])
      if (containersRes.ok) setContainers((await containersRes.json()) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const loadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const eventsRes = await fetch(`/api/admin/events?page=${nextPage}&pageSize=${PAGE_SIZE}`, { credentials: "include" })
      const eventsPayload = eventsRes.ok ? await eventsRes.json() : {}
      const list = eventsPayload.data ?? []
      const rows = list.map((r: EventRow) => ({
        id: r.id,
        event_type: r.event_type,
        occurred_at: r.occurred_at,
        description: r.description,
        title: r.title ?? null,
        status: r.status,
        location_label: r.location_label ?? null,
        layer: r.layer ?? null,
        sublayer: r.sublayer ?? null,
        sublayer_detail: r.sublayer_detail ?? null,
        location_container_id: r.location_container_id ?? null,
        frequency_mhz: r.frequency_mhz ?? null,
        audio_url: r.audio_url ?? null,
      }))
      setEvents((prev) => [...prev, ...rows])
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleStatusChange = async (id: string, status: "approved" | "rejected") => {
    const res = await fetch(`/api/admin/events/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "include",
    })
    if (res.ok) setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
  }

  const handleAssignStation = async (
    eventId: string,
    stationName: string,
    layer: "DEFAULT" | "METRO" = "METRO"
  ) => {
    if (layer === LAYER_DEFAULT) {
      setAssigningId(eventId)
      try {
        const res = await fetch(`/api/admin/events/${eventId}/layers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layer: LAYER_DEFAULT,
            sublayer: null,
            sublayer_detail: null,
          }),
          credentials: "include",
        })
        if (res.ok) {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === eventId
                ? { ...e, layer: LAYER_DEFAULT, sublayer: null, sublayer_detail: null }
                : e
            )
          )
          setEditingId((id) => (id === eventId ? null : id))
          setSelectedLayerByEvent((prev) => {
            const next = { ...prev }
            delete next[eventId]
            return next
          })
          setSelectedStationByEvent((prev) => {
            const next = { ...prev }
            delete next[eventId]
            return next
          })
        }
      } finally {
        setAssigningId(null)
      }
      return
    }
    const coords = METRO_LINE2_COORDS[stationName]
    if (!coords) return
    setAssigningId(eventId)
    try {
      const stationCode = getStationCodeForName(stationName)
      const res = await fetch(`/api/admin/events/${eventId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          location_label: `Metro ${stationName}`,
          layer: LAYER_METRO,
          sublayer: METRO_LINEA2,
          sublayer_detail: stationCode,
        }),
        credentials: "include",
      })
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  location_label: `Metro ${stationName}`,
                  layer: LAYER_METRO,
                  sublayer: METRO_LINEA2,
                  sublayer_detail: stationCode,
                }
              : e
          )
        )
        setEditingId((id) => (id === eventId ? null : id))
        setSelectedStationByEvent((prev) => {
          const next = { ...prev }
          delete next[eventId]
          return next
        })
        setSelectedLayerByEvent((prev) => {
          const next = { ...prev }
          delete next[eventId]
          return next
        })
      }
    } finally {
      setAssigningId(null)
    }
  }

  const handleSaveLocation = (eventId: string) => {
    const layer = selectedLayerByEvent[eventId] ?? undefined
    const station = selectedStationByEvent[eventId]
    if (layer === LAYER_DEFAULT) {
      handleAssignStation(eventId, "", LAYER_DEFAULT)
      return
    }
    if (station) handleAssignStation(eventId, station, LAYER_METRO)
  }

  const handleSaveRadio = async (e: EventRow) => {
    const rf = radioFormByEvent[e.id]
    const freqStr = (rf?.frequency ?? (e.frequency_mhz != null ? String(e.frequency_mhz) : "")).trim()
    const audioStr = (rf?.audioUrl ?? (e.audio_url ?? "")).trim()
    const body: { frequency_mhz: number | null; audio_url: string | null } = {
      frequency_mhz: null,
      audio_url: audioStr === "" ? null : audioStr,
    }
    if (freqStr === "") {
      body.frequency_mhz = null
    } else {
      const n = Number.parseFloat(freqStr)
      if (!Number.isFinite(n) || n < FM_MHZ_MIN || n > FM_MHZ_MAX) {
        window.alert(`Frecuencia inválida: use ${FM_MHZ_MIN}–${FM_MHZ_MAX}`)
        return
      }
      body.frequency_mhz = n
    }
    setRadioSavingId(e.id)
    try {
      const res = await fetch(`/api/admin/events/${e.id}/radio`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        window.alert(typeof err.error === "string" ? err.error : "Error al guardar")
        return
      }
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === e.id ? { ...evt, frequency_mhz: body.frequency_mhz, audio_url: body.audio_url } : evt
        )
      )
      setRadioFormByEvent((prev) => {
        const next = { ...prev }
        delete next[e.id]
        return next
      })
    } finally {
      setRadioSavingId(null)
    }
  }

  const handleAddLandmark = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = landmarkForm.name.trim()
    const lng = Number(landmarkForm.lng)
    const lat = Number(landmarkForm.lat)
    if (!name || Number.isNaN(lng) || Number.isNaN(lat) || !landmarkFile) return
    setLandmarkSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("name", name)
      formData.set("lng", String(lng))
      formData.set("lat", String(lat))
      formData.set("image", landmarkFile)
      const res = await fetch("/api/landmarks", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data) {
        setLandmarks((prev) => [...prev, data])
        setLandmarkForm({ name: "", lng: "", lat: "" })
        setLandmarkFile(null)
      }
    } finally {
      setLandmarkSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl font-medium text-[var(--parchment)]">
              Moderación
            </h1>
            <p className="font-mono text-xs tracking-[0.15em] uppercase text-[var(--parchment-dim)]">
              Eventos pendientes de revisión
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/capas"
              className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
            >
              Catálogo y datos geo
            </Link>
            <Link
              href="/admin/containers"
              className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
            >
              Puntos contenedores
            </Link>
            <Link
              href="/admin/landmarks"
              className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
            >
              Subir landmarks
            </Link>
            <Link
              href="/"
              className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
            >
              Volver al mapa
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="font-mono text-sm text-[var(--parchment-dim)]">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((e) => (
                <article
                  key={e.id}
                  className="border border-[var(--panel-border)] rounded-lg p-4 flex flex-col"
                  style={{ background: "var(--panel-bg)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs tracking-wide text-[var(--primary)]">
                      {e.event_type}
                    </span>
                    <span
                      className={`
                        font-mono text-xs px-2 py-0.5 rounded flex-shrink-0
                        ${e.status === "approved" ? "bg-[var(--primary)]/20 text-[var(--primary)]" : ""}
                        ${e.status === "rejected" ? "bg-[var(--destructive)]/20 text-[var(--destructive)]" : ""}
                        ${e.status === "pending" ? "bg-[var(--parchment-dim)]/20 text-[var(--parchment-dim)]" : ""}
                      `}
                    >
                      {e.status}
                    </span>
                  </div>
                  {e.title && (
                    <h3 className="font-serif text-sm font-medium text-[var(--parchment)] mb-1 line-clamp-1">
                      {e.title}
                    </h3>
                  )}
                  <p className="font-serif text-sm text-[var(--parchment)] line-clamp-3 flex-1">
                    {e.description}
                  </p>
                  <time className="font-mono text-xs text-[var(--parchment-dim)] mt-2 block">
                    {new Date(e.occurred_at).toLocaleDateString("es-ES")}
                  </time>
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--panel-border)]">
                    {e.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(e.id, "approved")}
                          className="px-2 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(e.id, "rejected")}
                          className="px-2 py-1.5 font-mono text-xs border border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingId((id) => (id === e.id ? null : e.id))}
                      className="px-2 py-1.5 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)] rounded"
                    >
                      {editingId === e.id ? "Cerrar" : "Editar"}
                    </button>
                  </div>
                  {editingId === e.id && (
                    <div className="mt-3 pt-3 border-t border-[var(--panel-border)] space-y-2">
                      <p className="font-mono text-xs text-[var(--parchment-dim)]">
                        Capa actual:{" "}
                        {e.layer === LAYER_METRO && e.sublayer_detail
                          ? `${LAYER_METRO} → ${e.sublayer ?? ""} → ${getStationNameByCode(e.sublayer_detail) ?? e.sublayer_detail}`
                          : (e.layer ?? LAYER_DEFAULT)}
                      </p>
                      <label className="block">
                        <span className="font-mono text-xs text-[var(--parchment-dim)] block mb-1">
                          Capa
                        </span>
                        <select
                          aria-label="Capa"
                          value={selectedLayerByEvent[e.id] ?? (e.layer === LAYER_METRO ? "METRO" : "DEFAULT")}
                          onChange={(ev) => {
                            const v = ev.target.value as "DEFAULT" | "METRO"
                            setSelectedLayerByEvent((prev) => ({ ...prev, [e.id]: v }))
                            if (v === LAYER_DEFAULT)
                              setSelectedStationByEvent((prev) => {
                                const next = { ...prev }
                                delete next[e.id]
                                return next
                              })
                          }}
                          className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full"
                        >
                          <option value="DEFAULT">Por defecto</option>
                          <option value="METRO">Metro (Línea 2)</option>
                        </select>
                      </label>
                      {(selectedLayerByEvent[e.id] ?? (e.layer === LAYER_METRO ? "METRO" : "DEFAULT")) === "METRO" && (
                        <label className="block">
                          <span className="font-mono text-xs text-[var(--parchment-dim)] block mb-1">
                            Estación
                          </span>
                          <select
                            aria-label="Estación L2"
                            value={selectedStationByEvent[e.id] ?? (e.sublayer_detail ? getStationNameByCode(e.sublayer_detail) ?? "" : "")}
                            onChange={(ev) =>
                              setSelectedStationByEvent((prev) => ({ ...prev, [e.id]: ev.target.value }))
                            }
                            className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full"
                          >
                            <option value="">Elegir estación</option>
                            {STATION_NAMES.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="block">
                        <span className="font-mono text-xs text-[var(--parchment-dim)] block mb-1">
                          Punto contenedor
                        </span>
                        <select
                          aria-label="Punto contenedor"
                          value={e.location_container_id ?? ""}
                          onChange={async (ev) => {
                            const val = ev.target.value || null
                            setContainerAssigningId(e.id)
                            try {
                              const res = await fetch(`/api/admin/events/${e.id}/container`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ location_container_id: val }),
                              })
                              if (res.ok)
                                setEvents((prev) =>
                                  prev.map((evt) =>
                                    evt.id === e.id ? { ...evt, location_container_id: val } : evt
                                  )
                                )
                            } finally {
                              setContainerAssigningId(null)
                            }
                          }}
                          disabled={containerAssigningId === e.id}
                          className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full"
                        >
                          <option value="">Ninguno</option>
                          {containers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            assigningId === e.id ||
                            ((selectedLayerByEvent[e.id] ?? (e.layer === LAYER_METRO ? "METRO" : "DEFAULT")) === "METRO" &&
                              !selectedStationByEvent[e.id])
                          }
                          onClick={() => handleSaveLocation(e.id)}
                          className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
                        >
                          {assigningId === e.id ? "Guardando…" : "Guardar ubicación"}
                        </button>
                        {(e.layer === LAYER_METRO || selectedLayerByEvent[e.id] === "METRO") && (
                          <button
                            type="button"
                            disabled={assigningId === e.id}
                            onClick={() => handleAssignStation(e.id, "", LAYER_DEFAULT)}
                            className="px-3 py-1.5 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)] rounded disabled:opacity-50"
                          >
                            Pasar a capa por defecto
                          </button>
                        )}
                      </div>
                      <div className="pt-2 border-t border-[var(--panel-border)] mt-2 space-y-2">
                        <p className="font-mono text-xs text-[var(--parchment-dim)]">Radio FM (exploración en mapa)</p>
                        <label className="block">
                          <span className="font-mono text-xs text-[var(--parchment-dim)] block mb-1">
                            MHz ({FM_MHZ_MIN}–{FM_MHZ_MAX}, vacío = sin radio)
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              radioFormByEvent[e.id]?.frequency ??
                              (e.frequency_mhz != null ? String(e.frequency_mhz) : "")
                            }
                            onChange={(ev) =>
                              setRadioFormByEvent((prev) => ({
                                ...prev,
                                [e.id]: {
                                  frequency: ev.target.value,
                                  audioUrl:
                                    prev[e.id]?.audioUrl ?? (e.audio_url ?? ""),
                                },
                              }))
                            }
                            className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full"
                          />
                        </label>
                        <label className="block">
                          <span className="font-mono text-xs text-[var(--parchment-dim)] block mb-1">
                            URL audio (MP3)
                          </span>
                          <input
                            type="url"
                            value={radioFormByEvent[e.id]?.audioUrl ?? (e.audio_url ?? "")}
                            onChange={(ev) =>
                              setRadioFormByEvent((prev) => ({
                                ...prev,
                                [e.id]: {
                                  frequency:
                                    prev[e.id]?.frequency ??
                                    (e.frequency_mhz != null ? String(e.frequency_mhz) : ""),
                                  audioUrl: ev.target.value,
                                },
                              }))
                            }
                            placeholder="https://…"
                            className="font-mono text-xs border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-full"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={radioSavingId === e.id}
                          onClick={() => handleSaveRadio(e)}
                          className="px-3 py-1.5 font-mono text-xs border border-[var(--sepia)]/50 text-[var(--parchment-dim)] hover:text-[var(--parchment)] rounded disabled:opacity-50"
                        >
                          {radioSavingId === e.id ? "Guardando…" : "Guardar radio"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={loadMore}
                  className="px-4 py-2 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment-dim)] hover:text-[var(--parchment)] rounded disabled:opacity-50"
                >
                  {loadingMore ? "Cargando…" : "Cargar más"}
                </button>
              </div>
            )}
          </>
        )}

        {!loading && events.length === 0 && (
          <p className="font-serif text-sm text-[var(--parchment-dim)] italic">
            No hay eventos para moderar.
          </p>
        )}

        <section className="mt-12 pt-8 border-t border-[var(--panel-border)]">
          <h2 className="font-serif text-xl font-medium text-[var(--parchment)] mb-2">
            Landmarks
          </h2>
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-[var(--parchment-dim)] mb-4">
            Añadir punto en el mapa (icono desde aquí)
          </p>
          <form
            onSubmit={handleAddLandmark}
            className="flex flex-wrap items-end gap-4 p-4 rounded-lg border border-[var(--panel-border)]"
            style={{ background: "var(--panel-bg)" }}
          >
            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs text-[var(--parchment-dim)]">Nombre</span>
              <input
                type="text"
                value={landmarkForm.name}
                onChange={(e) => setLandmarkForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ej. Bellas Artes"
                className="font-mono text-sm border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-40"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs text-[var(--parchment-dim)]">Longitud</span>
              <input
                type="text"
                inputMode="decimal"
                value={landmarkForm.lng}
                onChange={(e) => setLandmarkForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="-99.14"
                className="font-mono text-sm border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-24"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs text-[var(--parchment-dim)]">Latitud</span>
              <input
                type="text"
                inputMode="decimal"
                value={landmarkForm.lat}
                onChange={(e) => setLandmarkForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="19.43"
                className="font-mono text-sm border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)] w-24"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs text-[var(--parchment-dim)]">Icono (imagen)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLandmarkFile(e.target.files?.[0] ?? null)}
                className="font-mono text-xs text-[var(--parchment-dim)] file:mr-2 file:rounded file:border file:border-[var(--panel-border)] file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[var(--parchment)]"
                required
              />
            </label>
            <button
              type="submit"
              disabled={landmarkSubmitting}
              className="px-3 py-1.5 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
            >
              {landmarkSubmitting ? "Subiendo…" : "Añadir landmark"}
            </button>
          </form>
          {landmarks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {landmarks.map((lm) => (
                <li
                  key={lm.id}
                  className="font-mono text-xs text-[var(--parchment-dim)] flex items-center gap-2"
                >
                  <span className="text-[var(--parchment)]">{lm.name}</span>
                  <span>({lm.lat.toFixed(4)}, {lm.lng.toFixed(4)})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
