-- RPC: update event location (assign to metro station - requires auth)
CREATE OR REPLACE FUNCTION update_event_location(
  p_event_id uuid,
  p_lat float,
  p_lng float,
  p_location_label text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  event_type event_type,
  occurred_at timestamptz,
  description text,
  title text,
  location_label text,
  emotional_intensity emotional_intensity,
  is_anonymous boolean,
  lat float,
  lng float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE events e
  SET
    location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    location_label = COALESCE(p_location_label, e.location_label),
    updated_at = now()
  WHERE e.id = p_event_id
  RETURNING
    e.id,
    e.event_type,
    e.occurred_at,
    e.description,
    e.title,
    e.location_label,
    e.emotional_intensity,
    e.is_anonymous,
    ST_Y(e.location::geometry)::float,
    ST_X(e.location::geometry)::float;
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_location(uuid, float, float, text) TO authenticated;
