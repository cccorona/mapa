"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { ObservationEvent } from "@/lib/data"
import { EVENT_TYPE_TO_SYMBOL } from "@/lib/constants"

// Symbolic SVG marker components
function CandleMarker({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  return (
    <g>
      {glowing && (
        <circle cx="0" cy={-size * 0.35} r={size * 0.55} fill="rgba(139,115,85,0.12)" />
      )}
      {/* Flame */}
      <path
        d={`M0,${-size * 0.3} C${-size * 0.1},${-size * 0.45} ${size * 0.12},${-size * 0.6} 0,${-size * 0.6} C${-size * 0.12},${-size * 0.6} ${size * 0.1},${-size * 0.45} 0,${-size * 0.3}Z`}
        fill="rgba(200,160,80,0.85)"
      />
      {/* Wick */}
      <line x1="0" y1={-size * 0.28} x2="0" y2={-size * 0.15} stroke="rgba(180,140,60,0.6)" strokeWidth="1" />
      {/* Body */}
      <rect x={-size * 0.09} y={-size * 0.15} width={size * 0.18} height={size * 0.38} rx="1" fill="rgba(200,170,100,0.7)" />
      {/* Base */}
      <ellipse cx="0" cy={size * 0.23} rx={size * 0.14} ry={size * 0.05} fill="rgba(139,115,85,0.4)" />
    </g>
  )
}

function CrackMarker({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  return (
    <g>
      {glowing && (
        <circle cx="0" cy="0" r={size * 0.55} fill="rgba(74,124,111,0.12)" />
      )}
      <path
        d={`M${-size * 0.3},${-size * 0.35} L${-size * 0.05},${-size * 0.05} L${-size * 0.2},${size * 0.1} L${size * 0.05},${size * 0.35}`}
        stroke="rgba(74,124,111,0.8)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d={`M${-size * 0.05},${-size * 0.05} L${size * 0.25},${-size * 0.25}`}
        stroke="rgba(74,124,111,0.4)"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}

function ThreadMarker({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  const s = size * 0.35
  return (
    <g>
      {glowing && (
        <circle cx="0" cy="0" r={size * 0.55} fill="rgba(139,115,85,0.1)" />
      )}
      <path
        d={`M${-s},0 C${-s * 0.5},${-s * 0.6} ${s * 0.5},${s * 0.6} ${s},0`}
        stroke="rgba(180,150,100,0.75)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="0" y1={-s * 0.15} x2="0" y2={-s * 0.6} stroke="rgba(180,150,100,0.5)" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="0" y1={s * 0.15} x2="0" y2={s * 0.55} stroke="rgba(180,150,100,0.4)" strokeWidth="0.7" strokeLinecap="round" strokeDasharray="1.5 1.5" />
    </g>
  )
}

function DoorMarker({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  const w = size * 0.28
  const h = size * 0.45
  return (
    <g>
      {glowing && (
        <circle cx="0" cy="0" r={size * 0.55} fill="rgba(100,130,120,0.12)" />
      )}
      <rect x={-w * 0.5} y={-h * 0.5} width={w} height={h} rx="1" stroke="rgba(160,184,160,0.7)" strokeWidth="1.2" fill="none" />
      <line x1={-w * 0.5} y1={-h * 0.5} x2={-w * 0.5} y2={h * 0.5} stroke="rgba(160,184,160,0.25)" strokeWidth="0.5" />
      <circle cx={w * 0.15} cy="0" r="1.5" fill="rgba(160,184,160,0.6)" />
    </g>
  )
}

function DocumentoMarker({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  return (
    <g>
      {glowing && <circle cx="0" cy="0" r={size * 0.55} fill="rgba(139,115,85,0.1)" />}
      <path d={`M${-size * 0.2},${size * 0.3} L${size * 0.15},${size * 0.3} L${size * 0.25},${size * 0.15} L${size * 0.25},${-size * 0.35} L${-size * 0.2},${-size * 0.35} Z`} stroke="rgba(139,115,85,0.7)" strokeWidth="1" strokeLinejoin="round" fill="none" />
      <line x1={-size * 0.12} y1={-size * 0.1} x2={size * 0.1} y2={-size * 0.1} stroke="rgba(180,150,100,0.5)" strokeWidth="0.6" />
      <line x1={-size * 0.12} y1={size * 0.05} x2={size * 0.1} y2={size * 0.05} stroke="rgba(180,150,100,0.4)" strokeWidth="0.5" />
    </g>
  )
}

function GermenMarker({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  return (
    <g>
      {glowing && <circle cx="0" cy="0" r={size * 0.55} fill="rgba(74,124,111,0.1)" />}
      <ellipse cx="0" cy={size * 0.35} rx={size * 0.25} ry={size * 0.08} stroke="rgba(74,124,111,0.6)" strokeWidth="0.8" fill="none" />
      <path d={`M0,${size * 0.2} C0,${-size * 0.1} ${-size * 0.15},${-size * 0.35} 0,${-size * 0.45} C${size * 0.15},${-size * 0.35} 0,${-size * 0.1} 0,${size * 0.2}`} stroke="rgba(160,184,160,0.8)" strokeWidth="1" strokeLinecap="round" fill="none" />
      <circle cx="0" cy={-size * 0.4} r={size * 0.12} fill="rgba(200,170,100,0.6)" />
    </g>
  )
}

function CruzMarker({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  return (
    <g>
      {glowing && <circle cx="0" cy="0" r={size * 0.55} fill="rgba(139,115,85,0.1)" />}
      <line x1="0" y1={-size * 0.4} x2="0" y2={size * 0.4} stroke="rgba(139,115,85,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1={-size * 0.35} y1="0" x2={size * 0.35} y2="0" stroke="rgba(139,115,85,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="0" cy="0" r={size * 0.2} stroke="rgba(139,115,85,0.4)" strokeWidth="0.8" fill="none" />
    </g>
  )
}

const MARKER_COMPONENTS: Record<string, (props: { size?: number; glowing?: boolean }) => JSX.Element> = {
  vela: CandleMarker,
  grieta: CrackMarker,
  hilo: ThreadMarker,
  puerta: DoorMarker,
  documento: DocumentoMarker,
  germen: GermenMarker,
  cruz: CruzMarker,
}

interface MapPoint {
  event: ObservationEvent
  x: number
  y: number
}

function viewBoxToZoom(viewBoxW: number): number {
  const w = Math.max(200, Math.min(1600, viewBoxW))
  return 10 + 6 * (1 - (w - 200) / 1400)
}

interface MapCanvasProps {
  events: ObservationEvent[]
  selectedEventId: string | null
  highlightedEventId: string | null
  onSelectEvent: (id: string) => void
  showDensity: boolean
  showMetroLines?: boolean
  onZoomChange?: (zoom: number) => void
}

export function MapCanvas({
  events,
  selectedEventId,
  highlightedEventId,
  onSelectEvent,
  showDensity,
  showMetroLines: _showMetroLines, // API consistency; metro layer only in Mapbox
  onZoomChange,
}: MapCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 600 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; vbx: number; vby: number } | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [breathPhase, setBreathPhase] = useState(0)

  // Stable point positions based on event id seed
  const points: MapPoint[] = useMemo(
    () =>
      events.map((e) => {
        const seed = e.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
        const phi = (seed * 137.508) % 360
        const r = ((seed * 37) % 280) + 40
        const x = 400 + r * Math.cos((phi * Math.PI) / 180)
        const y = 300 + r * Math.sin((phi * Math.PI) / 180)
        return { event: e, x, y }
      }),
    [events]
  )

  useEffect(() => {
    if (!selectedEventId) return
    const selectedPoint = points.find((p) => p.event.id === selectedEventId)
    if (!selectedPoint) return

    setViewBox((v) => {
      const nextX = selectedPoint.x - v.w * 0.5
      const nextY = selectedPoint.y - v.h * 0.55
      if (Math.abs(v.x - nextX) < 1 && Math.abs(v.y - nextY) < 1) return v
      return { ...v, x: nextX, y: nextY }
    })
  }, [points, selectedEventId])

  // Breathing animation
  useEffect(() => {
    let raf: number
    let t = 0
    const animate = () => {
      t += 0.008
      setBreathPhase(t)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
      setViewBox((v) => {
        onZoomChange?.(viewBoxToZoom(width))
        return { ...v, w: width, h: height }
      })
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [onZoomChange])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 1.12 : 0.88
      setViewBox((v) => {
        const newW = Math.max(200, Math.min(1600, v.w * factor))
        const newH = Math.max(150, Math.min(1200, v.h * factor))
        const dx = (v.w - newW) * 0.5
        const dy = (v.h - newH) * 0.5
        onZoomChange?.(viewBoxToZoom(newW))
        return { x: v.x + dx, y: v.y + dy, w: newW, h: newH }
      })
    },
    [onZoomChange]
  )

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as SVGElement).closest("[data-marker]")) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, vbx: viewBox.x, vby: viewBox.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [viewBox.x, viewBox.y])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning || !panStart.current) return
    const scaleX = viewBox.w / dimensions.width
    const scaleY = viewBox.h / dimensions.height
    const dx = (e.clientX - panStart.current.x) * scaleX
    const dy = (e.clientY - panStart.current.y) * scaleY
    setViewBox((v) => ({ ...v, x: panStart.current!.vbx - dx, y: panStart.current!.vby - dy }))
  }, [isPanning, viewBox.w, viewBox.h, dimensions.width, dimensions.height])

  const handlePointerUp = useCallback(() => {
    setIsPanning(false)
    panStart.current = null
  }, [])

  const MARKER_SIZE = 34

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Mist / atmosphere layers */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 45% at 38% 52%, rgba(26,48,64,0.45) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 72% 35%, rgba(30,43,40,0.35) 0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at 55% 75%, rgba(17,24,32,0.4) 0%, transparent 60%)
          `,
          opacity: 0.7 + Math.sin(breathPhase) * 0.04,
          transition: "opacity 2s ease",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 50%, rgba(5,8,10,0.7) 100%)",
        }}
      />

      {/* SVG Map */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className={cn("absolute inset-0", isPanning ? "cursor-grabbing" : "cursor-grab")}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="Mapa de observaciones interactivo"
        role="application"
      >
        <defs>
          {/* Halo filter */}
          <filter id="halo-sepia" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feColorMatrix type="matrix" values="1.2 0.8 0.2 0 0  0.9 0.7 0.1 0 0  0.3 0.3 0.1 0 0  0 0 0 0.7 0" in="blur" result="colored" />
            <feMerge><feMergeNode in="colored" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="halo-teal" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix type="matrix" values="0.2 0.5 0.6 0 0  0.5 0.8 0.6 0 0  0.3 0.6 0.5 0 0  0 0 0 0.65 0" in="blur" result="colored" />
            <feMerge><feMergeNode in="colored" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="halo-selected" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feColorMatrix type="matrix" values="1.4 0.8 0.2 0 0  1.0 0.8 0.1 0 0  0.3 0.3 0.1 0 0  0 0 0 0.9 0" in="blur" result="colored" />
            <feMerge><feMergeNode in="colored" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Density overlay circles */}
        {showDensity && points.map((p) => (
          <circle
            key={`density-${p.event.id}`}
            cx={p.x}
            cy={p.y}
            r={40 + (["4", "5"].includes(p.event.intensity) ? 20 : ["2", "3"].includes(p.event.intensity) ? 10 : 0)}
            fill={
              ["4", "5"].includes(p.event.intensity)
                ? "rgba(139,115,85,0.06)"
                : ["2", "3"].includes(p.event.intensity)
                  ? "rgba(74,124,111,0.05)"
                  : "rgba(74,124,111,0.03)"
            }
            style={{ mixBlendMode: "screen" }}
          />
        ))}

        {/* Subtle grid lines */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0} y1={i * 75}
            x2={800} y2={i * 75}
            stroke="rgba(42,58,53,0.18)"
            strokeWidth="0.5"
            strokeDasharray="2 6"
          />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * 80} y1={0}
            x2={i * 80} y2={600}
            stroke="rgba(42,58,53,0.18)"
            strokeWidth="0.5"
            strokeDasharray="2 6"
          />
        ))}

        {/* Connecting thread lines between nearby events */}
        {points.map((p, i) =>
          points.slice(i + 1).map((q) => {
            const dist = Math.hypot(p.x - q.x, p.y - q.y)
            if (dist > 180) return null
            const opacity = (1 - dist / 180) * 0.08
            return (
              <line
                key={`link-${p.event.id}-${q.event.id}`}
                x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke="rgba(139,115,85,0.4)"
                strokeWidth="0.5"
                opacity={opacity}
                strokeDasharray="2 4"
              />
            )
          })
        )}

        {/* Markers */}
        {points.map((p) => {
          const isSelected = selectedEventId === p.event.id
          const isHovered = hoveredId === p.event.id
          const isHighlighted = highlightedEventId === p.event.id
          const active = isSelected || isHovered || isHighlighted
          const symbol = EVENT_TYPE_TO_SYMBOL[p.event.type] ?? "vela"
          const MarkerComp = MARKER_COMPONENTS[symbol] ?? CandleMarker
          const breathOffset = Math.sin(breathPhase + p.x * 0.01) * 1.2

          return (
            <g
              key={p.event.id}
              data-marker="true"
              transform={`translate(${p.x}, ${p.y + breathOffset})`}
              onClick={() => onSelectEvent(p.event.id)}
              onMouseEnter={() => setHoveredId(p.event.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
              filter={isSelected ? "url(#halo-selected)" : active ? "url(#halo-sepia)" : undefined}
              role="button"
              aria-label={p.event.title}
            >
              <circle
                cx="0"
                cy="0"
                r={MARKER_SIZE * (isSelected ? 0.7 : 0.55)}
                fill="transparent"
                style={{ pointerEvents: "all" }}
              />
              <g
                style={{
                  transform: `scale(${isSelected ? 1.6 : active ? 1.32 : 1})`,
                  transformOrigin: "center",
                  transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  opacity: isSelected ? 1 : active ? 0.98 : 0.88,
                }}
              >
                <MarkerComp size={MARKER_SIZE} glowing={active} />
              </g>
            </g>
          )
        })}
      </svg>

      {/* Map controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={() => setViewBox((v) => {
            const newW = Math.max(200, v.w * 0.8)
            const newH = Math.max(150, v.h * 0.8)
            onZoomChange?.(viewBoxToZoom(newW))
            return { x: v.x + (v.w - newW) * 0.5, y: v.y + (v.h - newH) * 0.5, w: newW, h: newH }
          })}
          className="w-8 h-8 flex items-center justify-center border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)] rounded-sm transition-all backdrop-blur-sm"
          aria-label="Acercar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button
          onClick={() => setViewBox((v) => {
            const newW = Math.min(1600, v.w * 1.25)
            const newH = Math.min(1200, v.h * 1.25)
            onZoomChange?.(viewBoxToZoom(newW))
            return { x: v.x - (newW - v.w) * 0.5, y: v.y - (newH - v.h) * 0.5, w: newW, h: newH }
          })}
          className="w-8 h-8 flex items-center justify-center border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)] rounded-sm transition-all backdrop-blur-sm"
          aria-label="Alejar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button
          onClick={() => {
            onZoomChange?.(viewBoxToZoom(dimensions.width))
            setViewBox({ x: 0, y: 0, w: dimensions.width, h: dimensions.height })
          }}
          className="w-8 h-8 flex items-center justify-center border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)] rounded-sm transition-all backdrop-blur-sm"
          aria-label="Restablecer vista"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/></svg>
        </button>
      </div>

      {/* Coordinate label bottom-left */}
      <div className="absolute bottom-6 left-6 z-10">
        <span className="font-mono text-[9px] tracking-[0.2em] text-[var(--parchment-dim)] opacity-40 uppercase">
          {events.length} registros cartografiados
        </span>
      </div>
    </div>
  )
}
