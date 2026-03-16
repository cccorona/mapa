#!/usr/bin/env node
/**
 * Converts official STC Metro KMZ files to GeoJSON for the map.
 * Run: node scripts/kmz-to-geojson.mjs
 *
 * Requires KMZ files at:
 *   - /Users/ccoronacesar/Downloads/stcmetro_kmz/STC_Metro_lineas.kmz
 *   - /Users/ccoronacesar/Downloads/stcmetro_kmz/STC_Metro_estaciones.kmz
 */

import fs from "fs"
import path from "path"
import { kml } from "@tmcw/togeojson"
import { DOMParser } from "@xmldom/xmldom"

const DOWNLOADS = "/Users/ccoronacesar/Downloads/stcmetro_kmz"
const OUTPUT_DIR = path.join(process.cwd(), "public")

const LINE_COLORS = {
  1: "#e91e8c",
  2: "#006fb4",
  3: "#c89f2d",
  4: "#00aed9",
  5: "#ffd600",
  6: "#e72f34",
  7: "#f7941d",
  8: "#00a34e",
  9: "#8b4513",
  12: "#c5a028",
  A: "#803088",
  B: "#7cb342",
}

function roundCoord(c) {
  return Math.round(Number(c) * 100000) / 100000
}

function roundCoordsInGeometry(geom) {
  if (!geom?.coordinates) return geom
  if (geom.type === "Point") {
    geom.coordinates = [roundCoord(geom.coordinates[0]), roundCoord(geom.coordinates[1])]
  } else if (geom.type === "LineString") {
    geom.coordinates = geom.coordinates.map((c) =>
      c.length >= 3 ? [roundCoord(c[0]), roundCoord(c[1]), c[2]] : [roundCoord(c[0]), roundCoord(c[1])]
    )
  } else if (geom.type === "Polygon") {
    geom.coordinates = geom.coordinates.map((ring) =>
      ring.map((c) => (c.length >= 3 ? [roundCoord(c[0]), roundCoord(c[1]), c[2]] : [roundCoord(c[0]), roundCoord(c[1])]))
    )
  }
  return geom
}

function getDescriptionHtml(desc) {
  if (typeof desc === "string") return desc
  if (desc && typeof desc.value === "string") return desc.value
  return ""
}

function extractLineFromDescription(desc) {
  const html = getDescriptionHtml(desc)
  const match = html.match(/<td>LINEA<\/td>\s*<td>([^<]+)<\/td>/)
  return match ? match[1].trim() : null
}

function extractRutaFromDescription(desc) {
  const html = getDescriptionHtml(desc)
  const match = html.match(/<td>RUTA<\/td>\s*<td>([^<]+)<\/td>/)
  return match ? match[1].trim() : null
}

function extractNombreFromDescription(desc) {
  const html = getDescriptionHtml(desc)
  const match = html.match(/<td>NOMBRE<\/td>\s*<td>([^<]+)<\/td>/)
  return match ? match[1].trim() : null
}

async function unzipKmz(kmzPath) {
  const AdmZip = (await import("adm-zip")).default
  const zip = new AdmZip(kmzPath)
  const entries = zip.getEntries()
  const doc = entries.find((e) => e.entryName.endsWith(".kml") || e.entryName === "doc.kml")
  if (!doc) throw new Error(`No KML found in ${kmzPath}`)
  return zip.readAsText(doc)
}

async function convertLines() {
  const kmzPath = path.join(DOWNLOADS, "STC_Metro_lineas.kmz")
  if (!fs.existsSync(kmzPath)) {
    throw new Error(`KMZ not found: ${kmzPath}`)
  }

  const kmlText = await unzipKmz(kmzPath)
  const dom = new DOMParser().parseFromString(kmlText, "text/xml")
  const geojson = kml(dom)

  if (!geojson.features) {
    throw new Error("No features in lines GeoJSON")
  }

  const features = geojson.features.map((f) => {
    const line = extractLineFromDescription(f.properties?.description ?? "")
    const ruta = extractRutaFromDescription(f.properties?.description ?? "")
    const color = LINE_COLORS[line] ?? "#666666"
    const geom = JSON.parse(JSON.stringify(f.geometry))
    roundCoordsInGeometry(geom)
    return {
      type: "Feature",
      geometry: geom,
      properties: {
        line: String(line || "?"),
        color,
        name: ruta ? `Línea ${line}: ${ruta}` : `Línea ${line}`,
      },
    }
  })

  const out = {
    type: "FeatureCollection",
    name: "cdmx-metro-lines",
    attribution: "STC Metro CDMX - Datos oficiales (datos.cdmx.gob.mx)",
    features,
  }

  const outPath = path.join(OUTPUT_DIR, "cdmx-metro-lines.geojson")
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8")
  console.log(`Written ${features.length} line features to ${outPath}`)
}

async function convertStations() {
  const kmzPath = path.join(DOWNLOADS, "STC_Metro_estaciones.kmz")
  if (!fs.existsSync(kmzPath)) {
    throw new Error(`KMZ not found: ${kmzPath}`)
  }

  const kmlText = await unzipKmz(kmzPath)
  const dom = new DOMParser().parseFromString(kmlText, "text/xml")
  const geojson = kml(dom)

  if (!geojson.features) {
    throw new Error("No features in stations GeoJSON")
  }

  const features = geojson.features.map((f, i) => {
    const nombre = extractNombreFromDescription(f.properties?.description ?? "")
    const lineRaw = extractLineFromDescription(f.properties?.description ?? "")
    const line = String(lineRaw || "?").replace(/^0+/, "") || lineRaw
    const geom = JSON.parse(JSON.stringify(f.geometry))
    roundCoordsInGeometry(geom)
    return {
      type: "Feature",
      geometry: geom,
      properties: {
        name: nombre || f.properties?.name || "?",
        line,
        id: f.id || `st-${i}`,
      },
    }
  })

  const out = {
    type: "FeatureCollection",
    name: "cdmx-metro-stations",
    attribution: "STC Metro CDMX - Datos oficiales (datos.cdmx.gob.mx)",
    features,
  }

  const outPath = path.join(OUTPUT_DIR, "cdmx-metro-stations.geojson")
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8")
  console.log(`Written ${features.length} station features to ${outPath}`)
}

async function main() {
  await convertLines()
  await convertStations()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
