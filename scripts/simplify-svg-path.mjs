/**
 * Simplifica el primer <path> de un SVG (contorno potrace) con Douglas-Peucker
 * para dejar ~50-120 puntos y que el polygon mask no bloquee.
 *
 * Uso: node scripts/simplify-svg-path.mjs <entrada.svg> [salida.svg]
 * Si no se pasa salida, imprime por stdout.
 */
import fs from "fs"

const inputPath = process.argv[2]
const outputPath = process.argv[3]

if (!inputPath) {
  console.error("Uso: node scripts/simplify-svg-path.mjs <entrada.svg> [salida.svg]")
  process.exit(1)
}

const svg = fs.readFileSync(inputPath, "utf8")

// Extraer el primer path d="..."
const match = svg.match(/<path\s+d="([^"]+)"/)
if (!match) {
  console.error("No se encontró ningún <path d=\"...\"> en el SVG")
  process.exit(1)
}

const d = match[1]

/** Tokeniza path d: comandos y números (incl. negativos pegados tipo "10-3" -> 10, -3). */
function tokenizePathD(dStr) {
  const s = dStr
    .replace(/([MLHVCSQTAZmlhvcsqtaz])/g, " $1 ")
    .replace(/([0-9.])(\-)/g, "$1 $2")
    .trim()
  return s.split(/[\s,]+/).filter(Boolean)
}

/** Convierte path d a lista de puntos absolutos [x,y]. Solo M,L,C,c,l,m,z. */
function pathToPoints(dStr) {
  const points = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  const tokens = tokenizePathD(dStr)
  let i = 0
  while (i < tokens.length) {
    const cmd = tokens[i]
    if (!cmd) {
      i++
      continue
    }
    const c = cmd.charAt(0)
    if (c === "M") {
      x = parseFloat(tokens[++i])
      y = parseFloat(tokens[++i])
      startX = x
      startY = y
      points.push([x, y])
      i++
      continue
    }
    if (c === "m") {
      x += parseFloat(tokens[++i])
      y += parseFloat(tokens[++i])
      startX = x
      startY = y
      points.push([x, y])
      i++
      continue
    }
    if (c === "L") {
      x = parseFloat(tokens[++i])
      y = parseFloat(tokens[++i])
      points.push([x, y])
      i++
      continue
    }
    if (c === "l") {
      x += parseFloat(tokens[++i])
      y += parseFloat(tokens[++i])
      points.push([x, y])
      i++
      continue
    }
    if (c === "C") {
      const x1 = parseFloat(tokens[i + 1])
      const y1 = parseFloat(tokens[i + 2])
      const x2 = parseFloat(tokens[i + 3])
      const y2 = parseFloat(tokens[i + 4])
      x = parseFloat(tokens[i + 5])
      y = parseFloat(tokens[i + 6])
      // Sample bezier at t=0.5 to get one point
      points.push([x, y])
      i += 7
      continue
    }
    if (c === "c") {
      const dx1 = parseFloat(tokens[i + 1])
      const dy1 = parseFloat(tokens[i + 2])
      const dx2 = parseFloat(tokens[i + 3])
      const dy2 = parseFloat(tokens[i + 4])
      const dx = parseFloat(tokens[i + 5])
      const dy = parseFloat(tokens[i + 6])
      x += dx
      y += dy
      points.push([x, y])
      i += 7
      continue
    }
    if (c === "z" || c === "Z") {
      x = startX
      y = startY
      i++
      continue
    }
    i++
  }
  return points
}

/** Douglas-Peucker: reduce polyline manteniendo forma. */
function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points
  let dMax = 0
  let index = 0
  const end = points.length - 1
  const [x0, y0] = points[0]
  const [x1, y1] = points[end]
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  for (let i = 1; i < end; i++) {
    const [px, py] = points[i]
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (len * len)))
    const projX = x0 + t * dx
    const projY = y0 + t * dy
    const d = Math.hypot(px - projX, py - projY)
    if (d > dMax) {
      dMax = d
      index = i
    }
  }
  if (dMax <= tolerance) return [points[0], points[end]]
  const left = douglasPeucker(points.slice(0, index + 1), tolerance)
  const right = douglasPeucker(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

/** Puntos a path d con M y L. */
function pointsToPath(points) {
  if (points.length < 2) return ""
  const [first, ...rest] = points
  let d = `M ${first[0]} ${first[1]}`
  for (const [x, y] of rest) {
    d += ` L ${x} ${y}`
  }
  return d + " Z"
}

const points = pathToPoints(d)
console.error(`Puntos originales: ${points.length}`)

// Tolerancia alta = más simplificación. Ajustar según viewBox (coord ~0-10240)
const tolerance = 80
const simplified = douglasPeucker(points, tolerance)
console.error(`Puntos después de Douglas-Peucker (tolerancia ${tolerance}): ${simplified.length}`)

const newD = pointsToPath(simplified)

// Reemplazar el primer path por el simplificado y eliminar el resto de paths
const newPath = `<path d="${newD}"/>`
const pathRegex = /<path\s+d="[^"]+"[^>]*\/>/g
let first = true
const final = svg.replace(pathRegex, (match) => {
  if (first) {
    first = false
    return newPath
  }
  return ""
})

if (outputPath) {
  fs.writeFileSync(outputPath, final, "utf8")
  console.error(`Escrito: ${outputPath}`)
} else {
  console.log(final)
}
