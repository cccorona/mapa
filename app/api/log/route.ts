import { NextResponse } from "next/server"

/** Solo en dev: el cliente POSTea mensajes y se imprimen en la terminal del servidor. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const msg = typeof body?.msg === "string" ? body.msg : "[log]"
    const data = body?.data
    if (data !== undefined) {
      console.log(msg, data)
    } else {
      console.log(msg)
    }
  } catch (e) {
    console.warn("[api/log] parse error", e)
  }
  return NextResponse.json({ ok: true })
}
