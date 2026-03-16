import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat)
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng)
  const location_label = typeof body.location_label === "string" ? body.location_label : undefined
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat y lng requeridos" }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("update_event_location", {
      p_event_id: id,
      p_lat: lat,
      p_lng: lng,
      p_location_label: location_label ?? null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(Array.isArray(data) ? data[0] : data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
