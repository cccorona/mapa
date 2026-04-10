import { FM_NEAR_DELTA_MHZ, FM_TUNED_DELTA_MHZ } from "@/lib/radio-constants"
import { minDistanceToSpectrumMhz } from "@/lib/radio-frequency"

/**
 * 0 = recepción caótica / lejos, 1 = enganchado / claro.
 * Usado por humo animado y pulso de luz (no sustituye el audio engine).
 */
export function computeSignalQuality01(tunedMhz: number, spectrumFrequenciesMhz: number[]): number {
  if (spectrumFrequenciesMhz.length === 0) return 0.12
  const d = minDistanceToSpectrumMhz(tunedMhz, spectrumFrequenciesMhz)
  if (d <= FM_TUNED_DELTA_MHZ) return 1
  if (d <= FM_NEAR_DELTA_MHZ) {
    const t = (d - FM_TUNED_DELTA_MHZ) / (FM_NEAR_DELTA_MHZ - FM_TUNED_DELTA_MHZ)
    return 0.52 + 0.48 * (1 - t)
  }
  return Math.max(0.06, 1 - Math.min(d / 3.5, 1) * 0.94)
}

export function collectSpectrumFrequencies(
  events: { frequencyMhz?: number }[],
  transmissions: { frequency: number }[]
): number[] {
  const s = new Set<number>()
  for (const e of events) {
    if (typeof e.frequencyMhz === "number" && Number.isFinite(e.frequencyMhz)) {
      s.add(e.frequencyMhz)
    }
  }
  for (const t of transmissions) {
    if (typeof t.frequency === "number" && Number.isFinite(t.frequency)) {
      s.add(t.frequency)
    }
  }
  return Array.from(s)
}
