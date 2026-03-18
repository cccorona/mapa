import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"

/** PATCH: actualizar solo layer/sublayer/sublayer_detail (sin tocar ubicación). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const group = typeof body.group === "string" ? body.group : null
  const layer = typeof body.layer === "string" ? body.layer : "DEFAULT"
  const sublayer = typeof body.sublayer === "string" ? body.sublayer : null
  const sublayer_detail = typeof body.sublayer_detail === "string" ? body.sublayer_detail : null
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.rpc("update_event_layers", {
      p_event_id: id,
      p_group: group,
      p_layer: layer,
      p_sublayer: sublayer,
      p_sublayer_detail: sublayer_detail,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
