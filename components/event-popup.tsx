"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { ObservationEvent } from "@/lib/data"
import type { MetroStory } from "@/types/metro"
import { EVENT_TYPE_LABELS, INTENSITY_LABELS, getSymbolForType } from "@/lib/icons"
import { SymbolIcon } from "@/components/symbol-icon"
import type { PopupConfig } from "@/lib/map-config"

const CAROUSEL_VIGNETTE_SRC = "/images/event-popup-carousel-vignette.png"

function MetroGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="10" stroke="rgba(0,163,224,0.8)" strokeWidth="1.2" fill="rgba(0,163,224,0.1)" />
      <text x="14" y="18" textAnchor="middle" fontSize="10" fontWeight="bold" fill="rgba(0,163,224,0.9)">M</text>
    </svg>
  )
}

interface EventPopupProps {
  events: ObservationEvent[]
  metroStory: MetroStory | null
  onClose: () => void
  popupConfig: PopupConfig
  phase: "entering" | "visible" | "exiting"
}

export function EventPopup({ events, metroStory, onClose, popupConfig, phase }: EventPopupProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const isEventPopup = events.length > 0
  const isMetroPopup = !!metroStory
  const isOpen = isEventPopup || isMetroPopup
  const currentEvent = isEventPopup ? events[Math.min(carouselIndex, events.length - 1)] : null
  const event = isMetroPopup ? metroStory : currentEvent
  const durationMs = Math.max(200, popupConfig.animDuration)
  const veilAlpha = Math.max(0, Math.min(1, popupConfig.veilOpacity / 100))
  const backdropAlpha = Math.max(0, Math.min(0.9, popupConfig.backdropOpacity / 100))
  const glowStrength = Math.max(0, Math.min(1, popupConfig.panelGlow / 100))

  useEffect(() => {
    setCarouselIndex(0)
  }, [events])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (events.length > 1 && isOpen) {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          setCarouselIndex((i) => (i > 0 ? i - 1 : events.length - 1))
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          setCarouselIndex((i) => (i < events.length - 1 ? i + 1 : 0))
        }
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, events.length, isOpen])

  // Trap focus inside panel when open
  useEffect(() => {
    if (event && ref.current) {
      ref.current.focus()
    }
  }, [event])

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
      {/* Dim backdrop on mobile */}
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

      {/* Ethereal veil */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 pointer-events-none",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
        style={{
          transitionDuration: `${durationMs}ms`,
          background:
            `radial-gradient(ellipse 46% 36% at 72% 52%, rgba(212,201,168,${0.09 * veilAlpha}) 0%, rgba(139,115,85,${0.08 * veilAlpha}) 24%, rgba(13,17,23,0) 70%)`,
        }}
      />

      {/* Panel */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={event?.title ?? (events.length > 1 ? `Observación ${carouselIndex + 1} de ${events.length}` : "Observación")}
        tabIndex={-1}
        className={cn(
          "relative pointer-events-auto",
          "w-full md:w-[360px] lg:w-[400px]",
          "md:mr-6 md:mb-0 mb-0",
          "max-h-[70vh] md:max-h-[80vh] flex flex-col overflow-hidden",
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
        {isOpen && event && (
          <>
            <div className="pointer-events-none absolute inset-0 popup-crystal-shards rounded-t-lg md:rounded-lg" aria-hidden />
            {/* Parchment texture strip */}
            <div
              className="absolute inset-0 rounded-t-lg md:rounded-lg pointer-events-none opacity-[0.025]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                backgroundSize: "128px 128px",
                mixBlendMode: "overlay",
              }}
            />

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-[var(--panel-border)] flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {isMetroPopup ? <MetroGlyph /> : <SymbolIcon name={getSymbolForType((event as ObservationEvent).type)} size={28} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif font-medium text-[var(--parchment)] leading-snug text-balance" style={{ fontSize: `${popupConfig.titleSize}px` }}>
                    {event.title}
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
                  {isMetroPopup ? (
                    <>
                      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--parchment-dim)] opacity-85">
                        Estación {(event as MetroStory).stationId ?? "—"}
                      </span>
                      <span className="w-px h-3 bg-[var(--panel-border)]" />
                      <span
                        className="font-mono tracking-[0.14em] uppercase text-[var(--primary)]"
                        style={{ fontSize: `${popupConfig.metaSize}px` }}
                      >
                        Línea {(event as MetroStory).line}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--parchment-dim)] opacity-85">
                        {EVENT_TYPE_LABELS[(event as ObservationEvent).type] ?? (event as ObservationEvent).type}
                      </span>
                      <span className="w-px h-3 bg-[var(--panel-border)]" />
                      <span
                        className="font-mono tracking-[0.14em] uppercase"
                        style={{
                          fontSize: `${popupConfig.metaSize}px`,
                          color: ["4", "5"].includes((event as ObservationEvent).intensity)
                            ? "var(--sepia)"
                            : ["2", "3"].includes((event as ObservationEvent).intensity)
                              ? "var(--primary)"
                              : "var(--parchment-dim)",
                        }}
                      >
                        {INTENSITY_LABELS[(event as ObservationEvent).intensity] ?? (event as ObservationEvent).intensity}
                      </span>
                    </>
                  )}
                  <span className="w-px h-3 bg-[var(--panel-border)]" />
                  <time
                    className="font-mono text-[var(--parchment-dim)] opacity-80"
                    style={{ fontSize: `${popupConfig.metaSize}px` }}
                    dateTime={event.date}
                  >
                    {new Date(event.date).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </div>
              </div>
            </div>

            {/* Body: scroll independiente; el pie con viñeta queda fijo al fondo de la tarjeta */}
            <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-5">
              {/* Location (event) or Station (metro) */}
              {isMetroPopup ? (
                <div className="flex items-center gap-2 mb-4">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <circle cx="5" cy="4" r="2" stroke="var(--parchment-dim)" strokeWidth="0.8" />
                    <path d="M5 6 L5 9" stroke="var(--parchment-dim)" strokeWidth="0.8" strokeLinecap="round" />
                  </svg>
                  <span className="font-mono text-[var(--parchment-dim)] opacity-85 italic" style={{ fontSize: `${popupConfig.metaSize + 1}px` }}>
                    Estación {(event as MetroStory).stationId ?? "—"} · Línea {(event as MetroStory).line}
                  </span>
                </div>
              ) : (event as ObservationEvent).location && (
                <div className="flex items-center gap-2 mb-4">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <circle cx="5" cy="4" r="2" stroke="var(--parchment-dim)" strokeWidth="0.8" />
                    <path d="M5 6 L5 9" stroke="var(--parchment-dim)" strokeWidth="0.8" strokeLinecap="round" />
                  </svg>
                  <span className="font-mono text-[var(--parchment-dim)] opacity-85 italic" style={{ fontSize: `${popupConfig.metaSize + 1}px` }}>
                    {(event as ObservationEvent).location}
                  </span>
                </div>
              )}

              {/* Description */}
              <p className="font-serif leading-relaxed text-[var(--parchment)] opacity-90 italic" style={{ fontSize: `${popupConfig.bodySize}px` }}>
                {event.description}
              </p>

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-5">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 font-mono tracking-wide text-[var(--parchment-dim)] border border-[var(--panel-border)] rounded-sm opacity-85"
                      style={{ fontSize: `${popupConfig.metaSize}px` }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Decorative rule */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--panel-border)] opacity-50" />
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="2" stroke="var(--sepia)" strokeWidth="0.7" opacity="0.5" />
                  <circle cx="8" cy="8" r="5" stroke="var(--sepia)" strokeWidth="0.4" opacity="0.25" />
                </svg>
                <div className="flex-1 h-px bg-[var(--panel-border)] opacity-50" />
              </div>

              {/* Coordinates */}
              <p className="mt-3 text-center font-mono tracking-[0.22em] uppercase text-[var(--parchment-dim)] opacity-55" style={{ fontSize: `${Math.max(9, popupConfig.metaSize - 1)}px` }}>
                {event.coords.lat.toFixed(4)}° N · {event.coords.lng.toFixed(4)}° O
              </p>
            </div>
            </div>

            {/* Pie de tarjeta: viñeta tipo libro antiguo + navegación (solo varias observaciones) */}
            {events.length > 1 && !isMetroPopup && (
              <div
                className="shrink-0 border-t border-[var(--panel-border)]/70 bg-[linear-gradient(180deg,rgba(15,26,22,0.92)_0%,rgba(13,17,23,0.98)_100%)] px-4 pt-3 pb-4 rounded-b-lg md:rounded-b-lg"
                role="group"
                aria-label={`Observación ${carouselIndex + 1} de ${events.length}`}
              >
                <div className="pointer-events-none select-none mb-2 flex justify-center">
                  <img
                    src={CAROUSEL_VIGNETTE_SRC}
                    alt=""
                    width={320}
                    height={48}
                    className="w-[min(100%,280px)] h-9 sm:h-10 object-contain object-center opacity-[0.38] [filter:invert(1)_brightness(0.88)_sepia(0.35)_hue-rotate(-8deg)]"
                    decoding="async"
                  />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCarouselIndex((i) => (i > 0 ? i - 1 : events.length - 1))
                    }}
                    className="w-6 h-6 shrink-0 flex items-center justify-center rounded border border-[var(--panel-border)] text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)]/45 hover:bg-[var(--sepia)]/8 transition-colors"
                    aria-label="Anterior"
                  >
                    <svg width="7" height="11" viewBox="0 0 8 12" fill="none">
                      <path d="M6 2L2 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <span className="font-serif italic text-[11px] sm:text-xs text-[var(--parchment-dim)] tracking-wide min-w-[5.5rem] text-center tabular-nums">
                    {carouselIndex + 1} de {events.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCarouselIndex((i) => (i < events.length - 1 ? i + 1 : 0))
                    }}
                    className="w-6 h-6 shrink-0 flex items-center justify-center rounded border border-[var(--panel-border)] text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)]/45 hover:bg-[var(--sepia)]/8 transition-colors"
                    aria-label="Siguiente"
                  >
                    <svg width="7" height="11" viewBox="0 0 8 12" fill="none">
                      <path d="M2 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
