import {
  FM_MHZ_MAX,
  FM_MHZ_MIN,
  FM_NEAR_DELTA_MHZ,
  FM_TUNED_DELTA_MHZ,
} from "@/lib/radio-constants"

export function clampFmMhz(mhz: number): number {
  const s = Math.round(mhz * 10) / 10
  return Math.min(FM_MHZ_MAX, Math.max(FM_MHZ_MIN, s))
}

export function isValidFmMhz(mhz: number | undefined | null): mhz is number {
  return (
    typeof mhz === "number" &&
    Number.isFinite(mhz) &&
    mhz >= FM_MHZ_MIN &&
    mhz <= FM_MHZ_MAX
  )
}

export function isTunedToMhz(tuned: number, target: number): boolean {
  return Math.abs(tuned - target) <= FM_TUNED_DELTA_MHZ
}

export function isNearMhz(tuned: number, target: number): boolean {
  return Math.abs(tuned - target) <= FM_NEAR_DELTA_MHZ
}

/** Distancia a la frecuencia “interesante” más cercana (MHz). */
export function minDistanceToSpectrumMhz(
  tuned: number,
  frequencies: number[]
): number {
  if (frequencies.length === 0) return 999
  let min = 999
  for (const f of frequencies) {
    const d = Math.abs(tuned - f)
    if (d < min) min = d
  }
  return min
}
