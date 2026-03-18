"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { EventForm } from "@/components/event-form"

function NewEventContent() {
  const searchParams = useSearchParams()
  const defaultContainerId = searchParams.get("container") ?? undefined
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-md mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)] mb-8 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <polyline points="8,3 4,6 8,9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al mapa
        </Link>

        <header className="mb-8">
          <h1 className="font-serif text-xl font-medium text-[var(--parchment)] mb-1">
            Registrar observación
          </h1>
          <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--parchment-dim)]">
            Cartografía de momentos irreversibles
          </p>
        </header>

        <div
          className="border border-[var(--panel-border)] rounded-lg p-6"
          style={{ background: "var(--panel-bg)" }}
        >
          <EventForm defaultContainerId={defaultContainerId} />
        </div>
      </div>
    </main>
  )
}

export default function NewEventPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen" style={{ background: "var(--background)" }}>
          <div className="max-w-md mx-auto px-6 py-12 font-mono text-[12px] text-[var(--parchment-dim)]">
            Cargando…
          </div>
        </main>
      }
    >
      <NewEventContent />
    </Suspense>
  )
}
