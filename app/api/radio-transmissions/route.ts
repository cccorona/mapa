import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import type { RadioTransmissionsFile } from "@/lib/radio-types"

/** GET: transmisiones FM sin mapa (frecuencias fantasma). Lee JSON estático. */
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "data", "radio-transmissions.json")
  const raw = await readFile(filePath, "utf8")
  const data = JSON.parse(raw) as RadioTransmissionsFile
  return NextResponse.json(data)
}
