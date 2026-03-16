import { NextResponse } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

export const dynamic = "force-dynamic"

/** Proxy de imagen de landmark para evitar CORS en Mapbox loadImage. */
export async function GET(request: Request) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }
  if (!SUPABASE_URL || !url.startsWith(SUPABASE_URL + "/storage/")) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
    const blob = await res.blob()
    const contentType = res.headers.get("content-type") ?? "image/png"
    return new NextResponse(blob, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Error fetching image" }, { status: 502 })
  }
}
