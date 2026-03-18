/**
 * Lee el catálogo de capas desde la BD (layer_groups, layer_sublayers, layer_sub_sublayers).
 * Usado por la API para servir catálogo versionado. Fallback a catálogo estático si la BD no tiene tablas.
 */

import { createAdminClient } from "@/lib/supabase/admin-server"
import type { LayerCatalogPayload, LayerHierarchy } from "@/lib/layer-catalog"
import { LAYER_CATALOG_VERSION } from "@/lib/layer-catalog"

export async function getCatalogFromDb(): Promise<LayerCatalogPayload | null> {
  try {
    const supabase = createAdminClient()
    const [groupsRes, sublayersRes, subSublayersRes] = await Promise.all([
      supabase.from("layer_groups").select("id, code, name").order("code"),
      supabase.from("layer_sublayers").select("id, group_id, code, name").order("code"),
      supabase.from("layer_sub_sublayers").select("id, sublayer_id, code, name").order("code"),
    ])
    if (groupsRes.error || sublayersRes.error || subSublayersRes.error) return null
    const groups = groupsRes.data ?? []
    const sublayers = sublayersRes.data ?? []
    const subSublayers = subSublayersRes.data ?? []

    const hierarchy: LayerHierarchy = {}
    for (const g of groups) {
      const gCode = g.code as string
      hierarchy[gCode] = {}
      const groupSublayers = sublayers.filter((s) => s.group_id === g.id)
      for (const s of groupSublayers) {
        const sCode = s.code as string
        const subSubList = subSublayers
          .filter((ss) => ss.sublayer_id === s.id)
          .map((ss) => ss.code as string)
        hierarchy[gCode][sCode] = subSubList
      }
    }

    const groupsPayload = groups.map((g) => ({ code: g.code as string, name: (g.name as string) || (g.code as string) }))

    return {
      version: LAYER_CATALOG_VERSION,
      hierarchy,
      groups: groupsPayload,
      types: ["line", "point", "polygon"],
    }
  } catch {
    return null
  }
}

export type CatalogTreeGroup = {
  id: string
  code: string
  name: string
  sublayers: CatalogTreeSublayer[]
}

export type CatalogTreeSublayer = {
  id: string
  code: string
  name: string
  subSublayers: { id: string; code: string; name: string }[]
}

/** Árbol completo con IDs para el admin (CRUD). */
export async function getCatalogTreeFromDb(): Promise<CatalogTreeGroup[]> {
  try {
    const supabase = createAdminClient()
    const [groupsRes, sublayersRes, subSublayersRes] = await Promise.all([
      supabase.from("layer_groups").select("id, code, name").order("code"),
      supabase.from("layer_sublayers").select("id, group_id, code, name").order("code"),
      supabase.from("layer_sub_sublayers").select("id, sublayer_id, code, name").order("code"),
    ])
    if (groupsRes.error || sublayersRes.error || subSublayersRes.error) return []
    const groups = groupsRes.data ?? []
    const sublayers = sublayersRes.data ?? []
    const subSublayers = subSublayersRes.data ?? []

    return groups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      sublayers: sublayers
        .filter((s) => s.group_id === g.id)
        .map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          subSublayers: subSublayers
            .filter((ss) => ss.sublayer_id === s.id)
            .map((ss) => ({ id: ss.id, code: ss.code, name: ss.name })),
        })),
    }))
  } catch {
    return []
  }
}
