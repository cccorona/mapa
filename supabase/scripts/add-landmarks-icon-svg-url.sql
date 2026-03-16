-- Añade columna icon_svg_url a landmarks y actualiza get_landmarks / insert_landmark
-- Ejecutar en Supabase: SQL Editor > New query > Run

ALTER TABLE landmarks
  ADD COLUMN IF NOT EXISTS icon_svg_url TEXT;

COMMENT ON COLUMN landmarks.icon_svg_url IS 'URL pública del SVG del icono (opcional); si existe se usa para el efecto de partículas.';

-- Eliminar funciones para poder cambiar su firma/retorno
DROP FUNCTION IF EXISTS get_landmarks();
DROP FUNCTION IF EXISTS insert_landmark(text, float, float, text);
DROP FUNCTION IF EXISTS insert_landmark(text, float, float, text, text);

-- get_landmarks: devolver también icon_svg_url
CREATE FUNCTION get_landmarks()
RETURNS TABLE (id uuid, name text, lng float, lat float, icon_url text, icon_svg_url text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT id, name, lng, lat, icon_url, icon_svg_url FROM landmarks ORDER BY name; $$;

GRANT EXECUTE ON FUNCTION get_landmarks() TO anon;
GRANT EXECUTE ON FUNCTION get_landmarks() TO authenticated;

-- insert_landmark: aceptar p_icon_svg_url (opcional)
CREATE FUNCTION insert_landmark(p_name text, p_lng float, p_lat float, p_icon_url text, p_icon_svg_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO landmarks (name, lng, lat, icon_url, icon_svg_url)
  VALUES (p_name, p_lng, p_lat, p_icon_url, p_icon_svg_url)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_landmark(text, float, float, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_landmark(text, float, float, text, text) TO service_role;
