/**
 * Coordinates for Metro Line 2 stations from official GeoJSON
 * (public/cdmx-metro-stations.geojson - datos.cdmx.gob.mx)
 */
export const METRO_LINE2_COORDS: Record<string, { lat: number; lng: number }> = {
  "Cuatro Caminos": { lat: 19.45959, lng: -99.21584 },
  "Panteones": { lat: 19.45864, lng: -99.20295 },
  "Tacuba": { lat: 19.45938, lng: -99.18823 },
  "Cuitláhuac": { lat: 19.45725, lng: -99.1815 },
  "Popotla": { lat: 19.45291, lng: -99.17549 },
  "Colegio Militar": { lat: 19.44927, lng: -99.17178 },
  "Normal": { lat: 19.44456, lng: -99.16727 },
  "San Cosme": { lat: 19.4419, lng: -99.16066 },
  "Revolución": { lat: 19.43923, lng: -99.15423 },
  "Hidalgo": { lat: 19.43755, lng: -99.14722 },
  "Bellas Artes": { lat: 19.43638, lng: -99.14161 },
  "Allende": { lat: 19.43556, lng: -99.13687 },
  "Zócalo/Tenochtitlan": { lat: 19.4325, lng: -99.13225 },
  "Pino Suárez": { lat: 19.42438, lng: -99.13294 },
  "San Antonio Abad": { lat: 19.41602, lng: -99.13454 },
  "Chabacano": { lat: 19.40918, lng: -99.13562 },
  "Viaducto": { lat: 19.40087, lng: -99.1369 },
  "Xola": { lat: 19.39521, lng: -99.13781 },
  "Villa de Cortés": { lat: 19.38758, lng: -99.13896 },
  "Nativitas": { lat: 19.37953, lng: -99.14019 },
  "Portales": { lat: 19.36992, lng: -99.14157 },
  "Ermita": { lat: 19.36198, lng: -99.1429 },
  "General Anaya": { lat: 19.35324, lng: -99.14501 },
  "Tasqueña": { lat: 19.34376, lng: -99.13953 },
}

/** Extract station name from location string for lookup (e.g. "Metro Pino Suárez, Centro" -> "Pino Suárez") */
export function getStationNameFromLocation(location: string): string | null {
  const match = location.match(/Metro\s+([^,]+)/)
  if (!match) return null
  const name = match[1].trim()
  if (METRO_LINE2_COORDS[name]) return name
  if (name === "Zócalo" && METRO_LINE2_COORDS["Zócalo/Tenochtitlan"]) return "Zócalo/Tenochtitlan"
  return name
}

export function getCoordsForStation(location: string): { lat: number; lng: number } | null {
  const stationName = getStationNameFromLocation(location)
  if (!stationName) return null
  return METRO_LINE2_COORDS[stationName] ?? null
}
