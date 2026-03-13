import { createClient } from "@/lib/supabase/client"
import { createEventSchema, type CreateEventInput } from "@/lib/validations"
import type { ObservationEvent } from "@/types/event"

type EventRow = {
  id: string
  event_type: string
  location: unknown
  occurred_at: string
  description: string
  title: string | null
  location_label: string | null
  emotional_intensity: string
  is_anonymous: boolean
}

function parseLocation(loc: unknown): { lat: number; lng: number } {
  if (loc && typeof loc === "object" && "coordinates" in loc) {
    const coords = (loc as { coordinates: [number, number] }).coordinates
    return { lng: coords[0], lat: coords[1] }
  }
  return { lat: 0, lng: 0 }
}

function rowToEvent(row: EventRow): ObservationEvent {
  const { lat, lng } = parseLocation(row.location)
  return {
    id: row.id,
    title: row.title ?? row.description.slice(0, 50),
    type: row.event_type as ObservationEvent["type"],
    intensity: row.emotional_intensity as ObservationEvent["intensity"],
    date: row.occurred_at.slice(0, 10),
    excerpt: row.description.slice(0, 120),
    description: row.description,
    location: row.location_label ?? undefined,
    coords: { lat, lng },
  }
}

export async function getEventsInBounds(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<ObservationEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_events_in_bounds", {
    p_north: bounds.north,
    p_south: bounds.south,
    p_east: bounds.east,
    p_west: bounds.west,
  })

  if (error) {
    if (error.code === "42883") {
      return []
    }
    throw error
  }
  return (data ?? []).map((r: EventRow) => rowToEvent(r))
}

export async function getEvents(filters?: {
  type?: string
  dateFrom?: string
  dateTo?: string
  intensity?: string
}): Promise<ObservationEvent[]> {
  const supabase = createClient()
  let query = supabase
    .from("events")
    .select("*")
    .eq("status", "approved")

  if (filters?.type && filters.type !== "all") {
    query = query.eq("event_type", filters.type)
  }
  if (filters?.dateFrom) {
    query = query.gte("occurred_at", filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte("occurred_at", `${filters.dateTo}T23:59:59Z`)
  }
  if (filters?.intensity && filters.intensity !== "all") {
    query = query.eq("emotional_intensity", filters.intensity)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r: EventRow) => rowToEvent(r))
}

export async function createEvent(input: CreateEventInput): Promise<ObservationEvent> {
  const parsed = createEventSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const occurredAt =
    parsed.data.occurred_at.includes("T")
      ? parsed.data.occurred_at
      : `${parsed.data.occurred_at}T12:00:00Z`

  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_event", {
    p_event_type: parsed.data.event_type,
    p_lng: parsed.data.lng,
    p_lat: parsed.data.lat,
    p_occurred_at: occurredAt,
    p_description: parsed.data.description,
    p_title: parsed.data.title ?? null,
    p_location_label: parsed.data.location ?? null,
    p_emotional_intensity: parsed.data.emotional_intensity,
    p_is_anonymous: parsed.data.is_anonymous,
  })

  if (error) throw error
  return rowToEvent(data as EventRow)
}
