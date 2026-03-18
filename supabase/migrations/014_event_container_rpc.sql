-- Crear punto contenedor (admin / servicio)
CREATE OR REPLACE FUNCTION create_location_container(
  p_lat float,
  p_lng float,
  p_label text DEFAULT NULL,
  p_group text DEFAULT NULL,
  p_layer text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO location_containers (location, label, "group", layer)
  VALUES (
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_label,
    p_group,
    p_layer
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_location_container(float, float, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_location_container(float, float, text, text, text) TO service_role;

-- Actualizar punto contenedor
CREATE OR REPLACE FUNCTION update_location_container(
  p_id uuid,
  p_lat float DEFAULT NULL,
  p_lng float DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_group text DEFAULT NULL,
  p_layer text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE location_containers
  SET
    location = CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ELSE location
    END,
    label = CASE WHEN p_label IS NOT NULL THEN p_label ELSE label END,
    "group" = CASE WHEN p_group IS NOT NULL THEN p_group ELSE "group" END,
    layer = CASE WHEN p_layer IS NOT NULL THEN p_layer ELSE layer END,
    updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_location_container(uuid, float, float, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_location_container(uuid, float, float, text, text, text) TO service_role;

-- Asignar o desasignar punto contenedor a un evento (admin).
CREATE OR REPLACE FUNCTION update_event_container_id(
  p_event_id uuid,
  p_location_container_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lng float;
  v_lat float;
BEGIN
  IF p_location_container_id IS NOT NULL THEN
    SELECT ST_X(location::geometry)::float, ST_Y(location::geometry)::float
    INTO v_lng, v_lat
    FROM location_containers
    WHERE id = p_location_container_id;
    IF v_lng IS NULL OR v_lat IS NULL THEN
      RAISE EXCEPTION 'location_container_id no encontrado: %', p_location_container_id;
    END IF;
    UPDATE events
    SET
      location = ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
      location_container_id = p_location_container_id,
      updated_at = now()
    WHERE id = p_event_id;
  ELSE
    UPDATE events
    SET location_container_id = NULL, updated_at = now()
    WHERE id = p_event_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_container_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_event_container_id(uuid, uuid) TO service_role;
