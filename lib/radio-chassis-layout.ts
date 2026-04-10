import type { CSSProperties } from "react"

/**
 * Rectángulos normalizados (0–1) respecto al bounding box de la carcasa Jasqueña.
 * Calibrados sobre `public/images/radio/chassis.png` (1024×682 px → aspect ≈ 1.502).
 * Ajustar aquí si cambia el asset.
 */
export const CHASSIS_PIXEL_WIDTH = 1024
export const CHASSIS_PIXEL_HEIGHT = 682
export const CHASSIS_ASPECT = CHASSIS_PIXEL_WIDTH / CHASSIS_PIXEL_HEIGHT

export interface NormalizedRect {
  left: number
  top: number
  width: number
  height: number
}

/** Humo / estática en ventana izquierda. */
export const signalSlot: NormalizedRect = {
  left: 0.065,
  top: 0.095,
  width: 0.285,
  height: 0.255,
}

/** Lectura numérica MHz en ventana derecha. */
export const displaySlot: NormalizedRect = {
  left: 0.65,
  top: 0.095,
  width: 0.285,
  height: 0.255,
}

/**
 * Zona de arrastre horizontal sobre el dial impreso (FM).
 * La perilla imagen se posiciona sobre la línea media de esta franja.
 */
export const dialHitStrip: NormalizedRect = {
  left: 0.09,
  top: 0.545,
  width: 0.82,
  height: 0.14,
}

/** Centro de rotación de la perilla relativo al strip (0–1): eje bajo el arco. */
export const dialKnobPivotInStrip = { x: 0.5, y: 0.72 }

/**
 * Rotación de la perilla (grados): FM min → max.
 * Ajustar si el arte del dial no coincide con ±60°.
 */
export const KNOB_ROTATION_MIN_DEG = -58
export const KNOB_ROTATION_MAX_DEG = 58

export function rectToPercentStyle(r: NormalizedRect): CSSProperties {
  return {
    position: "absolute",
    left: `${r.left * 100}%`,
    top: `${r.top * 100}%`,
    width: `${r.width * 100}%`,
    height: `${r.height * 100}%`,
  }
}
