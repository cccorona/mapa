"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { RadioSmokeCanvas } from "@/components/radio-smoke-canvas"
import { FM_MHZ_MAX, FM_MHZ_MIN, FM_MHZ_STEP } from "@/lib/radio-constants"
import { clampFmMhz } from "@/lib/radio-frequency"
import {
  CHASSIS_ASPECT,
  KNOB_ROTATION_MAX_DEG,
  KNOB_ROTATION_MIN_DEG,
  dialHitStrip,
  dialKnobPivotInStrip,
  displaySlot,
  rectToPercentStyle,
  signalSlot,
} from "@/lib/radio-chassis-layout"

/** Carcasa Jasqueña (`public/images/radio/chassis.png`). */
const CHASSIS_IMAGE_SRC = "/images/radio/chassis.png"
/** Perilla (`public/images/radio/knob.png`). */
const KNOB_IMAGE_SRC = "/images/radio/knob.png"

function mhzToKnobRotationDeg(mhz: number): number {
  const t = (mhz - FM_MHZ_MIN) / (FM_MHZ_MAX - FM_MHZ_MIN)
  return KNOB_ROTATION_MIN_DEG + t * (KNOB_ROTATION_MAX_DEG - KNOB_ROTATION_MIN_DEG)
}

export interface FmTunerPanelProps {
  valueMhz: number
  onChange: (mhz: number) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /** 0–1: coherencia mapa–dial (distancia al espectro). */
  signalQuality01: number
  onUserInteract?: () => void
  onDragStateChange?: (dragging: boolean) => void
}

export function FmTunerPanel({
  valueMhz,
  onChange,
  collapsed,
  onCollapsedChange,
  signalQuality01,
  onUserInteract,
  onDragStateChange,
}: FmTunerPanelProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [chassisOk, setChassisOk] = useState(true)
  const [displayMhz, setDisplayMhz] = useState(valueMhz)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    setDisplayMhz(valueMhz)
  }, [valueMhz])

  useEffect(() => {
    onDragStateChange?.(isDragging)
  }, [isDragging, onDragStateChange])

  const pctToMhz = useCallback((pct: number) => {
    const t = Math.min(100, Math.max(0, pct))
    const raw = FM_MHZ_MIN + (t / 100) * (FM_MHZ_MAX - FM_MHZ_MIN)
    return clampFmMhz(Math.round(raw * 10) / 10)
  }, [])

  const scheduleEmit = useCallback(
    (mhz: number) => {
      setDisplayMhz(mhz)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        onChange(mhz)
      })
    },
    [onChange]
  )

  const onPointerMove = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const pct = ((clientX - r.left) / r.width) * 100
      scheduleEmit(pctToMhz(pct))
    },
    [pctToMhz, scheduleEmit]
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    onUserInteract?.()
    dragging.current = true
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    onPointerMove(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    onPointerMove(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    dragging.current = false
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const q = signalQuality01
  const mhzToPct = useCallback((mhz: number) => {
    return ((mhz - FM_MHZ_MIN) / (FM_MHZ_MAX - FM_MHZ_MIN)) * 100
  }, [])
  const knobLeft = mhzToPct(displayMhz)
  const knobDeg = mhzToKnobRotationDeg(displayMhz)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onCollapsedChange(false)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--sepia)]/40",
          "bg-[var(--panel-bg)]/95 text-[var(--parchment)] font-mono text-[11px] tracking-[0.2em] uppercase",
          "shadow-lg hover:border-[var(--sepia)]/70 transition-colors"
        )}
        aria-expanded={false}
      >
        <span className="text-[var(--parchment-dim)]">FM</span>
        <span
          className="text-[var(--primary)] tabular-nums"
          style={{
            filter: `brightness(${0.75 + q * 0.45})`,
            textShadow: `0 0 ${8 + q * 20}px rgba(0,163,224,${0.2 + q * 0.5})`,
          }}
        >
          {displayMhz.toFixed(1)}
        </span>
        <span className="text-[var(--parchment-dim)]">MHz</span>
      </button>
    )
  }

  return (
    <div
      className={cn(
        "relative w-full max-w-[300px] overflow-hidden rounded-2xl border border-[#5c4a32]/50",
        "shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
      )}
      style={{
        background:
          "linear-gradient(168deg, rgba(42,36,30,0.98) 0%, rgba(14,16,14,0.99) 45%, rgba(24,20,16,0.97) 100%)",
      }}
    >
      <div
        className="relative w-full"
        style={{
          aspectRatio: `${CHASSIS_ASPECT}`,
        }}
      >
        {/* Capa inferior: huecos (humo + MHz) visibles a través del alpha de la carcasa */}
        <div className="absolute inset-0 z-0">
          <div
            className="overflow-hidden rounded-[2px]"
            style={rectToPercentStyle(signalSlot)}
          >
            <div className="absolute inset-0 bg-[#0a0c0b]/85" aria-hidden />
            <RadioSmokeCanvas signalQuality01={q} isDragging={isDragging} className="absolute inset-0" />
          </div>
          <div
            className="flex items-center justify-center overflow-hidden rounded-[2px]"
            style={rectToPercentStyle(displaySlot)}
          >
            <div className="absolute inset-0 bg-[#0a0c0b]/80" aria-hidden />
            <span
              className={cn(
                "relative z-[1] font-mono tabular-nums tracking-[0.1em] text-[var(--primary)] text-center px-0.5",
                q < 0.42 && "animate-pulse"
              )}
              style={{
                fontSize: "clamp(10px, 2.8vw, 16px)",
                filter: `brightness(${0.78 + q * 0.42})`,
                textShadow: `0 0 ${6 + q * 24}px rgba(0,163,224,${0.18 + q * 0.52})`,
              }}
            >
              {displayMhz.toFixed(1)}
              <span className="text-[var(--parchment-dim)] ml-0.5 text-[0.75em]">MHz</span>
            </span>
          </div>
        </div>

        {chassisOk && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- carcasa local */}
            <img
              src={CHASSIS_IMAGE_SRC}
              alt=""
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover select-none"
              onError={() => setChassisOk(false)}
            />
          </>
        )}

        {/* Dial: franja táctil + perilla imagen encima de la carcasa */}
        <div className="absolute z-[2]" style={rectToPercentStyle(dialHitStrip)}>
          <div
            ref={trackRef}
            role="slider"
            aria-valuemin={FM_MHZ_MIN}
            aria-valuemax={FM_MHZ_MAX}
            aria-valuenow={displayMhz}
            aria-label="Sintonizar frecuencia FM"
            className="absolute inset-x-0 bottom-0 min-h-[44px] cursor-grab touch-none active:cursor-grabbing md:min-h-[36px]"
            style={{
              top: "0",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- perilla local */}
            <img
              src={KNOB_IMAGE_SRC}
              alt=""
              className={cn(
                "pointer-events-none absolute h-7 w-7 object-contain select-none",
                isDragging && "scale-110"
              )}
              style={{
                left: `${knobLeft}%`,
                top: `${dialKnobPivotInStrip.y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${knobDeg}deg)`,
                transformOrigin: "center center",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.65))",
                transition: isDragging ? "none" : "transform 0.08s ease-out",
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          className={cn(
            "absolute right-1.5 top-1.5 z-[10] flex h-7 w-7 items-center justify-center rounded-full",
            "border border-[var(--panel-border)]/80 bg-[var(--panel-bg)]/90 text-[var(--parchment-dim)]",
            "font-mono text-sm leading-none hover:border-[var(--sepia)] hover:text-[var(--parchment)]"
          )}
          aria-label="Minimizar sintonizador"
        >
          −
        </button>
      </div>

      <p className="border-t border-[var(--panel-border)]/40 px-2 py-1.5 text-center font-mono text-[8px] tracking-[0.12em] text-[var(--parchment-dim)] opacity-80">
        {FM_MHZ_MIN} — {FM_MHZ_MAX} · paso {FM_MHZ_STEP}
      </p>
    </div>
  )
}
