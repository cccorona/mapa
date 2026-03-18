/**
 * Respaldo de todos los eventos (tabla events) a un JSON.
 * Ejecutar antes de cualquier limpieza o migración destructiva.
 * Uso: npm run scripts:backup-events  (carga .env.local vía dotenv-cli)
 */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usa: dotenv -e .env.local -- node scripts/backup-events.mjs)")
  process.exit(1)
}

const supabase = createClient(url, serviceKey)
const PAGE_SIZE = 1000

async function backup() {
  const outDir = path.join(ROOT, "backup")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const all = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("occurred_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      console.error("Error leyendo events:", error.message)
      process.exit(1)
    }
    const rows = data ?? []
    all.push(...rows)
    hasMore = rows.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace(/[:-]/g, "").replace("T", "-")
  const outPath = path.join(outDir, `events-${stamp}.json`)
  const payload = {
    exportedAt: now.toISOString(),
    count: all.length,
    events: all,
  }
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8")
  console.log(`Respaldo: ${all.length} eventos → ${outPath}`)
}

backup().catch((err) => {
  console.error(err)
  process.exit(1)
})
