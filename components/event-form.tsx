"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EVENT_TYPES, EMOTIONAL_INTENSITY_SCALE } from "@/lib/constants"
import { createEvent } from "@/lib/services/events"

interface EventFormProps {
  defaultLat?: number
  defaultLng?: number
  onSuccess?: () => void
}

export function EventForm({ defaultLat, defaultLng, onSuccess }: EventFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    event_type: "MAJOR_DECISION" as string,
    lat: defaultLat ?? 19.4326,
    lng: defaultLng ?? -99.1332,
    occurred_at: new Date().toISOString().slice(0, 10),
    description: "",
    emotional_intensity: "3" as string,
    is_anonymous: true,
    title: "",
    location: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await createEvent({
        event_type: form.event_type as "DEATH" | "JOB_RESIGNATION" | "JOB_TERMINATION" | "RELATIONSHIP_END" | "MAJOR_DECISION" | "NEW_BEGINNING" | "RELOCATION" | "ACCIDENT" | "HEALTH_DIAGNOSIS" | "LEGAL_EVENT",
        lat: form.lat,
        lng: form.lng,
        occurred_at: form.occurred_at,
        description: form.description,
        emotional_intensity: form.emotional_intensity as "1" | "2" | "3" | "4" | "5",
        is_anonymous: form.is_anonymous,
        title: form.title || undefined,
        location: form.location || undefined,
      })
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
