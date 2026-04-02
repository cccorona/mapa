/** Clave en `properties` de cada Feature Point en layer_geodata.geojson */
export const GEO_POINT_ID_KEY = "geo_point_id" as const

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function newUuid(): string {
  return globalThis.crypto.randomUUID()
}

type GeojsonFeature = {
  type?: string
  geometry?: { type?: string; coordinates?: unknown }
  properties?: Record<string, unknown>
}

type GeojsonFc = { features?: GeojsonFeature[] }

/**
 * Asigna `geo_point_id` UUID a todo Point sin id válido y comprueba unicidad entre Points.
 * Mutates `geojson.features` in place.
 */
export function assignGeoPointIdsToGeojsonFeatures(geojson: GeojsonFc): { ok: true } | { ok: false; error: string } {
  for (const f of geojson.features ?? []) {
    if (f.geometry?.type !== "Point") continue
    const props = { ...(f.properties ?? {}) }
    const gid = typeof props[GEO_POINT_ID_KEY] === "string" ? String(props[GEO_POINT_ID_KEY]).trim() : ""
    if (!gid || !UUID_REGEX.test(gid)) {
      props[GEO_POINT_ID_KEY] = newUuid()
    }
    f.properties = props
  }
  const seen = new Set<string>()
  for (const f of geojson.features ?? []) {
    if (f.geometry?.type !== "Point") continue
    const gid = typeof f.properties?.[GEO_POINT_ID_KEY] === "string" ? String(f.properties[GEO_POINT_ID_KEY]).trim() : ""
    if (!gid) continue
    if (seen.has(gid)) return { ok: false, error: `geo_point_id duplicado en la capa: ${gid}` }
    seen.add(gid)
  }
  return { ok: true }
}
