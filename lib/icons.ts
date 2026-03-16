import { EVENT_TYPES, EMOTIONAL_INTENSITY_SCALE, EVENT_TYPE_TO_SYMBOL } from "./constants"

/** Single source of truth for symbol names (icons, map, theme). */
export const SYMBOLS = [
  "vela",
  "grieta",
  "hilo",
  "puerta",
  "documento",
  "germen",
  "cruz",
] as const

export type SymbolName = (typeof SYMBOLS)[number]

/** Label for display by event type */
export const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_TYPES.map((t) => [t.value, t.label])
)

/** Label for display by intensity (1-5) */
export const INTENSITY_LABELS: Record<string, string> = Object.fromEntries(
  EMOTIONAL_INTENSITY_SCALE.map((i) => [i.value, i.level])
)

/** Get symbol key for marker/glyph from event type */
export function getSymbolForType(eventType: string): SymbolName {
  const symbol = EVENT_TYPE_TO_SYMBOL[eventType as keyof typeof EVENT_TYPE_TO_SYMBOL] ?? "vela"
  return symbol as SymbolName
}
