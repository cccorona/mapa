/**
 * Valida color hex/rgb. Lanza si es inválido (sin fallbacks).
 */
const HEX6 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
const HEX3 = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
const RGB = /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i

export function validateColor(hex: string): void {
  if (hex == null || typeof hex !== "string" || !hex.trim()) {
    throw new Error("Color requerido (use #RRGGBB, #RGB o rgb(r,g,b))")
  }
  const s = hex.trim()
  if (HEX6.test(s) || HEX3.test(s) || RGB.test(s)) return
  throw new Error(`Color inválido: "${hex}" (use #RRGGBB, #RGB o rgb(r,g,b))`)
}
