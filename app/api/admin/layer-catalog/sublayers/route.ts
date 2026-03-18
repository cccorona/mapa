import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/require-session"
import { createAdminClient } from "@/lib/supabase/admin-server"

/** POST: crear subcapa. Body: { group_id: string, code: string, name: string } */
export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => ({}))
  const group_id = typeof body.group_id === "string" ? body.group_id.trim() : ""
  const code = typeof body.code === "string" ? body.code.trim() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!group_id || !code || !name) return NextResponse.json({ error: "group_id, code y name requeridos" }, { status: 400 })
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("layer_sublayers").insert({ group_id, code, name }).select("id, group_id, code, name").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
