import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-server"
import { hashPassword } from "@/lib/auth/password"
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
    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Email y contraseña requeridos (mín. 6 caracteres)" },
        { status: 400 }
      )
    }
    const supabase = createAdminClient()
    const password_hash = hashPassword(password)
    const { data: row, error } = await supabase
      .from("app_users")
      .insert({ email, password_hash })
      .select("id, email")
      .single()
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 })
      }
      const message =
        process.env.NODE_ENV === "development" ? error.message : "Error al crear la cuenta"
      return NextResponse.json({ error: message }, { status: 500 })
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
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error ? err.message : "Error interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
