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
  const location_container_id =
    body.location_container_id === null || body.location_container_id === ""
      ? null
      : typeof body.location_container_id === "string"
        ? body.location_container_id
        : undefined
  if (location_container_id === undefined) {
    return NextResponse.json({ error: "location_container_id debe ser string o null" }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.rpc("update_event_container_id", {
      p_event_id: id,
      p_location_container_id: location_container_id,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
