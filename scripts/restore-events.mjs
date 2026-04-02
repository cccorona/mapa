/**
 * Restaura filas en `events` desde un JSON generado por `scripts/backup-events.mjs`.
 *
 * Uso (recomendado):
 *   npm run scripts:restore-events -- --file backup/events-YYYYMMDD-HHMMSS.json
 *
 * Antes de un reemplazo total: haz un backup nuevo del estado actual.
 * Por defecto se anulan FKs opcionales (`created_by`, `location_container_id`) si no existen
 * usuarios/contenedores en esta BD; usa --preserve-created-by / --preserve-container-ids solo
 * si esas filas ya existen con los mismos UUIDs.
 *
 * Opciones destructivas: --delete-all-first requiere --confirm (borra TODAS las filas de events).
 *
 * Carga de .env: el script importa `dotenv` y lee `.env.local` desde la raíz del repo.
 * No uses el ejecutable global `dotenv` de Ruby; usa `npm run scripts:restore-events` o
 * `npx dotenv-cli -e .env.local -- node scripts/restore-events.mjs`.
 */
import { createClient } from "@supabase/supabase-js"
import { config as loadEnv } from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
loadEnv({ path: path.join(ROOT, ".env.local") })

const ALL_ROWS =
  "id.eq.00000000-0000-0000-0000-000000000000,id.neq.00000000-0000-0000-0000-000000000000"

/** Columnas insertables en `events` (coinciden con select * del backup). */
const EVENT_COLUMN_KEYS = [
  "id",
  "event_type",
  "location",
  "occurred_at",
  "description",
  "title",
  "location_label",
  "emotional_intensity",
  "is_anonymous",
  "status",
  "created_at",
  "updated_at",
  "created_by",
  "group",
  "layer",
  "sublayer",
  "sublayer_detail",
  "location_container_id",
]

const EVENT_TYPES = new Set([
  "DEATH",
  "JOB_RESIGNATION",
  "JOB_TERMINATION",
  "RELATIONSHIP_END",
  "MAJOR_DECISION",
  "NEW_BEGINNING",
  "RELOCATION",
  "ACCIDENT",
  "HEALTH_DIAGNOSIS",
  "LEGAL_EVENT",
])

const INTENSITY = new Set(["1", "2", "3", "4", "5"])

const STATUS = new Set(["pending", "approved", "rejected"])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El backup puede traer `location` como hex EWKB o GeoJSON.
 * PostgREST/Supabase documentan insert en columnas geography con GeoJSON `{ type, coordinates }`.
 * Si falla, prueba `--location-format ewkt`.
 */
function ewkbHexToPointGeoJSON(hex) {
  const s = String(hex).trim()
  if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2 !== 0) {
    throw new Error("location hex EWKB inválida (no es hexadecimal par)")
  }
  const b = Buffer.from(s, "hex")
  if (b.length < 25) {
    throw new Error("EWKB demasiado corta para Point con SRID 4326")
  }
  if (b.readUInt8(0) !== 1) {
    throw new Error("EWKB: solo endian little-endian (NDR) soportado")
  }
  const typeAndFlags = b.readUInt32LE(1)
  const geomType = typeAndFlags & 0xffff
  if (geomType !== 1) {
    throw new Error(`EWKB: solo Point soportado (tipo geometría ${geomType})`)
  }
  const hasSrid = (typeAndFlags & 0x20000000) !== 0
  let o = 5
  if (hasSrid) {
    const srid = b.readUInt32LE(o)
    o += 4
    if (srid !== 4326) {
      throw new Error(`EWKB: SRID ${srid} no soportada (se espera 4326)`)
    }
  } else {
    o = 5
  }
  const x = b.readDoubleLE(o)
  o += 8
  const y = b.readDoubleLE(o)
  return { type: "Point", coordinates: [x, y] }
}

/**
 * @param {unknown} loc
 * @returns {{ type: "Point"; coordinates: [number, number] }}
 */
function locationToPointGeoJSON(loc) {
  if (loc != null && typeof loc === "object" && !Array.isArray(loc)) {
    const o = /** @type {{ type?: string; coordinates?: unknown }} */ (loc)
    if (o.type === "Point" && Array.isArray(o.coordinates) && o.coordinates.length >= 2) {
      const lng = Number(o.coordinates[0])
      const lat = Number(o.coordinates[1])
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { type: "Point", coordinates: [lng, lat] }
      }
    }
    throw new Error("location GeoJSON: se espera Point con coordinates [lng, lat]")
  }
  if (typeof loc === "string") {
    return ewkbHexToPointGeoJSON(loc)
  }
  throw new Error("location ausente o formato no soportado (GeoJSON Point o hex EWKB)")
}

function roundCoord(n) {
  return Math.round(Number(n) * 1e8) / 1e8
}

/**
 * GeoJSON RFC 7946 Point para columna geography (preferido por la API de Supabase).
 * @param {unknown} loc
 * @returns {{ type: "Point"; coordinates: [number, number] }}
 */
function locationToGeoJSONPointForInsert(loc) {
  const g = locationToPointGeoJSON(loc)
  const [lng, lat] = g.coordinates
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error("coordenadas lng/lat no finitas")
  }
  return { type: "Point", coordinates: [roundCoord(lng), roundCoord(lat)] }
}

/**
 * @param {unknown} loc
 * @returns {string}
 */
function locationToEwkt4326PointInput(loc) {
  const g = locationToPointGeoJSON(loc)
  const [lng, lat] = g.coordinates
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error("coordenadas lng/lat no finitas")
  }
  return `SRID=4326;POINT(${roundCoord(lng)} ${roundCoord(lat)})`
}

/**
 * @param {unknown} loc
 * @param {"geojson" | "ewkt"} format
 */
function locationForInsert(loc, format) {
  return format === "ewkt" ? locationToEwkt4326PointInput(loc) : locationToGeoJSONPointForInsert(loc)
}

function usage() {
  console.error(`Uso:
  npm run scripts:restore-events -- --file backup/events-....json
  npx dotenv-cli -e .env.local -- node scripts/restore-events.mjs --file <ruta-al-json>

Opciones:
  --file <path>           JSON con { events: [...] } (obligatorio)
  --location-format       geojson (default) | ewkt — formato de location para PostgREST
  --dry-run               Valida filas y cuenta; no escribe en la BD
  --upsert                ON CONFLICT (id) UPDATE (mezcla con filas existentes)
  --insert-only           Solo INSERT (por defecto); falla si hay id duplicado
  --delete-all-first      Borra todas las filas de events antes de insertar (requiere --confirm)
  --confirm               Confirma --delete-all-first
  --preserve-created-by   No poner created_by a null (requiere usuarios en auth.users)
  --preserve-container-ids  No poner location_container_id a null (requiere location_containers)
  --batch-size <n>        Tamaño de lote (default 200)

Por defecto se fuerza created_by y location_container_id a null para evitar errores de FK.
`)
}

function parseArgs(argv) {
  const out = {
    file: null,
    dryRun: false,
    upsert: false,
    insertOnly: true,
    deleteAllFirst: false,
    confirm: false,
    preserveCreatedBy: false,
    preserveContainerIds: false,
    batchSize: 200,
    locationFormat: /** @type {"geojson" | "ewkt"} */ ("geojson"),
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--file") {
      out.file = argv[++i]
      if (!out.file) {
        console.error("Falta valor para --file")
        process.exit(1)
      }
    } else if (a === "--dry-run") out.dryRun = true
    else if (a === "--upsert") {
      out.upsert = true
      out.insertOnly = false
    } else if (a === "--insert-only") {
      out.insertOnly = true
      out.upsert = false
    } else if (a === "--delete-all-first") out.deleteAllFirst = true
    else if (a === "--confirm") out.confirm = true
    else if (a === "--preserve-created-by") out.preserveCreatedBy = true
    else if (a === "--preserve-container-ids") out.preserveContainerIds = true
    else if (a === "--batch-size") {
      const n = parseInt(argv[++i] ?? "", 10)
      if (!Number.isFinite(n) || n < 1 || n > 1000) {
        console.error("--batch-size debe ser un entero entre 1 y 1000")
        process.exit(1)
      }
      out.batchSize = n
    } else if (a === "--location-format") {
      const v = (argv[++i] ?? "").toLowerCase()
      if (v !== "geojson" && v !== "ewkt") {
        console.error("--location-format debe ser geojson o ewkt")
        process.exit(1)
      }
      out.locationFormat = v
    } else if (a === "--help" || a === "-h") {
      usage()
      process.exit(0)
    } else {
      console.error("Argumento desconocido:", a)
      usage()
      process.exit(1)
    }
  }
  return out
}

/** @param {import("@supabase/supabase-js").PostgrestError | { message?: string; details?: string; hint?: string; code?: string }} err */
function logPostgrestError(err) {
  if (err && typeof err === "object") {
    if ("details" in err && err.details) console.error("  details:", err.details)
    if ("hint" in err && err.hint) console.error("  hint:", err.hint)
    if ("code" in err && err.code) console.error("  code:", err.code)
  }
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ preserveCreatedBy: boolean; preserveContainerIds: boolean }} opts
 */
function normalizeRow(raw, opts) {
  /** @type {Record<string, unknown>} */
  const row = {}
  for (const key of EVENT_COLUMN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      row[key] = raw[key]
    }
  }
  if (!opts.preserveCreatedBy) {
    row.created_by = null
  }
  if (!opts.preserveContainerIds) {
    row.location_container_id = null
  }
  return row
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} index
 */
function validateRow(row, index) {
  const prefix = `events[${index}]`
  if (typeof row.id !== "string" || !UUID_RE.test(row.id)) {
    throw new Error(`${prefix}: id debe ser un UUID válido`)
  }
  if (typeof row.event_type !== "string" || !EVENT_TYPES.has(row.event_type)) {
    throw new Error(`${prefix}: event_type inválido o ausente: ${row.event_type}`)
  }
  if (row.location == null) {
    throw new Error(`${prefix}: location es obligatoria`)
  }
  const loc = row.location
  const okGeoJson =
    typeof loc === "object" &&
    loc !== null &&
    !Array.isArray(loc) &&
    /** @type {{ type?: string; coordinates?: unknown }} */ (loc).type === "Point" &&
    Array.isArray(/** @type {{ coordinates?: unknown }} */ (loc).coordinates) &&
    /** @type {{ coordinates: unknown[] }} */ (loc).coordinates.length >= 2
  const okEwkt = typeof loc === "string" && loc.startsWith("SRID=4326;POINT(")
  if (!okGeoJson && !okEwkt) {
    throw new Error(`${prefix}: location debe ser GeoJSON Point o EWKT SRID=4326;POINT(...)`)
  }
  if (typeof row.occurred_at !== "string") {
    throw new Error(`${prefix}: occurred_at es obligatorio`)
  }
  if (typeof row.description !== "string" || row.description.length === 0) {
    throw new Error(`${prefix}: description es obligatoria`)
  }
  if (typeof row.emotional_intensity !== "string" || !INTENSITY.has(row.emotional_intensity)) {
    throw new Error(`${prefix}: emotional_intensity debe ser 1–5 (string)`)
  }
  if (row.status != null && typeof row.status === "string" && !STATUS.has(row.status)) {
    throw new Error(`${prefix}: status inválido: ${row.status}`)
  }
  if (row.created_by != null && (typeof row.created_by !== "string" || !UUID_RE.test(row.created_by))) {
    throw new Error(`${prefix}: created_by debe ser UUID o null`)
  }
  if (
    row.location_container_id != null &&
    (typeof row.location_container_id !== "string" || !UUID_RE.test(row.location_container_id))
  ) {
    throw new Error(`${prefix}: location_container_id debe ser UUID o null`)
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.file) {
    console.error("Falta --file <ruta-al-json>")
    usage()
    process.exit(1)
  }
  if (args.deleteAllFirst && !args.confirm) {
    console.error("--delete-all-first requiere --confirm (borra todas las filas de events).")
    process.exit(1)
  }

  const absFile = path.isAbsolute(args.file) ? args.file : path.resolve(process.cwd(), args.file)
  if (!fs.existsSync(absFile)) {
    console.error("No existe el archivo:", absFile)
    process.exit(1)
  }

  let payload
  try {
    payload = JSON.parse(fs.readFileSync(absFile, "utf8"))
  } catch (e) {
    console.error("JSON inválido:", e instanceof Error ? e.message : e)
    process.exit(1)
  }

  const events = payload?.events
  if (!Array.isArray(events)) {
    console.error("El JSON debe tener un array `events`.")
    process.exit(1)
  }

  const opts = {
    preserveCreatedBy: args.preserveCreatedBy,
    preserveContainerIds: args.preserveContainerIds,
  }

  const normalized = []
  for (let i = 0; i < events.length; i++) {
    const raw = events[i]
    if (raw == null || typeof raw !== "object") {
      throw new Error(`events[${i}]: debe ser un objeto`)
    }
    const row = /** @type {Record<string, unknown>} */ ({ ...raw })
    try {
      row.location = locationForInsert(row.location, args.locationFormat)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`events[${i}]: ${msg}`)
    }
    validateRow(row, i)
    normalized.push(normalizeRow(row, opts))
  }

  console.log(`Archivo: ${absFile}`)
  console.log(`Eventos: ${normalized.length}`)
  console.log(`location: formato ${args.locationFormat}`)
  console.log(
    `FK: created_by=${opts.preserveCreatedBy ? "preservado del JSON" : "null"}, location_container_id=${opts.preserveContainerIds ? "preservado del JSON" : "null"}`
  )
  console.log(`Modo: ${args.upsert ? "UPSERT" : "INSERT"}`)
  if (args.dryRun) {
    console.log("Dry-run: no se modifica la base de datos.")
    process.exit(0)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local (usa npm run scripts:restore-events o npx dotenv-cli; no la gema Ruby `dotenv`)."
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey)

  if (args.deleteAllFirst) {
    const { error: delErr } = await supabase.from("events").delete().or(ALL_ROWS)
    if (delErr) {
      console.error("Error borrando events:", delErr.message)
      process.exit(1)
    }
    console.log("Tabla events vaciada.")
  }

  const batchSize = args.batchSize
  for (let offset = 0; offset < normalized.length; offset += batchSize) {
    const batch = normalized.slice(offset, offset + batchSize)
    if (args.upsert) {
      const { error } = await supabase.from("events").upsert(batch, {
        onConflict: "id",
        ignoreDuplicates: false,
      })
      if (error) {
        console.error(`Error en upsert (lote ${offset}-${offset + batch.length - 1}):`, error.message)
        logPostgrestError(error)
        process.exit(1)
      }
    } else {
      const { error } = await supabase.from("events").insert(batch)
      if (error) {
        console.error(`Error en insert (lote ${offset}-${offset + batch.length - 1}):`, error.message)
        logPostgrestError(error)
        if (String(error.message).includes("geometry") || String(error.message).includes("parse")) {
          console.error(
            "Si el error es de geometría, reintenta con: --location-format ewkt (o al revés: geojson)."
          )
        }
        if (error.message.includes("duplicate") || error.code === "23505") {
          console.error("Sugerencia: usa --upsert o --delete-all-first --confirm tras un backup.")
        }
        process.exit(1)
      }
    }
    console.log(`  Insertados ${Math.min(offset + batch.length, normalized.length)} / ${normalized.length}`)
  }

  console.log("Restore completado.")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
