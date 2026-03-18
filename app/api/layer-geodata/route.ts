import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"

/** GET: listar layer_geodata para el mapa. Query: ?group_id= uuid o ?group_code= TRANSPORT. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const group_id = searchParams.get("group_id")
    const group_code = searchParams.get("group_code")
    const supabase = createAdminClient()
    let target_group_id: string | null = group_id
    if (group_code && !group_id) {
      const { data: g } = await supabase.from("layer_groups").select("id").eq("code", group_code).single()
      target_group_id = g?.id ?? null
    }
    let query = supabase
      .from("layer_geodata")
      .select("id, name, type, group_id, sublayer_id, sub_sublayer_id, geojson")
    if (target_group_id) query = query.eq("group_id", target_group_id)
    const { data, error } = await query.order("created_at", { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
