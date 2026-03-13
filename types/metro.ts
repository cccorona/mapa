export interface MetroStation {
  id: string
  name: string
  line: string
  coords: { lat: number; lng: number }
}

export interface MetroStory {
  id: string
  stationId: string
  line: string
  title: string
  excerpt: string
  description: string
  date: string
  coords: { lat: number; lng: number }
  tags?: string[]
}
