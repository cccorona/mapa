/**
 * Depuración de la data: eventos, catálogo de capas, layer_geodata.
 * Uso: npm run scripts:debug-data
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
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usa: dotenv -e .env.local -- node scripts/debug-data.mjs)")
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

async function debug() {
  const lines = []
  const out = (s) => {
    lines.push(s)
    console.log(s)
  }

  out("=== DEBUG DATA ===\n")

  const { count: eventsCount, error: eventsCountErr } = await supabase.from("events").select("id", { count: "exact", head: true })
  if (eventsCountErr) out(`events count error: ${eventsCountErr.message}`)
  else out(`events: total = ${eventsCount ?? 0}`)

  const { data: eventsSample, error: eventsErr } = await supabase
    .from("events")
    .select("id, status, occurred_at, group, layer, sublayer, sublayer_detail, location_label")
    .limit(5)
  if (eventsErr) out(`events sample error: ${eventsErr.message}`)
  else if (eventsSample?.length) {
    out("events sample (5):")
    eventsSample.forEach((r) => out(`  ${JSON.stringify(r)}`))
  }
  out("")

  const { data: groups, error: groupsErr } = await supabase.from("layer_groups").select("id, code, name").order("code")
  if (groupsErr) out(`layer_groups error: ${groupsErr.message}`)
  else {
    out(`layer_groups: ${groups?.length ?? 0}`)
    ;(groups ?? []).forEach((g) => out(`  ${g.code} (${g.name}) id=${g.id}`))
  }
  out("")

  const { data: sublayers, error: subErr } = await supabase.from("layer_sublayers").select("id, group_id, code, name").order("code")
  if (subErr) out(`layer_sublayers error: ${subErr.message}`)
  else {
    out(`layer_sublayers: ${sublayers?.length ?? 0}`)
    ;(sublayers ?? []).slice(0, 15).forEach((s) => out(`  ${s.code} (${s.name}) group_id=${s.group_id}`))
    if ((sublayers ?? []).length > 15) out(`  ... y más`)
  }
  out("")

  const { data: subSublayers, error: subSubErr } = await supabase.from("layer_sub_sublayers").select("id, sublayer_id, code, name").order("code")
  if (subSubErr) out(`layer_sub_sublayers error: ${subSubErr.message}`)
  else {
    out(`layer_sub_sublayers: ${subSublayers?.length ?? 0}`)
    ;(subSublayers ?? []).slice(0, 10).forEach((s) => out(`  ${s.code} (${s.name})`))
    if ((subSublayers ?? []).length > 10) out(`  ... y más`)
  }
  out("")

  const { count: geodataCount, error: geodataCountErr } = await supabase.from("layer_geodata").select("id", { count: "exact", head: true })
  if (geodataCountErr) out(`layer_geodata count error: ${geodataCountErr.message}`)
  else out(`layer_geodata: total = ${geodataCount ?? 0}`)

  const { data: geodataSample, error: geodataErr } = await supabase
    .from("layer_geodata")
    .select("id, name, type, group_id, sublayer_id, sub_sublayer_id")
    .limit(10)
  if (geodataErr) out(`layer_geodata sample error: ${geodataErr.message}`)
  else if (geodataSample?.length) {
    out("layer_geodata sample:")
    geodataSample.forEach((r) => out(`  ${r.name} (${r.type}) group=${r.group_id}`))
  }

  out("\n=== FIN DEBUG ===")

  const outDir = path.join(ROOT, "backup")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "").replace("T", "-")
  const outPath = path.join(outDir, `debug-data-${stamp}.txt`)
  fs.writeFileSync(outPath, lines.join("\n"), "utf8")
  console.log(`\nReporte escrito en ${outPath}`)
}

debug().catch((err) => {
  console.error(err)
  process.exit(1)
})
