import type { ISourceOptions } from "@tsparticles/engine"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

export function getMaskImageSrc(iconUrl: string): string {
  if (!iconUrl) return ""
  if (SUPABASE_URL && iconUrl.startsWith(SUPABASE_URL)) {
    return `/api/landmarks/icon?url=${encodeURIComponent(iconUrl)}`
  }
  return iconUrl
}

const PARTICLES_COMMON = {
  color: { value: ["#8b7355", "#d4c9a8", "rgba(74, 180, 200, 0.8)"] as const },
  shape: { type: "circle" as const },
  move: { enable: true },
  background: { color: "transparent" as const },
}

/** Opciones para overlay: si hay iconSvgUrl se usa polygon mask (SVG), si no canvas mask (imagen). */
export function getParticlesOptions(iconUrl: string, iconSvgUrl?: string | null): ISourceOptions {
  if (iconSvgUrl) {
    const src = getMaskImageSrc(iconSvgUrl)
    return {
      polygon: {
        enable: true,
        type: "inside",
        url: src,
        scale: 0.55,
        position: { x: 50, y: 50 },
      },
      particles: {
        ...PARTICLES_COMMON,
        number: { value: 2500 },
        size: { value: { min: 2, max: 4 } },
        move: { ...PARTICLES_COMMON.move, speed: 0.4 },
        opacity: { value: { min: 0.5, max: 0.95 } },
      },
      background: PARTICLES_COMMON.background,
    }
  }
  const src = getMaskImageSrc(iconUrl)
  return {
    canvasMask: {
      enable: true,
      image: { src },
      scale: 0.55,
      position: { x: 50, y: 50 },
      override: { color: true, opacity: false },
      pixels: { offset: 8 },
    },
    particles: {
      ...PARTICLES_COMMON,
      number: { value: 2500 },
      size: { value: { min: 2, max: 4 } },
      move: { ...PARTICLES_COMMON.move, speed: 0.4 },
      opacity: { value: { min: 0.5, max: 0.95 } },
    },
    background: PARTICLES_COMMON.background,
  }
}

/** Opciones para icono pequeño en mapa: si hay iconSvgUrl se usa polygon mask, si no canvas mask. */
export function getParticlesOptionsMini(
  iconUrl: string,
  iconSvgUrl?: string | null
): ISourceOptions {
  if (iconSvgUrl) {
    const src = getMaskImageSrc(iconSvgUrl)
    return {
      polygon: {
        enable: true,
        type: "inside",
        url: src,
        scale: 0.4,
        position: { x: 50, y: 50 },
      },
      particles: {
        ...PARTICLES_COMMON,
        number: { value: 600 },
        size: { value: { min: 0.8, max: 2 } },
        move: { ...PARTICLES_COMMON.move, speed: 0.3 },
        opacity: { value: { min: 0.4, max: 0.85 } },
      },
      background: PARTICLES_COMMON.background,
    }
  }
  const src = getMaskImageSrc(iconUrl)
  return {
    canvasMask: {
      enable: true,
      image: { src },
      scale: 0.4,
      position: { x: 50, y: 50 },
      override: { color: true, opacity: false },
      pixels: { offset: 10 },
    },
    particles: {
      ...PARTICLES_COMMON,
      number: { value: 600 },
      size: { value: { min: 0.8, max: 2 } },
      move: { ...PARTICLES_COMMON.move, speed: 0.3 },
      opacity: { value: { min: 0.4, max: 0.85 } },
    },
    background: PARTICLES_COMMON.background,
  }
}
