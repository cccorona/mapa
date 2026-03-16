"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { LandmarkMapPicker } from "@/components/landmark-map-picker"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type LandmarkRow = {
  id: string
  name: string
  lng: number
  lat: number
  icon_url: string
  icon_svg_url?: string | null
}

export default function AdminLandmarksPage() {
  const [landmarks, setLandmarks] = useState<LandmarkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: "", lng: "", lat: "" })
  const [file, setFile] = useState<File | null>(null)
  const [fileSvg, setFileSvg] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [editingLandmark, setEditingLandmark] = useState<LandmarkRow | null>(null)
  const [editSvgFile, setEditSvgFile] = useState<File | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const latNum = useMemo(() => (form.lat === "" ? null : Number(form.lat)), [form.lat])
  const lngNum = useMemo(() => (form.lng === "" ? null : Number(form.lng)), [form.lng])
  const hasValidCoords =
    latNum != null &&
    lngNum != null &&
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum)

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc("get_landmarks").then(({ data }) => {
      setLandmarks((data ?? []) as LandmarkRow[])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleMapSelect = (lat: number, lng: number) => {
    setForm((f) => ({
      ...f,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    const lng = Number(form.lng)
    const lat = Number(form.lat)
    if (!name || !Number.isFinite(lng) || !Number.isFinite(lat) || !file) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const fd = new FormData()
      fd.set("name", name)
      fd.set("lng", String(lng))
      fd.set("lat", String(lat))
      fd.set("image", file)
      if (fileSvg?.size) fd.set("image_svg", fileSvg)
      const res = await fetch("/api/landmarks", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data) {
        setLandmarks((prev) => [...prev, data])
        setForm({ name: "", lng: "", lat: "" })
        setFile(null)
        setFileSvg(null)
        setPreviewUrl(null)
      } else {
        setSubmitError(typeof data?.error === "string" ? data.error : "Error al subir landmark")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLandmark || !editSvgFile?.size) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      const fd = new FormData()
      fd.set("image_svg", editSvgFile)
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 25000)
      const res = await fetch(`/api/landmarks/${editingLandmark.id}`, {
        method: "PATCH",
        body: fd,
        credentials: "include",
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      if (res.ok && data) {
        setLandmarks((prev) =>
          prev.map((lm) => (lm.id === editingLandmark.id ? { ...lm, ...data } : lm))
        )
        setEditingLandmark(null)
        setEditSvgFile(null)
      } else {
        setEditError(typeof data?.error === "string" ? data.error : "Error al guardar SVG")
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setEditError("Tardó demasiado. Revisa la conexión o el tamaño del SVG.")
      } else {
        setEditError("Error de red o del servidor.")
      }
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--panel-border)] shrink-0" style={{ background: "var(--panel-bg)" }}>
        <h1 className="font-serif text-lg font-medium text-[var(--parchment)]">
          Subir landmark
        </h1>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
          >
            Admin
          </Link>
          <Link
            href="/"
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
          >
            Mapa
          </Link>
        </div>
      </header>

      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
        <aside className="w-80 shrink-0 p-6 border-r border-[var(--panel-border)] overflow-y-auto" style={{ background: "var(--panel-bg)" }}>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <label className="block">
            <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Nombre</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ej. Bellas Artes"
              className="mt-1 w-full font-mono text-sm border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)]"
              required
            />
          </label>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Longitud</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="-99.14"
                className="mt-1 w-full font-mono text-sm border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)]"
                required
              />
            </label>
            <label className="flex-1">
              <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Latitud</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="19.43"
                className="mt-1 w-full font-mono text-sm border border-[var(--panel-border)] rounded px-2 py-1.5 bg-transparent text-[var(--parchment)]"
                required
              />
            </label>
          </div>
          <label className="block">
            <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Icono (imagen)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 font-mono text-[10px] text-[var(--parchment-dim)] file:mr-2 file:rounded file:border file:border-[var(--panel-border)] file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[var(--parchment)]"
              required
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-[var(--parchment-dim)]">
              Icono SVG (opcional, para efecto de partículas)
            </span>
            <input
              type="file"
              accept=".svg,image/svg+xml"
              onChange={(e) => setFileSvg(e.target.files?.[0] ?? null)}
              className="mt-1 font-mono text-[10px] text-[var(--parchment-dim)] file:mr-2 file:rounded file:border file:border-[var(--panel-border)] file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[var(--parchment)]"
            />
          </label>
            {submitError && (
              <p className="font-mono text-[10px] text-[var(--destructive)]" role="alert">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-3 py-2 font-mono text-[10px] border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded disabled:opacity-50"
            >
              {submitting ? "Subiendo…" : "Añadir landmark"}
            </button>
          </form>

          {loading ? (
            <p className="mt-6 font-mono text-sm text-[var(--parchment-dim)]">Cargando…</p>
          ) : landmarks.length > 0 ? (
            <ul className="mt-6 space-y-2">
              {landmarks.map((lm) => (
                <li
                  key={lm.id}
                  className="font-mono text-[10px] text-[var(--parchment-dim)] flex items-center justify-between gap-2"
                >
                  <span className="text-[var(--parchment)]">{lm.name}</span>
                  <span className="shrink-0">({lm.lat.toFixed(4)}, {lm.lng.toFixed(4)})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLandmark(lm)
                      setEditSvgFile(null)
                      setEditError(null)
                    }}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--primary)] hover:underline"
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 font-mono text-[10px] text-[var(--parchment-dim)]">
              Aún no hay landmarks.
            </p>
          )}
        </aside>

        <Dialog open={!!editingLandmark} onOpenChange={(open) => !open && setEditingLandmark(null)}>
          <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)]">
            <DialogHeader>
              <DialogTitle className="font-serif text-[var(--parchment)]">
                Editar: {editingLandmark?.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <label className="block">
                <span className="font-mono text-[10px] text-[var(--parchment-dim)]">
                  Icono SVG (para efecto de partículas)
                </span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={(e) => setEditSvgFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full font-mono text-[10px] text-[var(--parchment-dim)] file:mr-2 file:rounded file:border file:border-[var(--panel-border)] file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[var(--parchment)]"
                />
                {editingLandmark?.icon_svg_url && (
                  <p className="mt-1 font-mono text-[10px] text-[var(--parchment-dim)]">
                    Ya tiene SVG; subir otro lo reemplazará.
                  </p>
                )}
              </label>
              {editError && (
                <p className="font-mono text-[10px] text-[var(--destructive)]" role="alert">
                  {editError}
                </p>
              )}
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setEditingLandmark(null)}
                  className="font-mono text-[10px] border border-[var(--panel-border)] px-3 py-2 rounded text-[var(--parchment-dim)] hover:bg-[var(--panel-border)]/20"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || !editSvgFile?.size}
                  className="font-mono text-[10px] border border-[var(--primary)] text-[var(--primary)] px-3 py-2 rounded hover:bg-[var(--primary)]/10 disabled:opacity-50"
                >
                  {editSubmitting ? "Guardando…" : "Guardar SVG"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <section className="flex-1 flex flex-col min-h-0" style={{ background: "var(--background)" }}>
          <LandmarkMapPicker
            lat={hasValidCoords ? latNum! : null}
            lng={hasValidCoords ? lngNum! : null}
            onSelect={handleMapSelect}
            previewImageUrl={previewUrl}
            className="flex-1 flex flex-col min-h-0 p-4"
          />
        </section>
      </div>
    </main>
  )
}
