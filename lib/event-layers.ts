/**
 * Capas jerárquicas para eventos: capa (layer) → subcapa (sublayer) → sub_sub_capa (sublayer_detail).
 * Modelo extensible (METRO, METROBUS, VEGETACION, etc.).
 * Para Metro: capa = METRO, subcapa = LINEA (ej. LINEA2), sub_sub_capa = ESTACION (código estación).
 */

import { METRO_LINE2_COORDS } from "@/lib/metro-station-coords"

/** Nombres de nivel para documentación / filtros. */
export const CAPA = "layer" as const
export const SUBCAPA = "sublayer" as const
export const SUB_SUBCAPA = "sublayer_detail" as const

/** Códigos de capa de primer nivel (capa). DEFAULT = sin asignar. */
export const LAYER_DEFAULT = "DEFAULT"
export const LAYER_METRO = "METRO"
export const LAYER_VEGETACION = "VEGETACION"

/** Sublayer Metro: tipo línea. Valores concretos: LINEA2, LINEA3, etc. */
export const METRO_SUBCAPA_LINEA = "LINEA" as const
/** Sub-subcapa Metro: estación (código). */
export const METRO_SUBSUBCAPA_ESTACION = "ESTACION" as const

/** Sublayer para Metro línea 2 (subcapa = línea). */
export const METRO_LINEA2 = "LINEA2"

/** Sublayers para Vegetación: ARBOLES → JACARANDAS (capas en el mapa, filtros futuros). */
export const VEGETACION_ARBOLES = "ARBOLES"
export const VEGETACION_JACARANDAS = "JACARANDAS"

/** Nombres de estación L2 (orden de la línea). */
export const METRO_LINE2_STATION_NAMES = Object.keys(METRO_LINE2_COORDS) as string[]

/** Convierte nombre de estación a código (sublayer_detail): MAYÚSCULAS, espacios/slash → _ */
function stationNameToCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\u0300/g, "")
    .replace(/[\s\/]+/g, "_")
    .toUpperCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || name.toUpperCase()
}

/** Mapa nombre de estación L2 → código (ej. "Tasqueña" → "TASQUENA") */
export const METRO_LINE2_STATION_CODES: Record<string, string> = {}
METRO_LINE2_STATION_NAMES.forEach((name) => {
  METRO_LINE2_STATION_CODES[name] = stationNameToCode(name)
})

/** Dado un código de estación, devuelve el nombre para mostrar (primera coincidencia). */
export function getStationNameByCode(code: string): string | null {
  const entry = Object.entries(METRO_LINE2_STATION_CODES).find(([, c]) => c === code)
  return entry ? entry[0] : null
}

/** Dado nombre de estación (p. ej. del GeoJSON o "Zócalo"), devuelve código para layer. */
export function getStationCodeForName(name: string): string | null {
  if (METRO_LINE2_COORDS[name]) return METRO_LINE2_STATION_CODES[name] ?? stationNameToCode(name)
  if (name === "Zócalo") return METRO_LINE2_STATION_CODES["Zócalo/Tenochtitlan"] ?? "ZOCALO_TENOCHTITLAN"
  const code = stationNameToCode(name)
  return METRO_LINE2_STATION_NAMES.some((n) => METRO_LINE2_STATION_CODES[n] === code) ? code : null
}

/** Configuración Metro: layer = METRO, sublayer = LINEA2, sublayer_detail = código estación. */
export const METRO_LAYER_CONFIG = {
  layer: LAYER_METRO,
  sublayer: METRO_LINEA2,
  stationNames: METRO_LINE2_STATION_NAMES,
  stationNameToCode: (name: string) => METRO_LINE2_STATION_CODES[name] ?? stationNameToCode(name),
  getCoords: (name: string) => METRO_LINE2_COORDS[name] ?? null,
} as const

/** Indica si un evento pertenece a la capa Metro (para filtros). */
export function isEventInMetroLayer(layer: string | null | undefined): boolean {
  return layer === LAYER_METRO
}

/** Indica si un evento coincide con una estación dada (layer/sublayer/sublayer_detail). */
export function eventMatchesStation(
  eventLayer: string | null | undefined,
  eventSublayer: string | null | undefined,
  eventSublayerDetail: string | null | undefined,
  stationLayer: string,
  stationSublayer: string,
  stationDetailCode: string | null
): boolean {
  if (eventLayer !== stationLayer) return false
  if (stationSublayer && eventSublayer !== stationSublayer) return false
  if (stationDetailCode && eventSublayerDetail !== stationDetailCode) return false
  return true
}
