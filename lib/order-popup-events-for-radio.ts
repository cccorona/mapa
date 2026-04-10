import type { ObservationEvent } from "@/types/event"

/** Ordena observaciones del popup: con radio ON, las más cercanas en MHz a la sintonía primero. */
export function orderPopupEventsForRadio(
  events: ObservationEvent[],
  exploreWithRadio: boolean,
  tunedMhz: number
): ObservationEvent[] {
  if (!exploreWithRadio || events.length <= 1) return events
  return [...events].sort((a, b) => {
    const da =
      typeof a.frequencyMhz === "number" && Number.isFinite(a.frequencyMhz)
        ? Math.abs(tunedMhz - a.frequencyMhz)
        : 999
    const db =
      typeof b.frequencyMhz === "number" && Number.isFinite(b.frequencyMhz)
        ? Math.abs(tunedMhz - b.frequencyMhz)
        : 999
    return da - db
  })
}
