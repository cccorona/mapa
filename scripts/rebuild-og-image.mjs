/**
 * Rebuild public/og.jpg as a clean JPEG (no Exif) at 1200x630 for OG/Twitter.
 * Run: node scripts/rebuild-og-image.mjs
 */
import sharp from "sharp"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const input = path.join(ROOT, "public", "og.jpg")
const output = path.join(ROOT, "public", "og.jpg")

async function main() {
  await sharp(input)
    .resize(1200, 630, { fit: "cover", position: "center" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(output)
  console.log("Written:", output)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
