"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import type { LocationContainer } from "@/types/container"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

export default function AdminContainersPage() {
  const [containers, setContainers] = useState<LocationContainer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState({ lat: "", lng: "", label: "", group: "", layer: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ lat: "", lng: "", label: "", group: "", layer: "" })

  const load = async () => {
    const res = await fetch("/api/admin/containers", { credentials: "include" })
    if (res.ok) setContainers((await res.json()) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const lat = Number(form.lat)
    const lng = Number(form.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Lat y lng numéricos requeridos")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lat,
          lng,
          label: form.label.trim() || null,
          group: form.group.trim() || null,
          layer: form.layer.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.id) {
        setForm({ lat: "", lng: "", label: "", group: "", layer: "" })
        setShowCreateForm(false)
        await load()
      } else {
        setError(data.error ?? "Error al crear")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = useCallback((c: LocationContainer) => {
    setEditingId(c.id)
    setEditForm({
      lat: String(c.lat),
      lng: String(c.lng),
      label: c.label ?? "",
      group: c.group ?? "",
      layer: c.layer ?? "",
    })
  }, [])

  const handleUpdate = async (id: string) => {
    const lat = Number(editForm.lat)
    const lng = Number(editForm.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const res = await fetch(`/api/admin/containers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lat,
        lng,
        label: editForm.label.trim() || null,
        group: editForm.group.trim() || null,
        layer: editForm.layer.trim() || null,
      }),
    })
    if (res.ok) {
      setEditingId(null)
      await load()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este punto contenedor? Los eventos ligados quedarán sin contenedor.")) return
    const res = await fetch(`/api/admin/containers/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (res.ok) await load()
  }

  const carouselClassNames =
    "top-1/2 -translate-y-1/2 size-8 border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--parchment)] hover:bg-[var(--sepia)]/10"

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl font-medium text-[var(--parchment)]">
              Puntos contenedores
            </h1>
            <p className="font-mono text-xs tracking-[0.15em] uppercase text-[var(--parchment-dim)]">
              Ubicaciones a las que se pueden ligar varios eventos
            </p>
          </div>
          <Link
            href="/admin"
            className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
          >
            Volver a moderación
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((v) => !v)
              setError(null)
            }}
            className="px-3 py-1.5 border border-[var(--sepia)] text-[var(--parchment)] font-mono text-xs uppercase tracking-wide hover:bg-[var(--sepia)]/10 rounded-sm"
          >
            {showCreateForm ? "Cerrar formulario" : "Nuevo"}
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreate}
            className="border border-[var(--panel-border)] rounded-lg p-4 mb-6"
            style={{ background: "var(--panel-bg)" }}
          >
            <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-3">
              Crear punto contenedor
            </h2>
            {error && (
              <p className="text-[var(--destructive)] font-mono text-sm mb-2" role="alert">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block font-mono text-[10px] text-[var(--parchment-dim)] mb-1">Lat</label>
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment)] font-mono text-sm"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--parchment-dim)] mb-1">Lng</label>
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment)] font-mono text-sm"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block font-mono text-[10px] text-[var(--parchment-dim)] mb-1">Label (opcional)</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ej. Zócalo"
                className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment)] font-mono text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 border border-[var(--sepia)] text-[var(--parchment)] font-mono text-xs uppercase tracking-wide hover:bg-[var(--sepia)]/10 disabled:opacity-50 rounded-sm"
            >
              {submitting ? "Creando…" : "Añadir punto"}
            </button>
          </form>
        )}

        {loading ? (
          <p className="font-mono text-sm text-[var(--parchment-dim)]">Cargando…</p>
        ) : containers.length === 0 ? (
          <p className="font-mono text-sm text-[var(--parchment-dim)]">
            No hay puntos contenedores. Pulsa «Nuevo» para crear el primero.
          </p>
        ) : (
          <div className="relative px-10">
            <Carousel className="w-full" opts={{ loop: true }}>
              <CarouselContent>
                {containers.map((c, index) => (
                  <CarouselItem key={c.id}>
                    <div
                      className="border border-[var(--panel-border)] rounded-lg p-4 min-h-[140px] flex flex-col gap-2"
                      style={{ background: "var(--panel-bg)" }}
                    >
                      <p className="font-mono text-[10px] text-[var(--parchment-dim)]">
                        {index + 1} / {containers.length}
                      </p>
                      {editingId === c.id ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              step="any"
                              value={editForm.lat}
                              onChange={(e) => setEditForm((f) => ({ ...f, lat: e.target.value }))}
                              className="bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1 font-mono text-sm"
                              placeholder="Lat"
                            />
                            <input
                              type="number"
                              step="any"
                              value={editForm.lng}
                              onChange={(e) => setEditForm((f) => ({ ...f, lng: e.target.value }))}
                              className="bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1 font-mono text-sm"
                              placeholder="Lng"
                            />
                          </div>
                          <input
                            type="text"
                            value={editForm.label}
                            onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                            placeholder="Label"
                            className="bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1 font-mono text-sm"
                          />
                          <div className="flex gap-2 mt-auto">
                            <button
                              type="button"
                              onClick={() => handleUpdate(c.id)}
                              className="px-2 py-1 font-mono text-xs border border-[var(--primary)] text-[var(--primary)] rounded-sm hover:bg-[var(--primary)]/10"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 font-mono text-xs border border-[var(--panel-border)] text-[var(--parchment-dim)] rounded-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-sm text-[var(--parchment)]">
                              {c.label || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--parchment-dim)]">
                              {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-auto">
                            <button
                              type="button"
                              onClick={() => startEdit(c)}
                              className="px-2 py-1 font-mono text-[10px] border border-[var(--panel-border)] text-[var(--parchment-dim)] rounded-sm hover:text-[var(--parchment)]"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="px-2 py-1 font-mono text-[10px] border border-[var(--destructive)]/50 text-[var(--destructive)] rounded-sm hover:bg-[var(--destructive)]/10"
                            >
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious
                aria-label="Punto anterior"
                className={carouselClassNames + " left-0"}
              />
              <CarouselNext aria-label="Punto siguiente" className={carouselClassNames + " right-0"} />
            </Carousel>
          </div>
        )}
      </div>
    </main>
  )
}
