"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { EVENT_TYPES, EMOTIONAL_INTENSITY_SCALE } from "@/lib/constants"
import { createEvent } from "@/lib/services/events"
import { getLocationContainersAll } from "@/lib/services/containers"
import type { LocationContainer } from "@/types/container"

interface EventFormProps {
  defaultLat?: number
  defaultLng?: number
  defaultContainerId?: string
  onSuccess?: () => void
}

const DEFAULT_LAT = 19.4326
const DEFAULT_LNG = -99.1332

export function EventForm({ defaultLat, defaultLng, defaultContainerId, onSuccess }: EventFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [containers, setContainers] = useState<LocationContainer[]>([])
  const [containersLoading, setContainersLoading] = useState(true)
  const [form, setForm] = useState({
    event_type: "MAJOR_DECISION" as string,
    useExistingPoint: !!defaultContainerId,
    location_container_id: defaultContainerId ?? "",
    lat: defaultLat ?? DEFAULT_LAT,
    lng: defaultLng ?? DEFAULT_LNG,
    occurred_at: new Date().toISOString().slice(0, 10),
    description: "",
    emotional_intensity: "3" as string,
    is_anonymous: true,
    title: "",
    location: "",
  })

  useEffect(() => {
    getLocationContainersAll()
      .then(setContainers)
      .catch(() => setContainers([]))
      .finally(() => setContainersLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (form.useExistingPoint && form.location_container_id) {
        await createEvent({
          event_type: form.event_type as Parameters<typeof createEvent>[0]["event_type"],
          location_container_id: form.location_container_id,
          occurred_at: form.occurred_at,
          description: form.description,
          emotional_intensity: form.emotional_intensity as "1" | "2" | "3" | "4" | "5",
          is_anonymous: form.is_anonymous,
          title: form.title || undefined,
          location: form.location || undefined,
        })
      } else {
        await createEvent({
          event_type: form.event_type as Parameters<typeof createEvent>[0]["event_type"],
          lat: form.lat,
          lng: form.lng,
          occurred_at: form.occurred_at,
          description: form.description,
          emotional_intensity: form.emotional_intensity as "1" | "2" | "3" | "4" | "5",
          is_anonymous: form.is_anonymous,
          title: form.title || undefined,
          location: form.location || undefined,
        })
      }
      onSuccess?.()
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          className="px-4 py-3 border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 text-[var(--destructive-foreground)] font-mono text-sm rounded-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
          Tipo de evento
        </label>
        <select
          value={form.event_type}
          onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
          required
          className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
          Fecha
        </label>
        <input
          type="date"
          value={form.occurred_at}
          onChange={(e) => setForm((f) => ({ ...f, occurred_at: e.target.value }))}
          required
          className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
          Descripción (mín. 10 caracteres)
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-serif text-sm focus:outline-none focus:border-[var(--sepia)] resize-none"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
          Intensidad emocional
        </label>
        <select
          value={form.emotional_intensity}
          onChange={(e) => setForm((f) => ({ ...f, emotional_intensity: e.target.value }))}
          required
          className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
        >
          {EMOTIONAL_INTENSITY_SCALE.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label} – {i.level}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="anonymous"
          checked={form.is_anonymous}
          onChange={(e) => setForm((f) => ({ ...f, is_anonymous: e.target.checked }))}
          className="rounded border-[var(--panel-border)]"
        />
        <label htmlFor="anonymous" className="font-mono text-xs text-[var(--parchment-dim)]">
          Registrar como anónimo
        </label>
      </div>

      <div>
        <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
          Ubicación en el mapa
        </span>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="locationMode"
              checked={!form.useExistingPoint}
              onChange={() => setForm((f) => ({ ...f, useExistingPoint: false, location_container_id: "" }))}
              className="border-[var(--panel-border)]"
            />
            <span className="font-mono text-sm text-[var(--parchment)]">Nueva ubicación (lat/lng)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="locationMode"
              checked={form.useExistingPoint}
              onChange={() => setForm((f) => ({ ...f, useExistingPoint: true }))}
              className="border-[var(--panel-border)]"
            />
            <span className="font-mono text-sm text-[var(--parchment)]">En un punto existente</span>
          </label>
          {form.useExistingPoint && (
            <div className="pl-6">
              <select
                value={form.location_container_id}
                onChange={(e) => setForm((f) => ({ ...f, location_container_id: e.target.value }))}
                required={form.useExistingPoint}
                className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
              >
                <option value="">Selecciona un punto</option>
                {containersLoading ? (
                  <option value="" disabled>Cargando…</option>
                ) : (
                  containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Punto ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {!form.useExistingPoint && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
              Latitud
            </label>
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setForm((f) => ({ ...f, lat: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
              Longitud
            </label>
            <input
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setForm((f) => ({ ...f, lng: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
          Ubicación (opcional)
        </label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          placeholder="Ej. Ciudad de México, Colonia Roma"
          maxLength={500}
          className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)] placeholder:text-[var(--parchment-dim)]/50"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
          Título (opcional)
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Frase breve que describe el momento"
          maxLength={200}
          className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-serif text-sm focus:outline-none focus:border-[var(--sepia)] placeholder:text-[var(--parchment-dim)]/50"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-3 border border-[var(--sepia)] text-[var(--parchment)] font-mono text-sm tracking-wide hover:bg-[var(--sepia)]/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm transition-colors"
      >
        {loading ? "Registrando…" : "Registrar observación"}
      </button>
    </form>
  )
}
