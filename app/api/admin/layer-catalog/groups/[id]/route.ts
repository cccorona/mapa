import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/require-session"
import { createAdminClient } from "@/lib/supabase/admin-server"

/** PATCH: actualizar grupo. Body: { code?: string, name?: string } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const updates: { code?: string; name?: string } = {}
  if (typeof body.code === "string" && body.code.trim()) updates.code = body.code.trim()
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim()
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("layer_groups").update(updates).eq("id", id).select("id, code, name").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/** DELETE: borrar grupo (cascade borra sublayers y sub_sublayers). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(_request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("layer_groups").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
