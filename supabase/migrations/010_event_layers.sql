-- Capas jerárquicas para eventos (compatible con datos existentes).
-- Cada evento puede quedar en DEFAULT o asignarse manualmente a layer/sublayer/sublayer_detail
-- (ej. METRO → LINEA2 → TASQUENA). No se modifican filas existentes.

-- 1) Añadir columnas (nullable salvo layer por default)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS layer text DEFAULT 'DEFAULT',
  ADD COLUMN IF NOT EXISTS sublayer text,
  ADD COLUMN IF NOT EXISTS sublayer_detail text;

-- Valores por defecto para filas ya existentes (layer ya tiene DEFAULT en la columna)
UPDATE events SET layer = COALESCE(layer, 'DEFAULT') WHERE layer IS NULL;

-- 2) get_events_in_bounds: devolver layer, sublayer, sublayer_detail
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

-- 3) update_event_location: aceptar opcionalmente layer, sublayer, sublayer_detail
-- Si no se envían, se mantienen los valores actuales del evento (no se fuerza DEFAULT)
DROP FUNCTION IF EXISTS update_event_location(uuid, float, float, text);
DROP FUNCTION IF EXISTS update_event_location(uuid, float, float, text, text, text, text);

CREATE OR REPLACE FUNCTION update_event_location(
  p_event_id uuid,
  p_lat float,
  p_lng float,
  p_location_label text DEFAULT NULL,
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
    COALESCE(layer, 'DEFAULT'),
    sublayer,
    sublayer_detail;
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_location(uuid, float, float, text, text, text, text) TO authenticated;

-- 4) Opcional: actualizar solo capas (sin cambiar ubicación) para "Pasar a capa por defecto"
CREATE OR REPLACE FUNCTION update_event_layers(
  p_event_id uuid,
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
    layer = COALESCE(p_layer, 'DEFAULT'),
    sublayer = p_sublayer,
    sublayer_detail = p_sublayer_detail,
    updated_at = now()
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_layers(uuid, text, text, text) TO authenticated;
