import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { requireSession } from "@/lib/auth/require-session"

const LANDMARK_ICONS_BUCKET = "landmark-icons"
const MAX_SVG_BYTES = 512 * 1024 // 512 KB
const ALLOWED_SVG_TYPES = ["image/svg+xml", "image/svg"]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const fileSvg = formData.get("image_svg") as File | null
  const name = (formData.get("name") as string)?.trim()
  const lng = formData.get("lng") != null ? Number(formData.get("lng")) : undefined
  const lat = formData.get("lat") != null ? Number(formData.get("lat")) : undefined
  const fileImage = formData.get("image") as File | null

  const supabase = createAdminClient()
  const updates: { icon_svg_url?: string; name?: string; lng?: number; lat?: number; icon_url?: string } = {}

  if (fileSvg?.size) {
    if (fileSvg.size > MAX_SVG_BYTES) {
      return NextResponse.json(
        { error: `SVG máximo ${MAX_SVG_BYTES / 1024} KB` },
        { status: 400 }
      )
    }
    const svgMime = fileSvg.type ?? ""
    const isSvg =
      ALLOWED_SVG_TYPES.includes(svgMime) || fileSvg.name?.toLowerCase().endsWith(".svg")
    if (!isSvg) {
      return NextResponse.json({ error: "El archivo debe ser SVG" }, { status: 400 })
    }
    const pathSvg = `${crypto.randomUUID()}.svg`
    const svgBuffer = Buffer.from(await fileSvg.arrayBuffer())
    const { error: uploadSvgError } = await supabase.storage
      .from(LANDMARK_ICONS_BUCKET)
      .upload(pathSvg, svgBuffer, { contentType: "image/svg+xml", upsert: false })
    if (uploadSvgError) {
      console.error("[PATCH /api/landmarks] SVG upload:", uploadSvgError)
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? uploadSvgError.message : "Error al subir SVG" },
        { status: 500 }
      )
    }
    const { data: urlSvgData } = supabase.storage
      .from(LANDMARK_ICONS_BUCKET)
      .getPublicUrl(pathSvg)
    updates.icon_svg_url = urlSvgData.publicUrl
  }

  if (name !== undefined && name !== "") updates.name = name
  if (lng !== undefined && Number.isFinite(lng)) updates.lng = lng
  if (lat !== undefined && Number.isFinite(lat)) updates.lat = lat

  if (fileImage?.size) {
    const MAX_FILE_BYTES = 2 * 1024 * 1024
    const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if (fileImage.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Imagen máximo 2 MB" }, { status: 400 })
    }
    const mime = fileImage.type || "image/png"
    if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
      return NextResponse.json({ error: "Solo PNG, JPEG, WebP o GIF" }, { status: 400 })
    }
    const ext = fileImage.name.split(".").pop()?.toLowerCase() ?? "png"
    const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png"
    const path = `${crypto.randomUUID()}.${safeExt}`
    const imageBuffer = Buffer.from(await fileImage.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(LANDMARK_ICONS_BUCKET)
      .upload(path, imageBuffer, { contentType: mime, upsert: false })
    if (uploadError) {
      console.error("[PATCH /api/landmarks] Image upload:", uploadError)
      return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 })
    }
    const { data: urlData } = supabase.storage.from(LANDMARK_ICONS_BUCKET).getPublicUrl(path)
    updates.icon_url = urlData.publicUrl
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .from("landmarks")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("[PATCH /api/landmarks]", error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? error.message : "Error al actualizar" },
      { status: 500 }
    )
  }
  return NextResponse.json(row)
}
