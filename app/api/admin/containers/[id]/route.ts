import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat)
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng)
  const label = typeof body.label === "string" ? body.label : null
  const group = typeof body.group === "string" ? body.group : null
  const layer = typeof body.layer === "string" ? body.layer : null
  const hasLat = Number.isFinite(lat)
  const hasLng = Number.isFinite(lng)
  if (hasLat !== hasLng) {
    return NextResponse.json({ error: "lat y lng deben ir juntos" }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.rpc("update_location_container", {
      p_id: id,
      p_lat: hasLat ? lat : null,
      p_lng: hasLng ? lng : null,
      p_label: label,
      p_group: group,
      p_layer: layer,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(_request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("location_containers").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
