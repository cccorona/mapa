-- Catálogo de capas en BD: dominios (groups), subcapas, sub-subcapas. Sin valores sueltos.
-- Prueba inicial: poder crear todo el metro desde el panel de admin.

-- 1) Grupos (dominios)
CREATE TABLE IF NOT EXISTS layer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2) Subcapas (por grupo)
CREATE TABLE IF NOT EXISTS layer_sublayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES layer_groups(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, code)
);

-- 3) Sub-subcapas (por subcapa)
CREATE TABLE IF NOT EXISTS layer_sub_sublayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sublayer_id uuid NOT NULL REFERENCES layer_sublayers(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sublayer_id, code)
);

-- 4) Datos geo subidos (GeoJSON por grupo/sublayer/sub_sublayer)
CREATE TABLE IF NOT EXISTS layer_geodata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES layer_groups(id) ON DELETE CASCADE,
  sublayer_id uuid REFERENCES layer_sublayers(id) ON DELETE SET NULL,
  sub_sublayer_id uuid REFERENCES layer_sub_sublayers(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('point', 'line', 'polygon')),
  geojson jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS layer_geodata_group_id_idx ON layer_geodata(group_id);
CREATE INDEX IF NOT EXISTS layer_sublayers_group_id_idx ON layer_sublayers(group_id);
CREATE INDEX IF NOT EXISTS layer_sub_sublayers_sublayer_id_idx ON layer_sub_sublayers(sublayer_id);

-- 5) Seed inicial: TRANSPORT (Metro L2 + estaciones), NATURE (Jacarandas)
INSERT INTO layer_groups (code, name) VALUES
  ('TRANSPORT', 'Transporte'),
  ('NATURE', 'Naturaleza')
ON CONFLICT (code) DO NOTHING;

-- Subcapas bajo TRANSPORT
INSERT INTO layer_sublayers (group_id, code, name)
SELECT id, 'DEFAULT', 'Por defecto' FROM layer_groups WHERE code = 'TRANSPORT'
ON CONFLICT (group_id, code) DO NOTHING;

INSERT INTO layer_sublayers (group_id, code, name)
SELECT id, 'METRO', 'Metro' FROM layer_groups WHERE code = 'TRANSPORT'
ON CONFLICT (group_id, code) DO NOTHING;

INSERT INTO layer_sublayers (group_id, code, name)
SELECT id, 'METROBUS', 'Metrobús' FROM layer_groups WHERE code = 'TRANSPORT'
ON CONFLICT (group_id, code) DO NOTHING;

-- Subcapas bajo NATURE
INSERT INTO layer_sublayers (group_id, code, name)
SELECT id, 'JACARANDAS', 'Jacarandas' FROM layer_groups WHERE code = 'NATURE'
ON CONFLICT (group_id, code) DO NOTHING;

-- Sub-subcapas para METRO: L2 + estaciones L2 (código y nombre)
INSERT INTO layer_sub_sublayers (sublayer_id, code, name)
SELECT ls.id, 'L2', 'Línea 2'
FROM layer_sublayers ls
JOIN layer_groups lg ON lg.id = ls.group_id
WHERE lg.code = 'TRANSPORT' AND ls.code = 'METRO'
ON CONFLICT (sublayer_id, code) DO NOTHING;

INSERT INTO layer_sub_sublayers (sublayer_id, code, name)
SELECT met.id, v.code, v.name
FROM (VALUES
  ('CUATRO_CAMINOS', 'Cuatro Caminos'),
  ('PANTEONES', 'Panteones'),
  ('TACUBA', 'Tacuba'),
  ('CUITLAHUAC', 'Cuitláhuac'),
  ('POPOTLA', 'Popotla'),
  ('COLEGIO_MILITAR', 'Colegio Militar'),
  ('NORMAL', 'Normal'),
  ('SAN_COSME', 'San Cosme'),
  ('REVOLUCION', 'Revolución'),
  ('HIDALGO', 'Hidalgo'),
  ('BELLAS_ARTES', 'Bellas Artes'),
  ('ALLENDE', 'Allende'),
  ('ZOCALO_TENOCHTITLAN', 'Zócalo/Tenochtitlan'),
  ('PINO_SUAREZ', 'Pino Suárez'),
  ('SAN_ANTONIO_ABAD', 'San Antonio Abad'),
  ('CHABACANO', 'Chabacano'),
  ('VIADUCTO', 'Viaducto'),
  ('XOLA', 'Xola'),
  ('VILLA_DE_CORTES', 'Villa de Cortés'),
  ('NATIVITAS', 'Nativitas'),
  ('PORTALES', 'Portales'),
  ('ERMITA', 'Ermita'),
  ('GENERAL_ANAYA', 'General Anaya'),
  ('TASQUENA', 'Tasqueña')
) AS v(code, name),
(SELECT ls.id FROM layer_sublayers ls JOIN layer_groups lg ON lg.id = ls.group_id WHERE lg.code = 'TRANSPORT' AND ls.code = 'METRO') AS met(id)
ON CONFLICT (sublayer_id, code) DO NOTHING;

-- RLS: solo authenticated puede escribir; anon puede leer catálogo (para el mapa)
ALTER TABLE layer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE layer_sublayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE layer_sub_sublayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE layer_geodata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layer_groups read all" ON layer_groups FOR SELECT USING (true);
CREATE POLICY "layer_groups admin write" ON layer_groups FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "layer_sublayers read all" ON layer_sublayers FOR SELECT USING (true);
CREATE POLICY "layer_sublayers admin write" ON layer_sublayers FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "layer_sub_sublayers read all" ON layer_sub_sublayers FOR SELECT USING (true);
CREATE POLICY "layer_sub_sublayers admin write" ON layer_sub_sublayers FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "layer_geodata read all" ON layer_geodata FOR SELECT USING (true);
CREATE POLICY "layer_geodata admin write" ON layer_geodata FOR ALL USING (auth.role() = 'authenticated');
