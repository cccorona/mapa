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
  const status = body.status === "approved" || body.status === "rejected" ? body.status : null
  if (!status) {
    return NextResponse.json({ error: "status debe ser approved o rejected" }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("update_event_status", {
      p_event_id: id,
      p_status: status,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
