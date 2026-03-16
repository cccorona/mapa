/**
 * Rasterize assets/icons/*.svg to public/icons/*.png and *@2x.png for Mapbox.
 * Run: node scripts/build-icons.mjs
 */
import sharp from "sharp"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const SRC = path.join(ROOT, "assets", "icons")
const OUT = path.join(ROOT, "public", "icons")

const SYMBOLS = ["vela", "grieta", "hilo", "puerta", "documento", "germen", "cruz"]

if (!fs.existsSync(OUT)) {
  fs.mkdirSync(OUT, { recursive: true })
}

async function build() {
  for (const name of SYMBOLS) {
    const svgPath = path.join(SRC, `${name}.svg`)
    if (!fs.existsSync(svgPath)) {
      console.warn(`Skip ${name}: ${svgPath} not found`)
      continue
    }
    const buf = fs.readFileSync(svgPath)
    await sharp(buf).resize(24).png().toFile(path.join(OUT, `${name}.png`))
    await sharp(buf).resize(48).png().toFile(path.join(OUT, `${name}@2x.png`))
    console.log(`  ${name}.png, ${name}@2x.png`)
  }
  console.log("Done. Output: public/icons/")
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
