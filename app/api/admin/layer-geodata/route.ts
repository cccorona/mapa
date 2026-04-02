import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/require-session"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { assignGeoPointIdsToGeojsonFeatures } from "@/lib/geo-point-id"

/** GET: listar todos los layer_geodata. Incluye geojson para el editor de mapa. */
export async function GET(_request: Request) {
  const auth = await requireSession(_request)
  if (auth instanceof NextResponse) return auth
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("layer_geodata")
      .select("id, name, type, group_id, sublayer_id, sub_sublayer_id, geojson, created_at")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/** POST: crear layer_geodata. Body: { group_id, sublayer_id?, sub_sublayer_id?, name, type: 'point'|'line'|'polygon', geojson } */
export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => ({}))
  const group_id = typeof body.group_id === "string" ? body.group_id.trim() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const type = typeof body.type === "string" && ["point", "line", "polygon"].includes(body.type) ? body.type : ""
  const geojson = body.geojson
  if (!group_id || !name || !type) return NextResponse.json({ error: "group_id, name y type requeridos" }, { status: 400 })
  if (!geojson || typeof geojson !== "object") return NextResponse.json({ error: "geojson requerido (objeto)" }, { status: 400 })
  const sublayer_id = typeof body.sublayer_id === "string" ? body.sublayer_id.trim() || null : null
  const sub_sublayer_id = typeof body.sub_sublayer_id === "string" ? body.sub_sublayer_id.trim() || null : null
  try {
    const geojsonNormalized = JSON.parse(JSON.stringify(geojson)) as Record<string, unknown>
    const assignPost = assignGeoPointIdsToGeojsonFeatures(geojsonNormalized)
    if (!assignPost.ok) return NextResponse.json({ error: assignPost.error }, { status: 400 })
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("layer_geodata")
      .insert({ group_id, sublayer_id, sub_sublayer_id, name, type, geojson: geojsonNormalized })
      .select("id, name, type, group_id, sublayer_id, sub_sublayer_id, created_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** PATCH: actualizar layer_geodata. Body: { id, geojson? } — actualiza solo los campos enviados (p. ej. geojson para editar label de un punto). */
export async function PATCH(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === "string" ? body.id.trim() : ""
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  const updates: { geojson?: unknown; name?: string; type?: string } = {}
  if (body.geojson !== undefined) {
    if (typeof body.geojson !== "object" || body.geojson === null) return NextResponse.json({ error: "geojson debe ser un objeto" }, { status: 400 })
    const geojson = JSON.parse(JSON.stringify(body.geojson)) as { features?: Array<{ properties?: Record<string, unknown> }> }
    const assignPatch = assignGeoPointIdsToGeojsonFeatures(geojson)
    if (!assignPatch.ok) return NextResponse.json({ error: assignPatch.error }, { status: 400 })
    for (const f of geojson.features ?? []) {
      const v = f.properties?.location_container_id
      if (v != null && typeof v === "string" && v.trim() !== "") {
        if (!UUID_REGEX.test(v)) return NextResponse.json({ error: `location_container_id inválido (no es UUID): ${v}` }, { status: 400 })
      }
    }
    const containerIds = (geojson.features ?? [])
      .map((f) => f.properties?.location_container_id)
      .filter((v): v is string => typeof v === "string" && v.trim() !== "" && UUID_REGEX.test(v))
    const uniqueIds = [...new Set(containerIds)]
    if (uniqueIds.length > 0) {
      const supabase = createAdminClient()
      const { data: existing } = await supabase.from("location_containers").select("id").in("id", uniqueIds)
      const foundIds = new Set((existing ?? []).map((r) => r.id))
      const missing = uniqueIds.find((uid) => !foundIds.has(uid))
      if (missing) return NextResponse.json({ error: `location_container_id no encontrado: ${missing}` }, { status: 400 })
    }
    updates.geojson = body.geojson
  }
  if (typeof body.name === "string") updates.name = body.name.trim()
  if (typeof body.type === "string" && ["point", "line", "polygon"].includes(body.type)) updates.type = body.type
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Enviar al menos id y geojson, name o type" }, { status: 400 })
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("layer_geodata")
      .update(updates)
      .eq("id", id)
      .select("id, name, type, group_id, sublayer_id, sub_sublayer_id, created_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
