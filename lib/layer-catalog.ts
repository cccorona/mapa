/**
 * Catálogo de capas (group → sub_layer → sub_sub_layers).
 * Todo viene de la BD; este módulo solo define tipos y fallback vacío.
 */

/** Versión del catálogo; incrementar cuando cambie el contrato. */
export const LAYER_CATALOG_VERSION = 1

/** Jerarquía: group → sub_layer → sub_sub_layers[]. */
export type LayerHierarchy = Record<string, Record<string, string[]>>

export interface LayerCatalogPayload {
  version: number
  hierarchy: LayerHierarchy
  /** Grupos con code y name para el panel (desde layer_groups). */
  groups?: { code: string; name: string }[]
  /** Tipos de geometría para render (Mapbox). */
  types: ["line", "point", "polygon"]
}

/** Fallback cuando la BD no devuelve catálogo: vacío, sin grupos quemados. */
export function getLayerCatalog(): LayerCatalogPayload {
  return {
    version: LAYER_CATALOG_VERSION,
    hierarchy: {},
    groups: [],
    types: ["line", "point", "polygon"],
  }
}

/** Tipo de geometría para render (Mapbox). */
export type RenderType = "line" | "point" | "polygon"

/** feature_type para negocio (event, station, etc.). */
export type FeatureType = "event" | "station" | "metro_line"
