import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { verifyPassword } from "@/lib/auth/password"
import {
  createSessionCookie,
  buildSessionPayload,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth/session"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña requeridos" },
        { status: 400 }
      )
    }
    const supabase = createAdminClient()
    const { data: row, error } = await supabase
      .from("app_users")
      .select("id, email, password_hash")
      .eq("email", email)
      .single()
    if (error || !row || !verifyPassword(password, row.password_hash)) {
      return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 })
    }
    const payload = buildSessionPayload(row.id, row.email)
    const cookieValue = await createSessionCookie(payload)
    const res = NextResponse.json({ user: { id: row.id, email: row.email } })
    res.cookies.set(getSessionCookieName(), cookieValue, {
      ...getSessionCookieOptions(),
      maxAge: getSessionCookieOptions().maxAge,
    })
    return res
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
