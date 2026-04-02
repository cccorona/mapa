"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { EVENT_TYPES, EMOTIONAL_INTENSITY_SCALE } from "@/lib/constants"
import { createEvent } from "@/lib/services/events"
import { getLocationContainersAll } from "@/lib/services/containers"
import type { LocationContainer } from "@/types/container"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"

interface EventFormProps {
  defaultLat?: number
  defaultLng?: number
  defaultContainerId?: string
  /** Si true, no redirige al mapa tras registrar (p. ej. formulario embebido en modal). */
  skipNavigationRedirect?: boolean
  onSuccess?: () => void
}

const DEFAULT_LAT = 19.4326
const DEFAULT_LNG = -99.1332

export function EventForm({ defaultLat, defaultLng, defaultContainerId, skipNavigationRedirect, onSuccess }: EventFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [containers, setContainers] = useState<LocationContainer[]>([])
  const [containersLoading, setContainersLoading] = useState(true)
  const [form, setForm] = useState({
    event_type: "MAJOR_DECISION" as string,
    useExistingPoint: true,
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

  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null)

  useEffect(() => {
    getLocationContainersAll()
      .then(setContainers)
      .catch(() => setContainers([]))
      .finally(() => setContainersLoading(false))
  }, [])

  useEffect(() => {
    if (containersLoading) return
    if (containers.length === 0) {
      setForm((f) =>
        f.useExistingPoint ? { ...f, useExistingPoint: false, location_container_id: "" } : f
      )
    }
  }, [containersLoading, containers.length])

  useEffect(() => {
    if (containersLoading || containers.length === 0) return
    if (!form.useExistingPoint) return
    if (form.location_container_id) return
    setForm((f) => ({ ...f, location_container_id: containers[0].id }))
  }, [containersLoading, containers, form.useExistingPoint, form.location_container_id])

  useEffect(() => {
    if (!carouselApi || containers.length === 0 || !form.useExistingPoint) return
    const onSelect = () => {
      const i = carouselApi.selectedScrollSnap()
      const c = containers[i]
      if (c)
        setForm((f) => (f.location_container_id === c.id ? f : { ...f, location_container_id: c.id }))
    }
    carouselApi.on("select", onSelect)
    onSelect()
    return () => {
      carouselApi.off("select", onSelect)
    }
  }, [carouselApi, containers, form.useExistingPoint])

  useEffect(() => {
    if (!carouselApi || containers.length === 0 || !form.useExistingPoint) return
    const idx = containers.findIndex((c) => c.id === form.location_container_id)
    if (idx < 0) return
    if (carouselApi.selectedScrollSnap() === idx) return
    carouselApi.scrollTo(idx, false)
  }, [carouselApi, containers, form.location_container_id, form.useExistingPoint])

  const goToNewCoords = useCallback(() => {
    setForm((f) => ({ ...f, useExistingPoint: false, location_container_id: "" }))
  }, [])

  const goToExisting = useCallback(() => {
    setForm((f) => ({
      ...f,
      useExistingPoint: true,
      location_container_id: containers[0]?.id ?? "",
    }))
  }, [containers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (form.useExistingPoint && containers.length > 0 && !form.location_container_id) {
        setError("Selecciona un punto en el carrusel.")
        setLoading(false)
        return
      }
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
      if (skipNavigationRedirect) {
        router.refresh()
      } else {
        router.push("/")
        router.refresh()
      }
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
          {containersLoading ? (
            <p className="font-mono text-sm text-[var(--parchment-dim)]">Cargando puntos…</p>
          ) : containers.length === 0 ? (
            <p className="font-mono text-xs text-[var(--parchment-dim)]">
              No hay puntos contenedores guardados. Indica latitud y longitud abajo.
            </p>
          ) : form.useExistingPoint ? (
            <>
              <div className="relative px-10">
                <Carousel className="w-full" setApi={setCarouselApi} opts={{ loop: true }}>
                  <CarouselContent>
                    {containers.map((c, index) => (
                      <CarouselItem key={c.id}>
                        <div
                          className="border border-[var(--panel-border)] rounded-sm px-3 py-3 min-h-[88px] flex flex-col justify-center"
                          style={{ background: "var(--panel-bg)" }}
                        >
                          <p className="font-mono text-[10px] text-[var(--parchment-dim)] mb-1">
                            {index + 1} / {containers.length}
                          </p>
                          <p className="font-mono text-sm text-[var(--parchment)]">
                            {c.label || `Punto ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}
                          </p>
                          <p className="font-mono text-[10px] text-[var(--parchment-dim)] mt-1">
                            {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                          </p>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious
                    aria-label="Punto anterior"
                    className="top-1/2 -translate-y-1/2 size-8 left-0 border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--parchment)] hover:bg-[var(--sepia)]/10"
                  />
                  <CarouselNext
                    aria-label="Punto siguiente"
                    className="top-1/2 -translate-y-1/2 size-8 right-0 border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--parchment)] hover:bg-[var(--sepia)]/10"
                  />
                </Carousel>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goToNewCoords}
                  className="px-3 py-1.5 border border-[var(--sepia)] text-[var(--parchment)] font-mono text-xs uppercase tracking-wide hover:bg-[var(--sepia)]/10 rounded-sm"
                >
                  Nuevo
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={goToExisting}
                className="self-start px-3 py-1.5 border border-[var(--panel-border)] text-[var(--parchment-dim)] font-mono text-xs uppercase tracking-wide hover:text-[var(--parchment)] hover:border-[var(--sepia)] rounded-sm"
              >
                Elegir punto existente
              </button>
            </>
          )}
        </div>
      </div>

      {(!form.useExistingPoint || containers.length === 0) && (
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
