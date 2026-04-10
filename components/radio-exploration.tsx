"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { FmTunerPanel } from "@/components/fm-tuner-panel"
import {
  RADIO_SESSION_EXPLORE_KEY,
  RADIO_SESSION_TUNED_KEY,
} from "@/lib/radio-constants"
import { clampFmMhz } from "@/lib/radio-frequency"

const SHOW_RADIO_UI =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_RADIO_EXPLORATION !== "false"

export interface RadioExplorationProps {
  exploreWithRadio: boolean
  tunedMhz: number
  onTunedMhzChange: (mhz: number) => void
  /** 0–1 calidad de recepción (mapa + dial); anima humo y luz. */
  signalQuality01: number
  onAudioUnlock?: () => void
}

export function RadioExplorationDock({
  exploreWithRadio,
  tunedMhz,
  onTunedMhzChange,
  signalQuality01,
  onAudioUnlock,
}: RadioExplorationProps) {
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      sessionStorage.setItem(RADIO_SESSION_EXPLORE_KEY, exploreWithRadio ? "1" : "0")
      sessionStorage.setItem(RADIO_SESSION_TUNED_KEY, String(tunedMhz))
    } catch {
      /* noop */
    }
  }, [exploreWithRadio, tunedMhz])

  if (!SHOW_RADIO_UI) return null

  if (!exploreWithRadio) return null

  return (
    <div
      className={cn(
        "fixed top-3 right-3 z-[25] max-w-[min(78vw,300px)] pointer-events-none md:top-5 md:right-5",
        "w-full"
      )}
    >
      <div className="pointer-events-auto drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        <FmTunerPanel
          valueMhz={tunedMhz}
          onChange={onTunedMhzChange}
          collapsed={panelCollapsed}
          onCollapsedChange={setPanelCollapsed}
          signalQuality01={signalQuality01}
          onUserInteract={onAudioUnlock}
        />
      </div>
    </div>
  )
}

export function loadRadioSessionDefaults(): { explore: boolean; tuned: number } {
  if (typeof window === "undefined") {
    return { explore: false, tuned: clampFmMhz(96.5) }
  }
  try {
    const ex = sessionStorage.getItem(RADIO_SESSION_EXPLORE_KEY)
    const tun = sessionStorage.getItem(RADIO_SESSION_TUNED_KEY)
    const explore = ex === "1"
    const parsed = tun ? Number.parseFloat(tun) : NaN
    const tuned = Number.isFinite(parsed) ? clampFmMhz(parsed) : clampFmMhz(96.5)
    return { explore, tuned }
  } catch {
    return { explore: false, tuned: clampFmMhz(96.5) }
  }
}
