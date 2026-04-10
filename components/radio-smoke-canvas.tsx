"use client"

import { useEffect, useRef } from "react"

export interface RadioSmokeCanvasProps {
  /** 0 caótico, 1 fluido / enganchado */
  signalQuality01: number
  isDragging: boolean
  className?: string
}

/**
 * Niebla / estática visual reactiva (no el audio). Bajo quality = más turbulento.
 */
export function RadioSmokeCanvas({ signalQuality01, isDragging, className }: RadioSmokeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const qualityRef = useRef(signalQuality01)
  const dragRef = useRef(isDragging)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; r: number; a: number }[]
  >(null)

  useEffect(() => {
    qualityRef.current = signalQuality01
  }, [signalQuality01])

  useEffect(() => {
    dragRef.current = isDragging
  }, [isDragging])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const DPR = Math.min(window.devicePixelRatio ?? 1, 2)
    let w = 0
    let h = 0

    const initParticles = () => {
      const n = Math.floor((w * h) / 1200) + 24
      const arr: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = []
      for (let i = 0; i < n; i++) {
        arr.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: 0.6 + Math.random() * 2.2,
          a: 0.08 + Math.random() * 0.2,
        })
      }
      particlesRef.current = arr
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.floor(w * DPR)
      canvas.height = Math.floor(h * DPR)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      initParticles()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let t0 = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000)
      t0 = now

      const q = qualityRef.current
      const chaos = 1 - q
      const dragBoost = dragRef.current ? 0.35 : 0
      const parts = particlesRef.current
      if (!parts || w < 2 || h < 2) {
        rafRef.current = requestAnimationFrame(frame)
        return
      }

      ctx.clearRect(0, 0, w, h)
      const breath = 0.65 + 0.35 * Math.sin(now * 0.0022) * (0.4 + q * 0.6)
      const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.65)
      g.addColorStop(0, `rgba(212,201,168,${0.04 + q * 0.1 * breath})`)
      g.addColorStop(0.45, `rgba(80,65,50,${0.06 + chaos * 0.08})`)
      g.addColorStop(1, "rgba(8,10,9,0.02)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      for (const p of parts) {
        const turb = chaos * (0.9 + dragBoost) * 28
        p.vx += (Math.random() - 0.5) * turb * dt
        p.vy += (Math.random() - 0.5) * turb * dt
        p.vx *= 0.92 + q * 0.07
        p.vy *= 0.92 + q * 0.07
        p.x += p.vx * (18 + q * 22) * dt
        p.y += p.vy * (18 + q * 22) * dt
        if (p.x < 0) p.x += w
        if (p.x > w) p.x -= w
        if (p.y < 0) p.y += h
        if (p.y > h) p.y -= h

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180,165,140,${p.a * (0.4 + q * 0.55)})`
        ctx.fill()
      }

      ctx.globalCompositeOperation = "screen"
      ctx.fillStyle = `rgba(0,163,224,${0.02 + q * 0.06})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = "source-over"

      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)

    const onVis = () => {
      if (document.visibilityState === "hidden" && rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      } else if (document.visibilityState === "visible" && !rafRef.current) {
        t0 = performance.now()
        rafRef.current = requestAnimationFrame(frame)
      }
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  )
}
