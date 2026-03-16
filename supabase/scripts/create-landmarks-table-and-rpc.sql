-- Ejecuta este script en Supabase: SQL Editor > New query > pegar y Run
-- Crea la tabla landmarks y las funciones get_landmarks / insert_landmark

-- 1. Tabla
CREATE TABLE IF NOT EXISTS landmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  icon_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS landmarks_geom_idx ON landmarks (lng, lat);

ALTER TABLE landmarks ENABLE ROW LEVEL SECURITY;

-- 2. Políticas (omitir si ya existen)
DROP POLICY IF EXISTS "landmarks_select" ON landmarks;
CREATE POLICY "landmarks_select" ON landmarks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "landmarks_insert" ON landmarks;
CREATE POLICY "landmarks_insert" ON landmarks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "landmarks_update" ON landmarks;
CREATE POLICY "landmarks_update" ON landmarks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "landmarks_delete" ON landmarks;
CREATE POLICY "landmarks_delete" ON landmarks FOR DELETE TO authenticated USING (true);

-- 3. Función get_landmarks
CREATE OR REPLACE FUNCTION get_landmarks()
RETURNS TABLE (id uuid, name text, lng float, lat float, icon_url text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT id, name, lng, lat, icon_url FROM landmarks ORDER BY name; $$;

GRANT EXECUTE ON FUNCTION get_landmarks() TO anon;
GRANT EXECUTE ON FUNCTION get_landmarks() TO authenticated;

-- 4. Función insert_landmark
CREATE OR REPLACE FUNCTION insert_landmark(p_name text, p_lng float, p_lat float, p_icon_url text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO landmarks (name, lng, lat, icon_url)
  VALUES (p_name, p_lng, p_lat, p_icon_url)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_landmark(text, float, float, text) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_landmark(text, float, float, text) TO service_role;
