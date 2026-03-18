import { NextResponse } from "next/server"
import { getLayerCatalog } from "@/lib/layer-catalog"
import { getCatalogFromDb } from "@/lib/catalog-db"

/** GET: catálogo de capas (versionado). Lee de BD si existe; si no, fallback a estático. */
export async function GET() {
  const catalog = (await getCatalogFromDb()) ?? getLayerCatalog()
  return NextResponse.json(catalog)
}
