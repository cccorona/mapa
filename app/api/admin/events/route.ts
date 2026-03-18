import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("get_events_for_moderation")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const all = data ?? []
    const total = all.length
    const offset = (page - 1) * pageSize
    const dataPage = all.slice(offset, offset + pageSize)
    return NextResponse.json({ data: dataPage, total })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
