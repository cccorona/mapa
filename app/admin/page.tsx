"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { METRO_LINE2_COORDS } from "@/lib/metro-station-coords"

const STATION_NAMES = Object.keys(METRO_LINE2_COORDS) as string[]

type EventRow = {
  id: string
  event_type: string
  occurred_at: string
  description: string
  status: string
}

type LandmarkRow = {
  id: string
  name: string
  lng: number
  lat: number
  icon_url: string
}

export default function AdminPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [landmarks, setLandmarks] = useState<LandmarkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [landmarkSubmitting, setLandmarkSubmitting] = useState(false)
  const [landmarkForm, setLandmarkForm] = useState({
    name: "",
    lng: "",
    lat: "",
  })
  const [landmarkFile, setLandmarkFile] = useState<File | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [eventsRes, landmarksRes] = await Promise.all([
        fetch("/api/admin/events", { credentials: "include" }),
        supabase.rpc("get_landmarks"),
      ])
      const eventsData = eventsRes.ok ? await eventsRes.json() : []
      const rows = (eventsData ?? []).map((r: EventRow) => ({
        id: r.id,
        event_type: r.event_type,
        occurred_at: r.occurred_at,
        description: r.description,
        status: r.status,
      }))
      setEvents(rows)
      setLandmarks((landmarksRes.data ?? []) as LandmarkRow[])
      setLoading(false)
    }
    load()
  }, [])

  const handleStatusChange = async (id: string, status: "approved" | "rejected") => {
    const res = await fetch(`/api/admin/events/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "include",
    })
    if (res.ok) setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
  }

  const handleAssignStation = async (eventId: string, stationName: string) => {
    const coords = METRO_LINE2_COORDS[stationName]
    if (!coords) return
    setAssigningId(eventId)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          location_label: `Metro ${stationName}`,
        }),
        credentials: "include",
      })
      if (res.ok) setAssigningId(null)
    } finally {
      setAssigningId(null)
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
            <h1 className="font-serif text-xl font-medium text-[var(--parchment)]">
              Moderación
            </h1>
            <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--parchment-dim)]">
              Eventos pendientes de revisión
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/landmarks"
              className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
            >
              Subir landmarks
            </Link>
            <Link
              href="/"
              className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
            >
              Volver al mapa
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="font-mono text-sm text-[var(--parchment-dim)]">Cargando…</p>
        ) : (
          <ul className="space-y-4">
            {events.map((e) => (
              <li
                key={e.id}
                className="border border-[var(--panel-border)] rounded-lg p-4"
                style={{ background: "var(--panel-bg)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] tracking-wide text-[var(--primary)]">
                      {e.event_type}
                    </span>
                    <p className="font-serif text-sm text-[var(--parchment)] mt-1 line-clamp-2">
                      {e.description}
                    </p>
                    <time className="font-mono text-[9px] text-[var(--parchment-dim)]">
                      {new Date(e.occurred_at).toLocaleDateString("es-ES")}
                    </time>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`
                        font-mono text-[9px] px-2 py-0.5 rounded
                        ${e.status === "approved" ? "bg-[var(--primary)]/20 text-[var(--primary)]" : ""}
                        ${e.status === "rejected" ? "bg-[var(--destructive)]/20 text-[var(--destructive)]" : ""}
                        ${e.status === "pending" ? "bg-[var(--parchment-dim)]/20 text-[var(--parchment-dim)]" : ""}
                      `}
                    >
                      {e.status}
                    </span>
                    {e.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(e.id, "approved")}
                          className="px-2 py-1 font-mono text-[9px] border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleStatusChange(e.id, "rejected")}
                          className="px-2 py-1 font-mono text-[9px] border border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    <select
                      aria-label="Asignar a estación L2"
                      disabled={assigningId === e.id}
                      onChange={(ev) => {
                        const val = ev.target.value
                        if (val) handleAssignStation(e.id, val)
                        ev.target.value = ""
                      }}
                      className="font-mono text-[9px] border border-[var(--panel-border)] rounded px-2 py-1 bg-transparent text-[var(--parchment-dim)]"
                    >
                      <option value="">Asignar a estación</option>
                      {STATION_NAMES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && events.length === 0 && (
          <p className="font-serif text-sm text-[var(--parchment-dim)] italic">
            No hay eventos para moderar.
          </p>
        )}

        <section className="mt-12 pt-8 border-t border-[var(--panel-border)]">
          <h2 className="font-serif text-lg font-medium text-[var(--parchment)] mb-2">
            Landmarks
          </h2>
          <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--parchment-dim)] mb-4">
            Añadir punto en el mapa (icono desde aquí)
          </p>
          <form
            onSubmit={handleAddLandmark}
            className="flex flex-wrap items-end gap-4 p-4 rounded-lg border border-[var(--panel-border)]"
            style={{ background: "var(--panel-bg)" }}
          >
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Nombre</span>
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
              <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Longitud</span>
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
              <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Latitud</span>
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
              <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Icono (imagen)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLandmarkFile(e.target.files?.[0] ?? null)}
                className="font-mono text-[10px] text-[var(--parchment-dim)] file:mr-2 file:rounded file:border file:border-[var(--panel-border)] file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[var(--parchment)]"
                required
              />
            </label>
            <button
              type="submit"
              disabled={landmarkSubmitting}
              className="px-3 py-1.5 font-mono text-[10px] border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
            >
              {landmarkSubmitting ? "Subiendo…" : "Añadir landmark"}
            </button>
          </form>
          {landmarks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {landmarks.map((lm) => (
                <li
                  key={lm.id}
                  className="font-mono text-[10px] text-[var(--parchment-dim)] flex items-center gap-2"
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
