"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type EventRow = {
  id: string
  event_type: string
  occurred_at: string
  description: string
  status: string
}

export default function AdminPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.rpc("get_events_for_moderation")
      const rows = (data ?? []).map((r: EventRow) => ({
        id: r.id,
        event_type: r.event_type,
        occurred_at: r.occurred_at,
        description: r.description,
        status: r.status,
      }))
      setEvents(rows)
      setLoading(false)
    }
    load()
  }, [])

  const handleStatusChange = async (id: string, status: "approved" | "rejected") => {
    const supabase = createClient()
    const { error } = await supabase.rpc("update_event_status", {
      p_event_id: id,
      p_status: status,
    })
    if (!error) setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
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
          <Link
            href="/"
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
          >
            Volver al mapa
          </Link>
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
      </div>
    </main>
  )
}
