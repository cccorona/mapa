import { NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth/session"

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request.headers.get("cookie") ?? null)
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  return NextResponse.json({
    user: { id: session.userId, email: session.email },
  })
}
