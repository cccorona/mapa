import { z } from "zod"
import { EVENT_TYPES, EMOTIONAL_INTENSITY_SCALE } from "./constants"

const eventTypeValues = EVENT_TYPES.map((t) => t.value)
const intensityValues = EMOTIONAL_INTENSITY_SCALE.map((i) => i.value)

export const eventTypeSchema = z.enum(
  eventTypeValues as [string, ...string[]],
  { errorMap: () => ({ message: "Tipo de evento inválido" }) }
)

export const emotionalIntensitySchema = z.enum(
  intensityValues as [string, ...string[]],
  { errorMap: () => ({ message: "Intensidad debe ser 1-5" }) }
)

const uuidSchema = z.string().uuid("ID de contenedor inválido")

export const createEventSchema = z
  .object({
    event_type: eventTypeSchema,
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    location_container_id: uuidSchema.optional(),
    occurred_at: z.string().refine((s) => /^\d{4}-\d{2}-\d{2}/.test(s), "Formato de fecha inválido (YYYY-MM-DD)"),
    description: z.string().min(10, "Mínimo 10 caracteres").max(2000),
    emotional_intensity: emotionalIntensitySchema,
    is_anonymous: z.boolean().default(true),
    title: z.string().min(1, "Título requerido").max(200).optional(),
    location: z.string().max(500).optional(),
  })
  .refine((data) => data.location_container_id != null || (data.lat != null && data.lng != null), {
    message: "Indica una ubicación (lat/lng) o un punto contenedor existente",
    path: ["lat"],
  })

export type CreateEventInput = z.infer<typeof createEventSchema>
