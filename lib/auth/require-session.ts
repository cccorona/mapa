import { NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth/session"
import type { SessionPayload } from "@/lib/auth/session"

export async function requireSession(
  request: Request
): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await getSessionFromRequest(request.headers.get("cookie") ?? null)
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  return { session }
}
