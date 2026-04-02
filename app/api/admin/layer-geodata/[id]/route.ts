import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/require-session"
import { createAdminClient } from "@/lib/supabase/admin-server"

type RouteParams = { params: Promise<{ id: string }> }

/** GET: obtener un layer_geodata por id (incluye geojson). */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSession(_request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("layer_geodata")
      .select("id, name, type, group_id, sublayer_id, sub_sublayer_id, geojson, created_at")
      .eq("id", id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/** DELETE: eliminar un layer_geodata. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireSession(_request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("layer_geodata").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
