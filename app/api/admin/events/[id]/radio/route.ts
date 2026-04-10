import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"
import { FM_MHZ_MAX, FM_MHZ_MIN } from "@/lib/radio-constants"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 })
  }
  let body: { frequency_mhz?: number | null; audio_url?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const freq = body.frequency_mhz

  if (freq != null && freq !== "") {
    const n = typeof freq === "number" ? freq : Number.parseFloat(String(freq))
    if (!Number.isFinite(n) || n < FM_MHZ_MIN || n > FM_MHZ_MAX) {
      return NextResponse.json(
        { error: `frequency_mhz debe estar entre ${FM_MHZ_MIN} y ${FM_MHZ_MAX}` },
        { status: 400 }
      )
    }
  }

  const supabase = createAdminClient()
  const update: Record<string, unknown> = {}
  if ("frequency_mhz" in body) {
    update.frequency_mhz =
      body.frequency_mhz === null || body.frequency_mhz === ""
        ? null
        : typeof body.frequency_mhz === "number"
          ? body.frequency_mhz
          : Number.parseFloat(String(body.frequency_mhz))
  }
  if ("audio_url" in body) {
    update.audio_url =
      body.audio_url === null || body.audio_url === "" ? null : String(body.audio_url).trim()
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin campos" }, { status: 400 })
  }

  const { data, error } = await supabase.from("events").update(update).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
