# Plan: Capas y escenografía dinámicas (sin constantes; todo desde BD)

## Resumen

- **FILTROS:** Sin cambios.
- **Capas adicionales → Capas:** Título "Capas"; lista de toggles 100% desde BD (`layer_groups`); al activar un toggle se pide geodata de ese grupo y se pinta. **Ninguna constante de grupos ni layer ids.**
- **Escenografía:** Toggles desde capas del estilo Mapbox con `id` que empiece por `escenografia-`. Sin capas quemadas.
- **Constantes:** Quitar **todas** las constantes de catálogo/capas en todo el proyecto; todo debe cargar de la BD (catálogo API y geodata).

---

## 1. Catálogo: devolver grupos con nombre; fallback vacío

- [lib/catalog-db.ts](lib/catalog-db.ts): Devolver `groups: { code: string, name: string }[]` desde `layer_groups`.
- [lib/layer-catalog.ts](lib/layer-catalog.ts):
  - **Eliminar:** `GROUP_TRANSPORT`, `GROUP_NATURE`, `SUB_LAYER_METRO`, `SUB_LAYER_METROBUS`, `SUB_LAYER_JACARANDAS`, `SUB_LAYER_DEFAULT`, `LAYER_HIERARCHY`, `getGroups()`, `getSubLayersForGroup()`, `getSubSubLayers()`, `isInCatalog()` y cualquier otra constante o función que defina “qué grupos/sublayers existen”.
  - **Mantener solo:** tipos (`LayerHierarchy`, `LayerCatalogPayload`), `LAYER_CATALOG_VERSION`, y `getLayerCatalog()` como fallback cuando la BD falle, devolviendo `{ version, hierarchy: {}, groups: [], types }` para no asumir ningún grupo.
- [app/api/layer-catalog/route.ts](app/api/layer-catalog/route.ts): Seguir usando `getCatalogFromDb()` primero; fallback a `getLayerCatalog()` (ya sin grupos quemados).

---

## 2. Panel: "Capas" solo desde BD

- [components/map-panel.tsx](components/map-panel.tsx):
  - Eliminar `GROUP_DISPLAY_NAMES`.
  - Renombrar "Capas adicionales" → "Capas".
  - Cargar `catalogGroups: { code: string; name: string }[]` desde `GET /api/layer-catalog` (campo `groups`). Iterar `catalogGroups` para toggles; label = `name`.

---

## 3. Mapa: capas por grupo dinámicas

- [components/mapbox-canvas.tsx](components/mapbox-canvas.tsx):
  - **Eliminar:** imports y uso de `GROUP_TRANSPORT`, `getSubLayersForGroup`, `SUB_LAYER_METRO`, `SUB_LAYER_DEFAULT`; constantes `CDMX_METRO_SOURCE_ID`, `CDMX_METRO_LINE_GLOW_LAYER_ID`, `CDMX_METRO_LINE_LAYER_ID`, `CDMX_METRO_POINTS_LAYER_ID`.
  - Recibir `visibleGroups: Record<string, boolean>`. Para cada `groupCode` con `visibleGroups[groupCode] === true`: source `geodata-${groupCode}`, fetch `GET /api/layer-geodata?group_code=${groupCode}`, pintar líneas y puntos con filtro por `group`. IDs de capas/sources derivados del código (ej. `geodata-${groupCode}-line`, `geodata-${groupCode}-point`). Nada hardcodeado por TRANSPORT/METRO.
- [app/page.tsx](app/page.tsx): Pasar `filters.visibleGroups` al mapa; quitar `showMetroFromGroup`. No usar `LAYER_METRO` ni `METRO_LINEA2` para decidir “qué es metro”; usar datos del evento y, si hace falta, opciones de capa desde catálogo.

---

## 4. Escenografía desde estilo Mapbox

- Mapa: al cargar estilo, `map.getStyle().layers` filtrado por `id.startsWith("escenografia-")`; callback `onEscenografiaLayersLoaded(layers)`; aplicar visibilidad con `setLayoutProperty(..., 'visibility', ...)` según estado.
- Página: estado `escenografiaLayers` y `escenografiaVisible`; panel itera y pinta toggles. Quitar `showJacarandas` y el toggle fijo "Jacarandas".

---

## 5. Quitar constantes en todos los archivos (todo desde BD)

### lib/layer-catalog.ts

- Eliminar: `GROUP_TRANSPORT`, `GROUP_NATURE`, `SUB_LAYER_*`, `LAYER_HIERARCHY`, `getGroups`, `getSubLayersForGroup`, `getSubSubLayers`, `isInCatalog`, y el uso de `METRO_LINE2_STATION_CODES` / `METRO_SUB_SUB` si están ahí.
- Mantener: `LAYER_CATALOG_VERSION`, `LayerHierarchy`, `LayerCatalogPayload`, `getLayerCatalog()` con `hierarchy: {}`, `groups: []`.

### lib/event-layers.ts

- Eliminar: `LAYER_METRO`, `LAYER_DEFAULT`, `LAYER_VEGETACION`, `METRO_LINEA2`, `VEGETACION_*`, `METRO_LAYER_CONFIG`, `isEventInMetroLayer`.
- Mantener: `CAPA`, `SUBCAPA`, `SUB_SUBCAPA` (nombres de campo); `getStationNameByCode`, `getStationCodeForName`, `eventMatchesStation` (trabajan con strings; los valores vendrán de catálogo/eventos). Opciones de capa/sublayer en admin y página desde API, no constantes.

### lib/metro-station-coords.ts

- Mantener por ahora (datos de coordenadas L2); opcionalmente más adelante migrar a BD. No se usan para “qué capas existen”.

### components/mapbox-canvas.tsx

- Eliminar todos los imports desde `@/lib/layer-catalog` (GROUP_TRANSPORT, getSubLayersForGroup, SUB_LAYER_*).
- Eliminar constantes `CDMX_METRO_*`.
- Eliminar uso de `LAYER_METRO` / `METRO_LINEA2` de event-layers para filtros de capas; usar `group` de properties y `visibleGroups` por código de grupo.
- Lógica de líneas/puntos genérica por `group_code` (visibleGroups).

### app/page.tsx

- Dejar de usar `LAYER_METRO`, `METRO_LINEA2` como constantes para station layer/sublayer; usar `event.layer`, `event.sublayer` y, si hace falta, catálogo para opciones. Pasar `visibleGroups` al mapa.

### app/admin/page.tsx

- Cargar opciones de capa/sublayer (y estaciones si aplica) desde API de catálogo (o desde `layer_groups` + `layer_sublayers` + `layer_sub_sublayers`).
- Eliminar uso de `LAYER_METRO`, `METRO_LINEA2`, `STATION_NAMES` desde constantes; usar lista que venga del backend.

### components/map-panel.tsx

- Eliminar `GROUP_DISPLAY_NAMES`; usar solo `groups[].name` del API.

---

## Orden de carga

1. Cargar mapa Mapbox (estilo base).
2. Cargar capas: `GET /api/layer-catalog` → sección "Capas" con toggles desde `groups`.
3. Al activar un toggle de Capas → `GET /api/layer-geodata?group_code=X` → pintar.
4. Escenografía: capas del estilo con `id` prefijo `escenografia-` → toggles y visibilidad; sin constantes.

---

## Archivos a tocar (resumen)

| Archivo | Acción |
|---------|--------|
| lib/layer-catalog.ts | Quitar todas las constantes de grupos/sublayers y funciones que dependan de ellas; fallback vacío. |
| lib/catalog-db.ts | Añadir `groups` al payload. |
| lib/event-layers.ts | Quitar constantes de nombres de capa/sublayer; mantener helpers de strings y eventMatchesStation. |
| components/map-panel.tsx | "Capas", sin GROUP_DISPLAY_NAMES; escenografía dinámica. |
| components/mapbox-canvas.tsx | visibleGroups; sources/layers por group_code; sin CDMX_METRO_* ni imports de layer-catalog; escenografía desde estilo. |
| app/page.tsx | visibleGroups al mapa; sin LAYER_METRO/METRO_LINEA2 para “metro”; estado escenografía. |
| app/admin/page.tsx | Opciones de capa/sublayer desde API; sin LAYER_METRO, METRO_LINEA2, STATION_NAMES constantes. |
