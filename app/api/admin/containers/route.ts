import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"

/** Misma posición práctica (5 decimales) para no duplicar filas en location_containers. */
function roundCoord5(n: number): number {
  return Math.round(n * 1e5) / 1e5
}

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("get_location_containers_all")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => ({}))
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat)
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng)
  const label = typeof body.label === "string" ? body.label : null
  const group = typeof body.group === "string" ? body.group : null
  const layer = typeof body.layer === "string" ? body.layer : null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat y lng requeridos" }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { data: existingRows, error: listError } = await supabase.rpc("get_location_containers_all")
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })
    const rows = (existingRows ?? []) as Array<{ id: string; lat: number; lng: number }>
    const duplicate = rows.find(
      (r) => roundCoord5(r.lat) === roundCoord5(lat) && roundCoord5(r.lng) === roundCoord5(lng)
    )
    if (duplicate) {
      return NextResponse.json({ id: duplicate.id })
    }
    const { data, error } = await supabase.rpc("create_location_container", {
      p_lat: lat,
      p_lng: lng,
      p_label: label,
      p_group: group,
      p_layer: layer,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
