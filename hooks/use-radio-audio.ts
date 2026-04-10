"use client"

import { useEffect, useRef } from "react"
import type { ObservationEvent } from "@/types/event"
import type { RadioTransmission } from "@/lib/radio-types"
import { RadioAudioEngine } from "@/lib/radio-audio-engine"

export interface UseRadioAudioOptions {
  enabled: boolean
  tunedMhz: number
  focusedEventId: string | null
  getEvents: () => ObservationEvent[]
  getTransmissions: () => RadioTransmission[]
}

export function useRadioAudio(opts: UseRadioAudioOptions) {
  const engineRef = useRef<RadioAudioEngine | null>(null)
  const getEventsRef = useRef(opts.getEvents)
  const getTransRef = useRef(opts.getTransmissions)

  useEffect(() => {
    getEventsRef.current = opts.getEvents
    getTransRef.current = opts.getTransmissions
  }, [opts.getEvents, opts.getTransmissions])

  useEffect(() => {
    if (!engineRef.current) engineRef.current = new RadioAudioEngine()
    const engine = engineRef.current
    const run = () => {
      engine.tick({
        enabled: opts.enabled,
        tunedMhz: opts.tunedMhz,
        focusedEventId: opts.focusedEventId,
        events: getEventsRef.current(),
        transmissions: getTransRef.current(),
      })
    }
    run()
    const id = window.setInterval(run, 320)
    return () => window.clearInterval(id)
  }, [opts.enabled, opts.tunedMhz, opts.focusedEventId])

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  return {
    unlockAudio: () => engineRef.current?.unlock(),
  }
}
