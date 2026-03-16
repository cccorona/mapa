"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { MetroStation } from "@/types/metro"
import type { PopupConfig } from "@/lib/map-config"

function MetroGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="10" stroke="rgba(0,163,224,0.8)" strokeWidth="1.2" fill="rgba(0,163,224,0.1)" />
      <text x="14" y="18" textAnchor="middle" fontSize="10" fontWeight="bold" fill="rgba(0,163,224,0.9)">
        M
      </text>
    </svg>
  )
}

interface StationPopupProps {
  station: MetroStation | null
  onClose: () => void
  popupConfig: PopupConfig
  phase: "entering" | "visible" | "exiting"
}

export function StationPopup({ station, onClose, popupConfig, phase }: StationPopupProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isOpen = !!station
  const durationMs = Math.max(200, popupConfig.animDuration)
  const veilAlpha = Math.max(0, Math.min(1, popupConfig.veilOpacity / 100))
  const backdropAlpha = Math.max(0, Math.min(0.9, popupConfig.backdropOpacity / 100))
  const glowStrength = Math.max(0, Math.min(1, popupConfig.panelGlow / 100))

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  useEffect(() => {
    if (station && ref.current) {
      ref.current.focus()
    }
  }, [station])

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 pointer-events-none flex items-end md:items-center justify-center md:justify-end",
        "transition-opacity duration-500",
        isOpen ? "opacity-100" : "opacity-0"
      )}
      aria-live="polite"
      style={{ transitionDuration: `${durationMs}ms` }}
    >
      <div
        className={cn(
          "absolute inset-0 md:hidden transition-opacity duration-500 pointer-events-none",
          isOpen ? "pointer-events-auto" : ""
        )}
        onClick={onClose}
        aria-hidden
        style={{
          transitionDuration: `${durationMs}ms`,
          background: `rgba(0, 0, 0, ${isOpen ? backdropAlpha : 0})`,
        }}
      />

      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 pointer-events-none",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
        style={{
          transitionDuration: `${durationMs}ms`,
          background: `radial-gradient(ellipse 46% 36% at 72% 52%, rgba(212,201,168,${0.09 * veilAlpha}) 0%, rgba(139,115,85,${0.08 * veilAlpha}) 24%, rgba(13,17,23,0) 70%)`,
        }}
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={station?.name ?? "Estación"}
        tabIndex={-1}
        className={cn(
          "relative pointer-events-auto",
          "w-full md:w-[360px] lg:w-[400px]",
          "md:mr-6 md:mb-0 mb-0",
          "max-h-[70vh] md:max-h-[80vh] overflow-y-auto",
          "rounded-t-lg md:rounded-lg",
          "border border-[var(--panel-border)]",
          "shadow-2xl",
          "outline-none",
          "transition-all ease-out",
          isOpen ? "pointer-events-auto" : "opacity-0 pointer-events-none",
          phase === "exiting" && "popup-crystal-exit",
          phase === "entering" && "popup-crystal-enter",
          phase === "visible" && "translate-y-0 scale-100 opacity-100 blur-0"
        )}
        style={{
          transitionDuration: `${durationMs}ms`,
          background: "linear-gradient(160deg, #0f1a16 0%, #0d1117 60%, #111820 100%)",
          boxShadow: isOpen
            ? `0 24px 80px rgba(0,0,0,0.75), 0 0 70px rgba(139,115,85,${0.24 * glowStrength}), 0 0 120px rgba(74,124,111,${0.16 * glowStrength}), inset 0 1px 0 rgba(212,201,168,0.1)`
            : "0 16px 40px rgba(0,0,0,0.55), 0 0 20px rgba(139,115,85,0.06), inset 0 1px 0 rgba(212,201,168,0.05)",
          transformOrigin: "center right",
          filter: phase === "entering" ? `blur(${popupConfig.blurIn}px)` : "blur(0px)",
          animationDuration: `${durationMs}ms`,
        }}
      >
        {isOpen && station && (
          <>
            <div className="pointer-events-none absolute inset-0 popup-crystal-shards rounded-t-lg md:rounded-lg" aria-hidden />
            <div
              className="absolute inset-0 rounded-t-lg md:rounded-lg pointer-events-none opacity-[0.025]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                backgroundSize: "128px 128px",
                mixBlendMode: "overlay",
              }}
            />

            <div className="px-6 pt-6 pb-4 border-b border-[var(--panel-border)] flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <MetroGlyph />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h2
                    className="font-serif font-medium text-[var(--parchment)] leading-snug text-balance"
                    style={{ fontSize: `${popupConfig.titleSize}px` }}
                  >
                    {station.name}
                  </h2>
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
                    aria-label="Cerrar"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className="font-mono tracking-[0.14em] uppercase text-[var(--primary)]"
                    style={{ fontSize: `${popupConfig.metaSize}px` }}
                  >
                    Línea {station.line}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <p
                className="font-serif leading-relaxed text-[var(--parchment)] opacity-80 italic"
                style={{ fontSize: `${popupConfig.bodySize}px` }}
              >
                Sin historias aún. Ver eventos cercanos para explorar.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--panel-border)] opacity-50" />
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="2" stroke="var(--sepia)" strokeWidth="0.7" opacity="0.5" />
                  <circle cx="8" cy="8" r="5" stroke="var(--sepia)" strokeWidth="0.4" opacity="0.25" />
                </svg>
                <div className="flex-1 h-px bg-[var(--panel-border)] opacity-50" />
              </div>
              <p
                className="mt-3 text-center font-mono tracking-[0.22em] uppercase text-[var(--parchment-dim)] opacity-55"
                style={{ fontSize: `${Math.max(9, popupConfig.metaSize - 1)}px` }}
              >
                {station.coords.lat.toFixed(4)}° N · {Math.abs(station.coords.lng).toFixed(4)}° O
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
