/**
 * Creates placeholder PNGs for landmarks (56px and 112px).
 * Replace these with real illustrations later.
 */
import sharp from "sharp"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, "..", "public", "landmarks")

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const LANDMARKS = [
  { id: "bellas_artes", label: "BA" },
  { id: "torre_latino", label: "TL" },
]

async function createPlaceholder(id, label, size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="rgba(139,115,85,0.2)" stroke="rgba(139,115,85,0.6)" stroke-width="2"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${size * 0.3}" fill="rgba(139,115,85,0.9)">${label}</text>
    </svg>
  `
  const buf = Buffer.from(svg)
  await sharp(buf).png().toFile(path.join(OUT, `${id}${size === 112 ? "@2x" : ""}.png`))
}

async function build() {
  for (const { id, label } of LANDMARKS) {
    await createPlaceholder(id, label, 56)
    await createPlaceholder(id, label, 112)
    console.log(`  ${id}.png, ${id}@2x.png`)
  }
  console.log("Done. Output: public/landmarks/")
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
