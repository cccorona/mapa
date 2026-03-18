-- Columna group (nivel 1 del sistema de capas). Política backfill: DEFAULT → TRANSPORT.

-- 1) Añadir columna group
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS "group" text;

-- 2) Backfill: política explícita DEFAULT → TRANSPORT; METRO → TRANSPORT; VEGETACION → NATURE
UPDATE events
SET "group" = CASE
  WHEN COALESCE(layer, 'DEFAULT') = 'VEGETACION' THEN 'NATURE'
  ELSE 'TRANSPORT'
END
WHERE "group" IS NULL;

-- 3) NOT NULL y default para futuras filas
ALTER TABLE events
  ALTER COLUMN "group" SET DEFAULT 'TRANSPORT';
ALTER TABLE events
  ALTER COLUMN "group" SET NOT NULL;

-- 4) get_events_in_bounds: devolver group
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
  sublayer_detail text
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
    e.sublayer_detail
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

-- 5) update_event_location: aceptar p_group
DROP FUNCTION IF EXISTS update_event_location(uuid, float, float, text, text, text, text);

CREATE OR REPLACE FUNCTION update_event_location(
  p_event_id uuid,
  p_lat float,
  p_lng float,
  p_location_label text DEFAULT NULL,
  p_group text DEFAULT NULL,
  p_layer text DEFAULT NULL,
  p_sublayer text DEFAULT NULL,
  p_sublayer_detail text DEFAULT NULL
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
  sublayer_detail text
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
    "group" = COALESCE(p_group, e."group", 'TRANSPORT'),
    layer = CASE
      WHEN p_layer IS NOT NULL THEN p_layer
      ELSE COALESCE(e.layer, 'DEFAULT')
    END,
    sublayer = CASE WHEN p_layer IS NOT NULL THEN p_sublayer ELSE e.sublayer END,
    sublayer_detail = CASE WHEN p_layer IS NOT NULL THEN p_sublayer_detail ELSE e.sublayer_detail END,
    updated_at = now()
  WHERE e.id = p_event_id
  RETURNING
    id,
    event_type,
    occurred_at,
    description,
    title,
    location_label,
    emotional_intensity,
    is_anonymous,
    ST_Y(location::geometry)::float,
    ST_X(location::geometry)::float,
    COALESCE("group", 'TRANSPORT'),
    COALESCE(layer, 'DEFAULT'),
    sublayer,
    sublayer_detail;
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_location(uuid, float, float, text, text, text, text, text) TO authenticated;

-- 6) update_event_layers: aceptar p_group
DROP FUNCTION IF EXISTS update_event_layers(uuid, text, text, text);

CREATE OR REPLACE FUNCTION update_event_layers(
  p_event_id uuid,
  p_group text DEFAULT NULL,
  p_layer text DEFAULT 'DEFAULT',
  p_sublayer text DEFAULT NULL,
  p_sublayer_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE events
  SET
    "group" = COALESCE(p_group, "group", 'TRANSPORT'),
    layer = COALESCE(p_layer, 'DEFAULT'),
    sublayer = p_sublayer,
    sublayer_detail = p_sublayer_detail,
    updated_at = now()
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_layers(uuid, text, text, text, text) TO authenticated;
