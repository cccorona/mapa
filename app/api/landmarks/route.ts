import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"

const LANDMARK_ICONS_BUCKET = "landmark-icons"
const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2 MB para iconos
const MAX_SVG_BYTES = 512 * 1024 // 512 KB para SVG
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const ALLOWED_SVG_TYPES = ["image/svg+xml", "image/svg"]

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  const name = (formData.get("name") as string)?.trim()
  const lng = Number(formData.get("lng"))
  const lat = Number(formData.get("lat"))
  const file = formData.get("image") as File | null
  const fileSvg = formData.get("image_svg") as File | null
  if (!name || !Number.isFinite(lng) || !Number.isFinite(lat) || !file || !file.size) {
    return NextResponse.json(
      { error: "Faltan nombre, lng, lat o imagen" },
      { status: 400 }
    )
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Imagen máximo ${MAX_FILE_BYTES / 1024 / 1024} MB. Usa PNG, JPG o WebP más pequeño.` },
      { status: 400 }
    )
  }
  const mime = file.type || "image/png"
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    return NextResponse.json(
      { error: "Solo imágenes PNG, JPEG, WebP o GIF" },
      { status: 400 }
    )
  }
  if (fileSvg?.size && fileSvg.size > MAX_SVG_BYTES) {
    return NextResponse.json(
      { error: `SVG máximo ${MAX_SVG_BYTES / 1024} KB.` },
      { status: 400 }
    )
  }
  const svgMime = fileSvg?.type ?? ""
  const isSvg =
    fileSvg?.size &&
    (ALLOWED_SVG_TYPES.includes(svgMime) || fileSvg.name?.toLowerCase().endsWith(".svg"))
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png"
  const path = `${crypto.randomUUID()}.${safeExt}`
  try {
    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(LANDMARK_ICONS_BUCKET)
      .upload(path, file, { contentType: mime, upsert: false })
    if (uploadError) {
      console.error("[POST /api/landmarks] Storage upload:", uploadError)
      const msg = process.env.NODE_ENV === "development" ? uploadError.message : "Error al subir imagen"
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const { data: urlData } = supabase.storage.from(LANDMARK_ICONS_BUCKET).getPublicUrl(path)
    let iconSvgUrl: string | null = null
    if (isSvg && fileSvg) {
      const pathSvg = `${crypto.randomUUID()}.svg`
      const { error: uploadSvgError } = await supabase.storage
        .from(LANDMARK_ICONS_BUCKET)
        .upload(pathSvg, fileSvg, { contentType: "image/svg+xml", upsert: false })
      if (!uploadSvgError) {
        const { data: urlSvgData } = supabase.storage
          .from(LANDMARK_ICONS_BUCKET)
          .getPublicUrl(pathSvg)
        iconSvgUrl = urlSvgData.publicUrl
      }
    }
    const { data: newId, error: insertError } = await supabase.rpc("insert_landmark", {
      p_name: name,
      p_lng: lng,
      p_lat: lat,
      p_icon_url: urlData.publicUrl,
      p_icon_svg_url: iconSvgUrl,
    })
    if (insertError) {
      console.error("[POST /api/landmarks] insert_landmark RPC:", insertError)
      const msg = process.env.NODE_ENV === "development" ? insertError.message : "Error al guardar landmark"
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({
      id: newId,
      name,
      lng,
      lat,
      icon_url: urlData.publicUrl,
      icon_svg_url: iconSvgUrl,
    })
  } catch (err) {
    console.error("[POST /api/landmarks]", err)
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error ? err.message : "Error interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
