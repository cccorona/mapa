import type { EventType, EmotionalIntensity } from "@/lib/constants"

export interface ObservationEvent {
  id: string
  title: string
  type: EventType
  intensity: EmotionalIntensity
  date: string
  excerpt: string
  description: string
  location?: string
  coords: { lat: number; lng: number }
  tags?: string[]
  /** Grupo (nivel 1): TRANSPORT, NATURE. Columna real en DB. */
  group?: string
  /** Capa jerárquica nivel 2 (ej. METRO, DEFAULT). */
  layer?: string
  /** Capa jerárquica nivel 3 (ej. LINEA2). */
  sublayer?: string
  /** Capa jerárquica nivel 4 (ej. código de estación TASQUENA). */
  sublayerDetail?: string
  /** Si el evento está ligado a un punto contenedor, su id (para agrupar en el slide). */
  containerId?: string
  /** MHz en banda FM (88.1–107.9); ausente = no participa en modo radio. */
  frequencyMhz?: number
  /** URL de audio asociado al evento (modo radio). */
  audioUrl?: string
}
