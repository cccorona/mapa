import { NextResponse, type NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/auth/session"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin")) {
    const session = await getSessionFromRequest(request.headers.get("cookie") ?? null)
    if (!session) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
