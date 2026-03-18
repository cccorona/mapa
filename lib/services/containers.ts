import { createClient } from "@/lib/supabase/client"
import type { LocationContainer } from "@/types/container"

type ContainerRow = {
  id: string
  lat: number
  lng: number
  label: string | null
  group: string | null
  layer: string | null
  created_at: string
}

function rowToContainer(row: ContainerRow): LocationContainer {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    label: row.label ?? null,
    group: row.group ?? null,
    layer: row.layer ?? null,
    created_at: row.created_at,
  }
}

export async function getLocationContainersInBounds(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<LocationContainer[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_location_containers_in_bounds", {
    p_north: bounds.north,
    p_south: bounds.south,
    p_east: bounds.east,
    p_west: bounds.west,
  })
  if (error) throw error
  return (data ?? []).map((r: ContainerRow) => rowToContainer(r))
}

export async function getLocationContainersAll(): Promise<LocationContainer[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_location_containers_all")
  if (error) throw error
  return (data ?? []).map((r: ContainerRow) => rowToContainer(r))
}
