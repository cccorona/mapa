"use client"

import { useCallback, useEffect, useState } from "react"
import Particles, { initParticlesEngine } from "@tsparticles/react"
import { loadSlim } from "@tsparticles/slim"
import { loadCanvasMaskPlugin } from "@tsparticles/plugin-canvas-mask"
import { loadPolygonMaskPlugin } from "@tsparticles/plugin-polygon-mask"
import { getMaskImageSrc as getMaskSrc, getParticlesOptions } from "@/lib/landmark-particles"

const ENGINE_INIT_KEY = "landmark-particles-engine-inited"

export interface LandmarkParticlesOverlayProps {
  name: string
  iconUrl: string
  iconSvgUrl?: string | null
  onClose: () => void
}

export function LandmarkParticlesOverlay({
  name,
  iconUrl,
  iconSvgUrl,
  onClose,
}: LandmarkParticlesOverlayProps) {
  const [init, setInit] = useState(false)
  const [maskImageSrc, setMaskImageSrc] = useState<string>("")
  const [imageReady, setImageReady] = useState(false)

  useEffect(() => {
    if ((globalThis as unknown as { [ENGINE_INIT_KEY]?: boolean })[ENGINE_INIT_KEY]) {
      setInit(true)
      return
    }
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
      await loadCanvasMaskPlugin(engine)
      await loadPolygonMaskPlugin(engine)
      ;(globalThis as unknown as { [ENGINE_INIT_KEY]: boolean })[ENGINE_INIT_KEY] = true
    }).then(() => setInit(true))
  }, [])

  useEffect(() => {
    setImageReady(false)
    if (iconSvgUrl) {
      setMaskImageSrc(getMaskSrc(iconSvgUrl))
      setImageReady(true)
      return
    }
    const src = getMaskSrc(iconUrl)
    if (!src) {
      setMaskImageSrc("")
      setImageReady(true)
      return
    }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      setMaskImageSrc(src)
      setImageReady(true)
    }
    img.onerror = () => {
      setMaskImageSrc(src)
      setImageReady(true)
    }
    img.src = src
  }, [iconUrl, iconSvgUrl])

  const options = getParticlesOptions(maskImageSrc || iconUrl, iconSvgUrl || undefined)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label={`Partículas: ${name}`}
    >
      <div
        className="absolute inset-0"
        onClick={handleBackdropClick}
        aria-hidden
      />
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col items-center justify-center p-6">
        {init && imageReady && (
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: "min(70vmin, 480px)", height: "min(70vmin, 480px)" }}
          >
            <Particles
              key={`landmark-particles-${iconUrl}`}
              id="landmark-particles"
              options={options}
              className="h-full w-full"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}
        <p className="relative z-20 mt-auto font-mono text-sm tracking-widest text-[var(--parchment-dim)]">
          {name}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="relative z-20 mt-4 rounded border border-[var(--parchment-dim)]/40 bg-black/30 px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--parchment)] hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-[var(--parchment)]/50"
          aria-label="Cerrar"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
