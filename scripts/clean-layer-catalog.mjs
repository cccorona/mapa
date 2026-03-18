/**
 * Limpia TODO: catálogo, geodata, landmarks y events.
 * Ejecutar ANTES: npm run scripts:backup-events (respaldar eventos).
 * Uso: CONFIRM_CLEAN_ALL=1 npm run scripts:clean-layer-catalog
 */
import { createClient } from "@supabase/supabase-js"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const confirm = process.env.CONFIRM_CLEAN_ALL === "1"

if (!url || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usa: dotenv -e .env.local -- node scripts/clean-layer-catalog.mjs)")
  process.exit(1)
}

if (!confirm) {
  console.error("Para borrar TODO (incl. events y landmarks) ejecuta: CONFIRM_CLEAN_ALL=1 npm run scripts:clean-layer-catalog")
  console.error("Antes: npm run scripts:backup-events")
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const SEED_GROUPS = [
  { code: "TRANSPORT", name: "Transporte" },
  { code: "NATURE", name: "Vegetación" },
  { code: "LANDMARKS", name: "Landmarks" },
]

const ALL_ROWS = "id.eq.00000000-0000-0000-0000-000000000000,id.neq.00000000-0000-0000-0000-000000000000"

async function run() {
  console.log("Limpiando TODO (catálogo, geodata, landmarks, events)...")

  const { error: e0a } = await supabase.from("layer_geodata").delete().or(ALL_ROWS)
  if (e0a) {
    console.error("Error borrando layer_geodata:", e0a.message)
    process.exit(1)
  }
  console.log("  layer_geodata vacío")

  const { error: e0b } = await supabase.from("layer_sub_sublayers").delete().or(ALL_ROWS)
  if (e0b) {
    console.error("Error borrando layer_sub_sublayers:", e0b.message)
    process.exit(1)
  }
  console.log("  layer_sub_sublayers vacío")

  const { error: e0c } = await supabase.from("layer_sublayers").delete().or(ALL_ROWS)
  if (e0c) {
    console.error("Error borrando layer_sublayers:", e0c.message)
    process.exit(1)
  }
  console.log("  layer_sublayers vacío")

  const { error: e0d } = await supabase.from("layer_groups").delete().or(ALL_ROWS)
  if (e0d) {
    console.error("Error borrando layer_groups:", e0d.message)
    process.exit(1)
  }
  console.log("  layer_groups vacío")

  const { error: eLand } = await supabase.from("landmarks").delete().or(ALL_ROWS)
  if (eLand) {
    console.error("Error borrando landmarks:", eLand.message)
    process.exit(1)
  }
  console.log("  landmarks vacío")

  const { error: eEv } = await supabase.from("events").delete().or(ALL_ROWS)
  if (eEv) {
    console.error("Error borrando events:", eEv.message)
    process.exit(1)
  }
  console.log("  events vacío")

  for (const row of SEED_GROUPS) {
    const { error: ins } = await supabase.from("layer_groups").insert(row)
    if (ins) {
      console.error("Error insertando grupo:", row.code, ins.message)
      process.exit(1)
    }
  }
  console.log("Seed: TRANSPORT (Transporte), NATURE (Vegetación), LANDMARKS (Landmarks)")
  console.log("Listo. Solo quedan las 3 capas en BD; el mapa no mostrará eventos ni landmarks hasta que añadas datos desde admin.")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
