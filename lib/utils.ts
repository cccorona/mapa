import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

export function filterEventsInBounds<T extends { coords: { lat: number; lng: number } }>(
  events: T[],
  bounds: Bounds
): T[] {
  return events.filter(
    (e) =>
      e.coords.lat >= bounds.south &&
      e.coords.lat <= bounds.north &&
      e.coords.lng >= bounds.west &&
      e.coords.lng <= bounds.east
  )
}

export function isInCDMX(coords: { lat: number; lng: number }, bounds: Bounds): boolean {
  const { north, south, east, west } = bounds
  return coords.lat >= south && coords.lat <= north && coords.lng >= west && coords.lng <= east
}

const COORD_ROUND_PRECISION = 5

/** Redondea a 5 decimales (~1.1 m), mismo formato que el mapa. */
export function roundCoord(v: number): number {
  return Math.round(v * 10 ** COORD_ROUND_PRECISION) / 10 ** COORD_ROUND_PRECISION
}

export function coordKey(lat: number, lng: number): string {
  return `${roundCoord(lat)},${roundCoord(lng)}`
}

export function groupEventsByCoords<T extends { coords: { lat: number; lng: number } }>(
  events: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const e of events) {
    const key = coordKey(e.coords.lat, e.coords.lng)
    const group = map.get(key) ?? []
    group.push(e)
    map.set(key, group)
  }
  return map
}

/** Clave de ubicación: containerId si existe, si no coordKey(lat, lng). */
export function locationKey<T extends { coords: { lat: number; lng: number }; containerId?: string }>(
  event: T
): string {
  if (event.containerId) return event.containerId
  return coordKey(event.coords.lat, event.coords.lng)
}

/** Agrupa eventos por contenedor (containerId) o por coordenadas; para popup/slide. */
export function groupEventsByLocation<
  T extends { coords: { lat: number; lng: number }; containerId?: string }
>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const e of events) {
    const key = locationKey(e)
    const group = map.get(key) ?? []
    group.push(e)
    map.set(key, group)
  }
  return map
}
