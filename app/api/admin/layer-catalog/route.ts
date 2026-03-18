import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/require-session"
import { getCatalogTreeFromDb } from "@/lib/catalog-db"

/** GET: árbol completo del catálogo (groups → sublayers → subSublayers) con IDs para admin. */
export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (auth instanceof NextResponse) return auth
  const tree = await getCatalogTreeFromDb()
  return NextResponse.json(tree)
}
