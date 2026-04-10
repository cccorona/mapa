-- FM radio exploration: frecuencia y audio opcionales por evento.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS frequency_mhz numeric(6, 2),
  ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_frequency_mhz_range;
ALTER TABLE events ADD CONSTRAINT events_frequency_mhz_range
  CHECK (frequency_mhz IS NULL OR (frequency_mhz >= 88.0 AND frequency_mhz <= 108.0));

COMMENT ON COLUMN events.frequency_mhz IS 'Banda FM México ~88.1–107.9 MHz; null = sin juego de radio';
COMMENT ON COLUMN events.audio_url IS 'URL pública MP3 para reproducción al sintonizar';

DROP FUNCTION IF EXISTS get_events_in_bounds(float, float, float, float);

CREATE OR REPLACE FUNCTION get_events_in_bounds(
  p_north float, p_south float, p_east float, p_west float
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
  lng float,
  "group" text,
  layer text,
  sublayer text,
  sublayer_detail text,
  location_container_id uuid,
  frequency_mhz numeric,
  audio_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e.id,
    e.event_type,
    e.occurred_at,
    e.description,
    e.title,
    e.location_label,
    e.emotional_intensity,
    e.is_anonymous,
    ST_Y(e.location::geometry)::float,
    ST_X(e.location::geometry)::float,
    COALESCE(e."group", 'TRANSPORT'),
    COALESCE(e.layer, 'DEFAULT'),
    e.sublayer,
    e.sublayer_detail,
    e.location_container_id,
    e.frequency_mhz,
    e.audio_url
  FROM events e
  WHERE e.status = 'approved'
  AND ST_Intersects(
    e.location,
    ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
  )
  ORDER BY e.occurred_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_events_in_bounds(float, float, float, float) TO anon;
GRANT EXECUTE ON FUNCTION get_events_in_bounds(float, float, float, float) TO authenticated;
