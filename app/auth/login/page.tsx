"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") ?? "/"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      router.push(redirect)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm px-6">
        <div
          className="border border-[var(--panel-border)] rounded-lg p-6"
          style={{ background: "var(--panel-bg)" }}
        >
          <h1 className="font-serif text-lg font-medium text-[var(--parchment)] mb-1">
            Iniciar sesión
          </h1>
          <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--parchment-dim)] mb-6">
            Mapa de Observaciones
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="font-mono text-sm text-[var(--destructive)]" role="alert">
                {error}
              </p>
            )}
            <div>
              <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-3 py-2 text-[var(--parchment)] font-mono text-sm focus:outline-none focus:border-[var(--sepia)]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 border border-[var(--sepia)] text-[var(--parchment)] font-mono text-sm tracking-wide hover:bg-[var(--sepia)]/10 disabled:opacity-50 rounded-sm transition-colors"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-4 font-mono text-[10px] text-[var(--parchment-dim)]">
            ¿No tienes cuenta?{" "}
            <Link href="/auth/register" className="text-[var(--primary)] hover:underline">
              Registrarse
            </Link>
          </p>
        </div>

        <Link
          href="/"
          className="mt-6 block text-center font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
        >
          Volver al mapa
        </Link>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <span className="font-mono text-xs text-[var(--parchment-dim)]">Cargando…</span>
      </main>
    }>
      <LoginForm />
    </Suspense>
  )
}
