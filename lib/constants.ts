/**
 * Dominio cerrado de tipos de evento (especificación oficial).
 * No existe categoría "Otro".
 */
export const EVENT_TYPES = [
  { value: "DEATH", label: "Fallecimiento" },
  { value: "JOB_RESIGNATION", label: "Renuncia laboral" },
  { value: "JOB_TERMINATION", label: "Despido" },
  { value: "RELATIONSHIP_END", label: "Fin de relación" },
  { value: "MAJOR_DECISION", label: "Decisión mayor" },
  { value: "NEW_BEGINNING", label: "Nuevo comienzo" },
  { value: "RELOCATION", label: "Mudanza" },
  { value: "ACCIDENT", label: "Accidente" },
  { value: "HEALTH_DIAGNOSIS", label: "Diagnóstico médico" },
  { value: "LEGAL_EVENT", label: "Evento jurídico" },
] as const

export type EventType = (typeof EVENT_TYPES)[number]["value"]

/**
 * Escala de intensidad emocional (1-5).
 */
export const EMOTIONAL_INTENSITY_SCALE = [
  { value: "1", label: "1", level: "mínima" },
  { value: "2", label: "2", level: "leve" },
  { value: "3", label: "3", level: "media" },
  { value: "4", label: "4", level: "alta" },
  { value: "5", label: "5", level: "máxima" },
] as const

export type EmotionalIntensity = (typeof EMOTIONAL_INTENSITY_SCALE)[number]["value"]

/**
 * Mapeo de tipo de dominio a símbolo/glyph para renderizado.
 * Preserva la estética simbólica (vela, grieta, hilo, puerta, etc.).
 */
export const EVENT_TYPE_TO_SYMBOL: Record<EventType, string> = {
  DEATH: "vela",
  JOB_RESIGNATION: "documento",
  JOB_TERMINATION: "documento",
  RELATIONSHIP_END: "hilo",
  MAJOR_DECISION: "puerta",
  NEW_BEGINNING: "germen",
  RELOCATION: "puerta",
  ACCIDENT: "grieta",
  HEALTH_DIAGNOSIS: "cruz",
  LEGAL_EVENT: "documento",
}

/** Color for events: use SYMBOL_COLORS[getSymbolForType(eventType)] from lib/theme instead. */
