/**
 * Shared map configuration types and defaults for estilos, overlays, and filters.
 */
import { CDMX_CENTER } from "@/lib/map-bounds"

export type ArtisticMode = "none" | "varo" | "carrington" | "goya"

export type ProjectionMode = "mercator" | "globe"

export type LightPreset = "day" | "dawn" | "dusk" | "night"

export interface StandardConfig {
  lightPreset: LightPreset
  show3dObjects: boolean
}

export interface PopupConfig {
  titleSize: number
  bodySize: number
  metaSize: number
  backdropOpacity: number
  veilOpacity: number
  panelGlow: number
  blurIn: number
  animDuration: number
}

export interface BoundaryGlowConfig {
  enabled: boolean
  veilOpacity: number
  glowOpacity: number
  glowWidth: number
  glowBlur: number
  lineOpacity: number
  lineWidth: number
}

export interface MapConfig {
  style: string
  projection: ProjectionMode
  zoom: number
  pitch: number
  bearing: number
  standardConfig: StandardConfig
  popupConfig: PopupConfig
  boundaryGlow: BoundaryGlowConfig
  artisticMode: ArtisticMode
  overlays: {
    atmospheric: boolean
    mist: boolean
    vignette: boolean
    rain: boolean
  }
  opacity: {
    atmospheric: number
    mist: number
    vignette: number
    rain: number
  }
  filter: {
    sepia: number
    hueRotate: number
    saturate: number
    contrast: number
    brightness: number
  }
  soulOrb: {
    enabled: boolean
    color: string
    lat: number
    lng: number
    offsetY: number
  }
  /** Mapbox native rain effect (GL JS 3.9+) */
  mapboxRain: {
    enabled: boolean
    color: string
  }
  /** Mapbox native snow effect (GL JS 3.9+) */
  mapboxSnow: {
    enabled: boolean
    color: string
  }
}

export const DEFAULT_MAP_CONFIG: MapConfig = {
  style: "mapbox://styles/ccoronacesar/cmmqs03ui008e01s1028b1h27",
  projection: "mercator",
  zoom: 7,
  pitch: 0,
  bearing: 0,
  standardConfig: {
    lightPreset: "dusk",
    show3dObjects: true,
  },
  popupConfig: {
    titleSize: 22,
    bodySize: 17,
    metaSize: 11,
    backdropOpacity: 40,
    veilOpacity: 100,
    panelGlow: 70,
    blurIn: 2,
    animDuration: 760,
  },
  boundaryGlow: {
    enabled: true,
    veilOpacity: 48,
    glowOpacity: 92,
    glowWidth: 20,
    glowBlur: 6,
    lineOpacity: 95,
    lineWidth: 2.8,
  },
  artisticMode: "carrington",
  overlays: {
    atmospheric: true,
    mist: true,
    vignette: true,
    rain: false,
  },
  opacity: {
    atmospheric: 80,
    mist: 50,
    vignette: 100,
    rain: 65,
  },
  filter: { sepia: 30, hueRotate: 60, saturate: 60, contrast: 110, brightness: 95 },
  soulOrb: {
    enabled: false,
    color: "#050505",
    lat: CDMX_CENTER[1],
    lng: CDMX_CENTER[0],
    offsetY: -12,
  },
  mapboxRain: {
    enabled: false,
    color: "#a8adbc",
  },
  mapboxSnow: {
    enabled: false,
    color: "#ffffff",
  },
}

/** Base CSS filter values per artistic preset (applied on top of manual filter) */
export const ARTISTIC_PRESETS: Record<
  ArtisticMode,
  { sepia: number; hueRotate: number; saturate: number; contrast: number; brightness: number }
> = {
  none: { sepia: 0, hueRotate: 0, saturate: 100, contrast: 100, brightness: 100 },
  varo: { sepia: 40, hueRotate: -10, saturate: 70, contrast: 105, brightness: 100 },
  carrington: { sepia: 30, hueRotate: 60, saturate: 60, contrast: 110, brightness: 95 },
  goya: { sepia: 50, hueRotate: 0, saturate: 50, contrast: 120, brightness: 75 },
}

/** Exporta la configuración actual como JSON para calibración */
export function exportMapConfig(config: Partial<MapConfig>): string {
  const full: MapConfig = {
    ...DEFAULT_MAP_CONFIG,
    ...config,
    overlays: { ...DEFAULT_MAP_CONFIG.overlays, ...config.overlays },
    opacity: { ...DEFAULT_MAP_CONFIG.opacity, ...config.opacity },
    filter: { ...DEFAULT_MAP_CONFIG.filter, ...config.filter },
    standardConfig: { ...DEFAULT_MAP_CONFIG.standardConfig, ...config.standardConfig },
    popupConfig: { ...DEFAULT_MAP_CONFIG.popupConfig, ...config.popupConfig },
    boundaryGlow: { ...DEFAULT_MAP_CONFIG.boundaryGlow, ...config.boundaryGlow },
    soulOrb: { ...DEFAULT_MAP_CONFIG.soulOrb, ...config.soulOrb },
    mapboxRain: { ...DEFAULT_MAP_CONFIG.mapboxRain, ...config.mapboxRain },
    mapboxSnow: { ...DEFAULT_MAP_CONFIG.mapboxSnow, ...config.mapboxSnow },
  }
  return JSON.stringify(full, null, 2)
}
