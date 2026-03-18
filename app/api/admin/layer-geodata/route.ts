import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/require-session"
import { createAdminClient } from "@/lib/supabase/admin-server"

/** GET: listar todos los layer_geodata (con nombres de group/sublayer). */
export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("layer_geodata")
      .select("id, name, type, group_id, sublayer_id, sub_sublayer_id, created_at")
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
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("layer_geodata")
      .insert({ group_id, sublayer_id, sub_sublayer_id, name, type, geojson })
      .select("id, name, type, group_id, sublayer_id, sub_sublayer_id, created_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
