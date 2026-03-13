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
}
