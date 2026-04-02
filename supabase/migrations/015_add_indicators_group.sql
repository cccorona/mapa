-- Añadir categoría Indicadores para líneas/polígonos dibujados a mano, corredores, zonas.
INSERT INTO layer_groups (code, name) VALUES
  ('INDICATORS', 'Indicadores')
ON CONFLICT (code) DO NOTHING;
