-- Puntos contenedores: ubicaciones a las que se pueden ligar varios eventos.
-- Un evento puede tener su propia location o location_container_id; si tiene contenedor,
-- la posición para pintar/agrupar es la del contenedor.

-- 1) Tabla location_containers
CREATE TABLE IF NOT EXISTS location_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location geography(POINT, 4326) NOT NULL,
  label text,
  "group" text,
  layer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_containers_location_idx
  ON location_containers USING GIST(location);

-- 2) Columna en events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_container_id uuid REFERENCES location_containers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_location_container_id_idx ON events(location_container_id);

-- 3) RLS: lectura pública de contenedores
ALTER TABLE location_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_containers_select_all"
  ON location_containers FOR SELECT
  USING (true);

CREATE POLICY "location_containers_insert_authenticated"
  ON location_containers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "location_containers_update_authenticated"
  ON location_containers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "location_containers_delete_authenticated"
  ON location_containers FOR DELETE
  TO authenticated
  USING (true);

-- 4) get_events_in_bounds: devolver location_container_id
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
  location_container_id uuid
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
    e.location_container_id
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

-- 5) create_event: aceptar p_location_container_id opcional
DROP FUNCTION IF EXISTS create_event(event_type, float, float, timestamptz, text, text, text, emotional_intensity, boolean);

CREATE OR REPLACE FUNCTION create_event(
  p_event_type event_type,
  p_lng float DEFAULT NULL,
  p_lat float DEFAULT NULL,
  p_occurred_at timestamptz,
  p_description text,
  p_title text DEFAULT NULL,
  p_location_label text DEFAULT NULL,
  p_emotional_intensity emotional_intensity DEFAULT '3',
  p_is_anonymous boolean DEFAULT true,
  p_location_container_id uuid DEFAULT NULL
)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lng float;
  v_lat float;
  v_row events;
BEGIN
  IF p_location_container_id IS NOT NULL THEN
    SELECT ST_X(location::geometry)::float, ST_Y(location::geometry)::float
    INTO v_lng, v_lat
    FROM location_containers
    WHERE id = p_location_container_id;
    IF v_lng IS NULL OR v_lat IS NULL THEN
      RAISE EXCEPTION 'location_container_id no encontrado: %', p_location_container_id;
    END IF;
  ELSIF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_lng := p_lng;
    v_lat := p_lat;
  ELSE
    RAISE EXCEPTION 'Se requiere location_container_id o (lat, lng)';
  END IF;

  INSERT INTO events (
    event_type, location, occurred_at, description,
    title, location_label, emotional_intensity, is_anonymous, created_by, location_container_id
  ) VALUES (
    p_event_type,
    ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
    p_occurred_at,
    p_description,
    p_title,
    p_location_label,
    p_emotional_intensity,
    p_is_anonymous,
    auth.uid(),
    p_location_container_id
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_event(event_type, float, float, timestamptz, text, text, text, emotional_intensity, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_event(event_type, float, float, timestamptz, text, text, text, emotional_intensity, boolean, uuid) TO anon;

-- 6) RPC: listar contenedores en bounds (para mapa y formulario)
CREATE OR REPLACE FUNCTION get_location_containers_in_bounds(
  p_north float,
  p_south float,
  p_east float,
  p_west float
)
RETURNS TABLE (
  id uuid,
  lat float,
  lng float,
  label text,
  "group" text,
  layer text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    lc.id,
    ST_Y(lc.location::geometry)::float,
    ST_X(lc.location::geometry)::float,
    lc.label,
    lc."group",
    lc.layer,
    lc.created_at
  FROM location_containers lc
  WHERE ST_Intersects(
    lc.location,
    ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
  )
  ORDER BY lc.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_location_containers_in_bounds(float, float, float, float) TO anon;
GRANT EXECUTE ON FUNCTION get_location_containers_in_bounds(float, float, float, float) TO authenticated;

-- 7) RPC: listar todos los contenedores (para admin y selector en formulario)
CREATE OR REPLACE FUNCTION get_location_containers_all()
RETURNS TABLE (
  id uuid,
  lat float,
  lng float,
  label text,
  "group" text,
  layer text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    lc.id,
    ST_Y(lc.location::geometry)::float,
    ST_X(lc.location::geometry)::float,
    lc.label,
    lc."group",
    lc.layer,
    lc.created_at
  FROM location_containers lc
  ORDER BY lc.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_location_containers_all() TO anon;
GRANT EXECUTE ON FUNCTION get_location_containers_all() TO authenticated;
