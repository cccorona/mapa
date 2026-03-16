"use client"

import { useEffect, useState } from "react"
import Particles, { initParticlesEngine } from "@tsparticles/react"
import { loadSlim } from "@tsparticles/slim"
import { loadCanvasMaskPlugin } from "@tsparticles/plugin-canvas-mask"
import { loadPolygonMaskPlugin } from "@tsparticles/plugin-polygon-mask"
import { getMaskImageSrc, getParticlesOptionsMini } from "@/lib/landmark-particles"
import { devLog } from "@/lib/dev-log"

const ENGINE_INIT_KEY = "landmark-particles-engine-inited"
const SIZE_PX = 84
const ICON_SIZE_PX = 47

export interface LandmarkParticleIconProps {
  id: string
  iconUrl: string
  iconSvgUrl?: string | null
  name?: string
  onClick?: () => void
  /** Si false, solo se muestra la imagen (sin partículas). Usar en mapa para no bloquear. */
  particlesEnabled?: boolean
}

export function LandmarkParticleIcon({
  id,
  iconUrl,
  iconSvgUrl,
  name,
  onClick,
  particlesEnabled = true,
}: LandmarkParticleIconProps) {
  const [init, setInit] = useState(false)
  const [imageReady, setImageReady] = useState(false)

  useEffect(() => {
    if (!particlesEnabled) return
    if ((globalThis as unknown as { [ENGINE_INIT_KEY]?: boolean })[ENGINE_INIT_KEY]) {
      devLog("[LandmarkParticleIcon] engine already inited", id)
      setInit(true)
      return
    }
    devLog("[LandmarkParticleIcon] initing engine", id)
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
      await loadCanvasMaskPlugin(engine)
      await loadPolygonMaskPlugin(engine)
      ;(globalThis as unknown as { [ENGINE_INIT_KEY]: boolean })[ENGINE_INIT_KEY] = true
    })
      .then(() => {
        devLog("[LandmarkParticleIcon] engine inited", id)
        setInit(true)
      })
      .catch((err) => {
        devLog("[LandmarkParticleIcon] engine init failed", { id, err: String(err) })
      })
  }, [id, particlesEnabled])

  useEffect(() => {
    setImageReady(false)
    if (iconSvgUrl && particlesEnabled) {
      devLog("[LandmarkParticleIcon] imageReady (svg)", id)
      setImageReady(true)
      return
    }
    if (!particlesEnabled) {
      setImageReady(true)
      return
    }
    const src = getMaskImageSrc(iconUrl)
    if (!src) {
      devLog("[LandmarkParticleIcon] imageReady (no src)", id)
      setImageReady(true)
      return
    }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      devLog("[LandmarkParticleIcon] imageReady (loaded)", id)
      setImageReady(true)
    }
    img.onerror = () => {
      devLog("[LandmarkParticleIcon] image error", id)
      setImageReady(true)
    }
    img.src = src
  }, [id, iconUrl, iconSvgUrl, particlesEnabled])

  const options = getParticlesOptionsMini(iconUrl, iconSvgUrl || undefined)
  const proxySrc = getMaskImageSrc(iconUrl) || iconUrl

  useEffect(() => {
    if (init && imageReady) {
      devLog("[LandmarkParticleIcon] mounted Particles", { id, svg: !!iconSvgUrl })
    }
  }, [id, init, imageReady, iconSvgUrl])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
      className="landmark-particle-icon"
      style={{
        width: SIZE_PX,
        height: SIZE_PX,
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
      }}
      aria-label={name}
    >
      {particlesEnabled && init && imageReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: SIZE_PX,
            height: SIZE_PX,
          }}
        >
          <Particles
            key={iconUrl}
            id={`landmark-mini-${id}`}
            options={options}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
      <img
        src={proxySrc}
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: ICON_SIZE_PX,
          height: ICON_SIZE_PX,
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
