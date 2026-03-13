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
