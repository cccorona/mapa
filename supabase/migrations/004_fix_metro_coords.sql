-- Fix Metro L2 event coordinates to match official GeoJSON (cdmx-metro-stations.geojson)
-- Run this after 002_seed_events if BD already has data with wrong coords

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.21584, 19.45959), 4326)::geography
WHERE location_label LIKE 'Metro Cuatro Caminos%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.20295, 19.45864), 4326)::geography
WHERE location_label LIKE 'Metro Panteones%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.18823, 19.45938), 4326)::geography
WHERE location_label LIKE 'Metro Tacuba%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.1815, 19.45725), 4326)::geography
WHERE location_label LIKE 'Metro Cuitláhuac%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.17549, 19.45291), 4326)::geography
WHERE location_label LIKE 'Metro Popotla%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.17178, 19.44927), 4326)::geography
WHERE location_label LIKE 'Metro Colegio Militar%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.16727, 19.44456), 4326)::geography
WHERE location_label LIKE 'Metro Normal%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.16066, 19.4419), 4326)::geography
WHERE location_label LIKE 'Metro San Cosme%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.15423, 19.43923), 4326)::geography
WHERE location_label LIKE 'Metro Revolución%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.14722, 19.43755), 4326)::geography
WHERE location_label LIKE 'Metro Hidalgo%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.14161, 19.43638), 4326)::geography
WHERE location_label LIKE 'Metro Bellas Artes%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13687, 19.43556), 4326)::geography
WHERE location_label LIKE 'Metro Allende%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13225, 19.4325), 4326)::geography
WHERE location_label LIKE 'Metro Zócalo%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13294, 19.42438), 4326)::geography
WHERE location_label LIKE 'Metro Pino Suárez%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13454, 19.41602), 4326)::geography
WHERE location_label LIKE 'Metro San Antonio Abad%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13562, 19.40918), 4326)::geography
WHERE location_label LIKE 'Metro Chabacano%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.1369, 19.40087), 4326)::geography
WHERE location_label LIKE 'Metro Viaducto%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13781, 19.39521), 4326)::geography
WHERE location_label LIKE 'Metro Xola%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13896, 19.38758), 4326)::geography
WHERE location_label LIKE 'Metro Villa de Cortés%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.14019, 19.37953), 4326)::geography
WHERE location_label LIKE 'Metro Nativitas%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.14157, 19.36992), 4326)::geography
WHERE location_label LIKE 'Metro Portales%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.1429, 19.36198), 4326)::geography
WHERE location_label LIKE 'Metro Ermita%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.14501, 19.35324), 4326)::geography
WHERE location_label LIKE 'Metro General Anaya%';

UPDATE events SET location = ST_SetSRID(ST_MakePoint(-99.13953, 19.34376), 4326)::geography
WHERE location_label LIKE 'Metro Tasqueña%';
