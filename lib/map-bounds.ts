/**
 * Bounds para CDMX (Ciudad de México).
 * El mapa está acotado a esta zona únicamente.
 */
export const CDMX_BOUNDS = {
  north: 19.7,
  south: 19.05,
  east: -98.94,
  west: -99.36,
} as const

export const CDMX_CENTER: [number, number] = [-99.13, 19.43]
export const CDMX_DEFAULT_ZOOM = 7
