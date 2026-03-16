-- Landmarks table (admin-managed, map displays them)
CREATE TABLE landmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  icon_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX landmarks_geom_idx ON landmarks (lng, lat);

ALTER TABLE landmarks ENABLE ROW LEVEL SECURITY;

-- Public read for map
CREATE POLICY "landmarks_select" ON landmarks FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated can insert/update/delete (admin)
CREATE POLICY "landmarks_insert" ON landmarks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "landmarks_update" ON landmarks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "landmarks_delete" ON landmarks FOR DELETE TO authenticated USING (true);

-- RPC: list all landmarks (for map)
CREATE OR REPLACE FUNCTION get_landmarks()
RETURNS TABLE (
  id uuid,
  name text,
  lng float,
  lat float,
  icon_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, name, lng, lat, icon_url FROM landmarks ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION get_landmarks() TO anon;
GRANT EXECUTE ON FUNCTION get_landmarks() TO authenticated;

-- RPC: insert landmark (admin only; call after uploading image to storage)
CREATE OR REPLACE FUNCTION insert_landmark(
  p_name text,
  p_lng float,
  p_lat float,
  p_icon_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO landmarks (name, lng, lat, icon_url)
  VALUES (p_name, p_lng, p_lat, p_icon_url)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_landmark(text, float, float, text) TO authenticated;

-- Storage bucket for landmark images (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('landmark-icons', 'landmark-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read landmark images
CREATE POLICY "landmark_icons_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'landmark-icons');

-- Authenticated users can upload
CREATE POLICY "landmark_icons_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'landmark-icons');

-- Authenticated users can update/delete their uploads
CREATE POLICY "landmark_icons_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'landmark-icons');

CREATE POLICY "landmark_icons_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'landmark-icons');
