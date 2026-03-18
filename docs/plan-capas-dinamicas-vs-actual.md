# Plan de acción: Sistema de Capas Dinámicas vs estado actual

Comparación del requerimiento (Sistema General de Capas Dinámicas en Mapbox) con lo ya implementado y pasos concretos para alinearse.

---

## 0. Ajustes críticos (refinamiento)

Estas reglas evitan errores silenciosos y deuda técnica; el plan se ejecuta respetándolas.

| Regla | Qué hacer | Qué no hacer |
|-------|-----------|--------------|
| **group** | Columna real en DB. Backfill desde datos existentes (ej. METRO → TRANSPORT). | No derivar group de layer en código; la inferencia se rompe con EVENTS, FESTIVALES, etc. |
| **type** | En GeoJSON solo para **render**: `type: "line" \| "point" \| "polygon"`. | No mezclar con tipo de negocio. |
| **feature_type** | Tipo de negocio en GeoJSON: `feature_type: "event" \| "station"` (u otros). | No usar `type` para esto; filtros y lógica se vuelven Frankenstein. |
| **sub_layer / sub_sub_layer** | En DB siempre valores **específicos** del catálogo. | No persistir `"ALL"` en DB; ALL es solo semántica de filtro en cliente. |
| **ALL** | Solo en cliente: cuando el usuario “no filtra”, el filtro Mapbox interpreta “todos” (lista llena o expresión equivalente). | No guardar ALL en base de datos. |
| **Filtro maestro** | Incluir **group**: `group === activeGroup` y type y sub_layer in list y sub_sub_layer in list. | Sin filtrar por group se mezclan datasets y hay resultados raros. |
| **Sources** | Opción pragmática: `transport_lines_source` + `transport_points_source` (por geometría). Un group lógico, dos sources físicos si el GeoJSON es pesado. | No obligar 1 solo source por group si el costo de parsing/filtrado es alto. |
| **UI** | Cada toggle solo actualiza estado: `visibleGroups`, `activeSubLayers`, `activeSubSubLayers`. Mapbox solo reacciona a ese estado (filtro maestro). | No modificar layers/sources directamente desde la UI. |
| **Migración** | Exportar BD, añadir columnas, backfill, repoblar. Un solo esquema nuevo. | No feature flag de coexistencia; no correr viejo y nuevo en paralelo. |

**Mantra aterrizado:**  
`group` → real en DB. `type` → solo render. `feature_type` → negocio. `sub_layer` / `sub_sub_layer` → categoría/detalle (específicos en DB). `"ALL"` → solo en cliente.

---

## 1. Comparativa rápida

| Dimensión | Requerimiento | Estado actual |
|-----------|---------------|---------------|
| **Nivel 1** | `group` (TRANSPORT, NATURE) | No existe. Equivalente actual: `layer` (METRO, VEGETACION, DEFAULT). |
| **Nivel 2** | `sub_layer` (METRO, METROBUS, JACARANDAS, ALL) | `sublayer` (LINEA2, etc.) — mismo concepto, distinto nombre. |
| **Nivel 3** | `sub_sub_layer` (L1, L2, ROMA, ALL) | `sublayer_detail` (código estación, ej. TASQUENA). |
| **Tipo visual** | `type` (line, point, polygon) | En GeoJSON de eventos: `type: "event"` \| `"station"`; no hay `line`/`point`/`polygon` explícito. |
| **GeoJSON** | properties: group, sub_layer, sub_sub_layer, type, name | properties: type, eventId, symbol, stationId, etc.; **no** group/sub_layer/sub_sub_layer en features. |
| **Backend** | Catálogo centralizado, validación, defaults ALL | Sin catálogo; DB: layer (default DEFAULT), sublayer, sublayer_detail opcionales. |
| **Sources** | 1 source por group (transport_source, nature_source) | Varios: cdmx-boundary, cdmx-metro-lines, cdmx-events (eventos + estaciones en uno). |
| **Layers Mapbox** | Por group: 3 layers (line, point, polygon) con filtro por type | Metro: 2 line + 1 circle; events: 1 symbol + 1 circle; boundary: 4; jacarandas: capa del estilo. |
| **Visibilidad** | toggleGroup; listas activeSubLayers / activeSubSubLayers; filtro maestro | showMetroLines, showAllLayers, showJacarandas (booleanos). |

---

## 2. Mapeo de nombres (requerimiento → actual)

- `group` → **columna nueva en DB**; no inferir. Valores del catálogo (TRANSPORT, NATURE, …). Backfill: METRO → TRANSPORT, VEGETACION → NATURE; DEFAULT/otros según regla de negocio.
- `sub_layer` → actual `sublayer`; en DB siempre valor específico del catálogo (METRO, METROBUS, …). Nunca persistir ALL.
- `sub_sub_layer` → actual `sublayer_detail`; mismo criterio (L1, L2, TASQUENA, …).
- `type` (GeoJSON) → **solo render**: `"line"` | `"point"` | `"polygon"`.
- `feature_type` (GeoJSON) → **negocio**: `"event"` | `"station"` (u otros). No usar `type` para esto.

---

## 3. Plan de acción por bloques

### Fase A: Contrato de datos y catálogo (backend + cliente)

**A.1 Catálogo centralizado (backend)**  
- Crear tabla o JSON de catálogos: `groups`, `sub_layers`, `sub_sub_layers`, `types` (render).  
- Valores iniciales: groups = [TRANSPORT, NATURE]; sub_layers = [METRO, METROBUS, JACARANDAS] (sin ALL; ALL solo en cliente); sub_sub_layers = [L1, L2, … estaciones]; types = [line, point, polygon].  
- Exponer endpoint o función que devuelva el catálogo (validación + cliente).

**A.2 Validación backend**  
- Columna `group` obligatoria; validar contra catálogo. Validar que sub_layer y sub_sub_layer estén en catálogo y sean **específicos** (nunca persistir ALL).  
- Rechazar null/vacío en campos obligatorios. Validar jerarquía: sub_layer pertenece a group, sub_sub_layer pertenece a sub_layer.

**A.3 Enums / constantes en cliente**  
- Definir enums/const alineados al catálogo: Group, SubLayer, SubSubLayer; y para render FeatureType (line, point, polygon).  
- ALL existe **solo en cliente** para semántica de filtro (“mostrar todos”); no viene de API como dato. Fallback defensivo: valor fuera de catálogo → no crashear, tratar como “incluir en filtro” o valor por defecto según UX.

---

### Fase B: GeoJSON y propiedades de features

**B.1 Estructura de features**  
- Contrato GeoJSON por feature:  
  - `group`, `sub_layer`, `sub_sub_layer` (siempre valores específicos del catálogo; vienen de DB).  
  - `type`: **solo render** — `"line"` | `"point"` | `"polygon"`.  
  - `feature_type`: **negocio** — `"event"` | `"station"` (para popups, estilos, etc.).  
- Eventos y estaciones: en `buildEventsGeoJSON` (o equivalente), añadir por feature:  
  - `group`: de `event.group` (columna real).  
  - `sub_layer`, `sub_sub_layer`: de event (nunca ALL en el GeoJSON).  
  - `type`: `"point"`.  
  - `feature_type`: `"event"` o `"station"`.  
- Líneas de metro: en cada feature `group: "TRANSPORT"`, `sub_layer: "METRO"`, `sub_sub_layer: "L2"` (o el que corresponda), `type: "line"`; si aplica, `feature_type` para negocio (ej. "metro_line").

**B.2 Defaults en DB**  
- En DB no hay ALL. Si un evento no tiene sub_layer/sub_sub_layer asignados, definir un valor por defecto del catálogo (ej. sub_layer genérico del group). En cliente, “no filtrar” se traduce en no restringir sub_layer/sub_sub_layer en el filtro (lista completa o condición que incluya todos los válidos).

---

### Fase C: Sources y layers en Mapbox

**C.1 Sources por group (opción pragmática)**  
- **Opción estricta:** 1 source por group (transport_source con líneas + puntos).  
- **Opción pragmática (recomendada si el GeoJSON crece):** 1 group lógico, 2 sources físicos por geometría:  
  - `transport_lines_source`: solo LineString (metro, metrobús, etc.).  
  - `transport_points_source`: solo Point (estaciones, eventos).  
  Así se evita parsing y filtrado costoso en un solo blob enorme.  
- Nature: igual (nature_source o nature_lines / nature_points si aplica). Boundary fuera del sistema de grupos.

**C.2 Tres layers por source (line, point, polygon)**  
- Por cada source: layers según el tipo de geometría que tenga ese source (ej. transport_lines_source → solo line-layer; transport_points_source → point-layer y, si hubiera, polygon-layer). En total, como máximo 3 layers por group (line, point, polygon), repartidas en uno o dos sources.  
- Filtro base por `type` (render): `["==", ["get", "type"], "line"]` etc.  
- No crear layers por sub_layer; visibilidad por filtro maestro.

**C.3 Integración**  
- Metro líneas: GeoJSON con group, sub_layer, sub_sub_layer, `type: "line"`, `feature_type` si aplica; source = transport_lines_source.  
- Eventos y estaciones: GeoJSON con mismas propiedades, `type: "point"`, `feature_type: "event"|"station"`; source = transport_points_source. Filtro maestro aplicado en cada layer.

---

### Fase D: Control de visibilidad y filtro maestro

**D.1 Estado de visibilidad**  
- Sustituir o complementar showMetroLines/showAllLayers/showJacarandas por:  
  - `visibleGroups: Set<Group>` (ej. toggleGroup(TRANSPORT, true)).  
  - `activeSubLayers: SubLayer[]` (ej. [METRO]).  
  - `activeSubSubLayers: SubSubLayer[]` (ej. [L1, L2]).  
- Defaults: ALL cuando no se filtra (sub_layer/sub_sub_layer = ALL en filtro).

**D.2 Filtro maestro en Mapbox**  
- Por cada layer del group, el filtro debe incluir **group** para no mezclar datasets:  
  - `["==", ["get", "group"], activeGroup]`  
  - `["==", ["get", "type"], currentType]` (line|point|polygon)  
  - `["in", ["get", "sub_layer"], ["literal", activeSubLayers]]` (lista; si “todos”, pasar todos los sub_layers del group).  
  - `["in", ["get", "sub_sub_layer"], ["literal", activeSubSubLayers]]`  
- Actualizar filtros cuando cambien visibleGroups, activeSubLayers o activeSubSubLayers; no recrear layers.

**D.3 Panel / UI**  
- Cada control solo escribe en estado: `visibleGroups`, `activeSubLayers`, `activeSubSubLayers`. Nunca modificar layers/sources directamente.  
- Un toggle por group; controles por sub_layer y sub_sub_layer (multiselect/listas).  
- Mapear toggles actuales a ese estado (ej. “Líneas metro” → visibleGroups incluye TRANSPORT, activeSubLayers incluye METRO).

---

### Fase E: Migración y restricciones

**E.1 No crear layers dinámicas por sub_layer**  
- Revisar que en ningún sitio se haga addLayer por cada valor de sub_layer; solo 3 layers por source (line, point, polygon).

**E.2 Strings y catálogo**  
- En backend y en datos persistidos: solo valores del catálogo (nunca ALL). En cliente, ALL es solo para la semántica del filtro (“mostrar todos”).  
- Validación en backend rechaza valores fuera de catálogo y rechaza ALL en sub_layer/sub_sub_layer.

**E.3 Defaults**  
- En DB: valores por defecto del catálogo (específicos), nunca ALL. En cliente: “no filtrar” = usar lista completa de sub_layer/sub_sub_layer en el filtro (o expresión equivalente).

**E.4 Un group por source**  
- No mezclar TRANSPORT y NATURE en el mismo source; un source = un group.

---

## 4. Estrategia de migración (sin coexistencia)

No se usa feature flag ni doble sistema. Migración en bloque:

1. **Exportar datos**  
   - Descargar/exportar la BD actual (eventos con layer, sublayer, sublayer_detail, etc.).

2. **Nuevo esquema**  
   - Añadir columna `group` (y las que hagan falta) en `events` (y tablas que apliquen).  
   - Definir NOT NULL y defaults solo con valores del catálogo (nunca ALL).  
   - Mantener `layer` si se usa como sub_layer o deprecar según decisión (ver abajo).

3. **Backfill**  
   - Regla única de migración: por cada fila, asignar `group` desde el valor actual (ej. layer = METRO → group = TRANSPORT; layer = VEGETACION → group = NATURE; layer = DEFAULT → group según política, ej. TRANSPORT o un group “sin clasificar” del catálogo).  
   - Asegurar que sublayer y sublayer_detail queden con valores específicos del catálogo (rellenar nulls con el valor por defecto del grupo si aplica).

4. **Repoblar**  
   - Ejecutar migración (ALTER + UPDATE o script de backfill).  
   - Volver a cargar datos si hace falta (seed, import).  
   - Una sola versión del esquema en producción; no correr viejo y nuevo en paralelo.

5. **App y API**  
   - Desplegar código que ya espere `group` y el contrato type/feature_type en GeoJSON.  
   - API y cliente dejan de depender de “derivar” group; lo leen de DB.

Si se quiere mantener el nombre `layer` en DB por compatibilidad con código existente, se puede mantener como alias de sub_layer o renombrar en una migración posterior; lo importante es que `group` exista como columna real y se use en filtros y GeoJSON.

---

## 5. Orden sugerido de implementación

1. **Catálogo y enums** (A.1, A.3): catálogo en backend (sin ALL en valores persistibles); enums/const en cliente (ALL solo en lógica de filtro).  
2. **Esquema y migración** (sección 4): añadir `group` y ajustes; exportar, backfill, repoblar; una sola versión.  
3. **GeoJSON** (B.1, B.2): en features, `group`, `sub_layer`, `sub_sub_layer`, `type` (render), `feature_type` (negocio); sin ALL en datos.  
4. **Sources y layers** (C.1–C.3): transport_lines_source + transport_points_source (o 1 por group); 3 layers por tipo; filtro maestro incluyendo group.  
5. **Validación backend** (A.2): validar group y jerarquía; rechazar ALL en persistencia.  
6. **Filtro maestro y visibilidad** (D.1, D.2): estado visibleGroups, activeSubLayers, activeSubSubLayers; filtro con group + type + sub_layer + sub_sub_layer.  
7. **UI** (D.3): toggles solo actualizan ese estado; sin tocar layers/sources directamente.  
8. **Nature** (opcional): mismo patrón con NATURE y sources/layers correspondientes.

---

## 6. Puntos finos (nivel producción)

Detalles que evitan bugs silenciosos y deuda técnica una vez en producción.

**6.1 Catálogo versionado**  
- El catálogo debe exponer `version` (entero o semver). Ejemplo: `{ "version": 1, "groups": [...], "hierarchy": { ... } }`.  
- En cliente: si `catalog.version !== expectedVersion`, hacer fallback (ej. usar caché local válida) o forzar refresh. Sin versionado, cambios en backend (agregar METRO_CABLE, quitar METROBUS, renombrar) dejan clientes con enums viejos y datos inconsistentes.

**6.2 Jerarquía del catálogo en un solo objeto**  
- Evitar varios listas/mapas sueltos (groups, sub_layers, sub_sub_layers) que obliguen a validar brincando entre estructuras.  
- Forma recomendada: un único árbol group → sub_layer → sub_sub_layers. Ejemplo:
```json
{
  "version": 1,
  "hierarchy": {
    "TRANSPORT": { "METRO": ["L1", "L2"], "METROBUS": [] },
    "NATURE": { "JACARANDAS": ["ROMA"] }
  }
}
```
- Validación en un solo paso: comprobar que (group, sub_layer, sub_sub_layer) existe en ese árbol.

**6.3 Semántica de listas vacías en el filtro**  
- `activeSubLayers = []` o `activeSubSubLayers = []` debe tener **regla explícita**. En Mapbox, `["in", value, []]` → false (nada pasa el filtro).  
- Opción A: **vacío = mostrar nada**. Documentar y que la UI no envíe listas vacías cuando “mostrar todo” (usar lista llena o flag explícito).  
- Opción B: **vacío = mostrar todo**. Al construir el filtro: si la lista está vacía, no aplicar esa condición (omitir filtro de sub_layer o sub_sub_layer).  
- Decidir una regla y aplicarla siempre; si no, todo desaparece y parece bug de datos.

**6.4 Usar feature_type en toda la cadena**  
- No dejar `feature_type` solo en el GeoJSON: usarlo para estilos (event vs station), iconos, popups e interacción. Si no se usa, es complejidad sin beneficio.  
- En Mapbox: expresiones de paint/layout pueden usar `["get", "feature_type"]` para variar color, icon, etc.

**6.5 Espacio para layers futuras**  
- No diseñar el sistema de nombres ni la lógica de forma que impida añadir después: cluster (transport-point-cluster-layer), highlight, selected state (transport-point-selected-layer).  
- No implementarlos aún; solo evitar decisiones que los bloqueen (ej. asumir que “solo 3 layers por source” es rígido para siempre; se pueden añadir layers derivadas del mismo source).

**6.6 Consistencia del estado (visibleGroups vs activeSubLayers)**  
- Evitar combinaciones inválidas: ej. `visibleGroups = [TRANSPORT]` y `activeSubLayers = [JACARANDAS]` (JACARANDAS no pertenece a TRANSPORT). Resultado: filtro vacío, UI rota.  
- En cliente, al cambiar visibleGroups o al hidratar estado: filtrar activeSubLayers y activeSubSubLayers por el catálogo del group activo. Ejemplo: `activeSubLayers = activeSubLayers.filter(sl => catalog.hierarchy[group]?.[sl] !== undefined)` (o según estructura del catálogo).  
- Validar al escribir estado, no solo al leer.

**6.7 Política explícita para DEFAULT en backfill**  
- “DEFAULT → group según política” es decisión de negocio, no técnica. Debe quedar escrita.  
- Opciones posibles: (a) DEFAULT → TRANSPORT; (b) DEFAULT → grupo “UNCLASSIFIED” del catálogo; (c) eventos con DEFAULT se excluyen o se marcan para revisión.  
- Definir una regla y aplicarla en el script de backfill; no dejar “según regla” sin especificar.

---

## 7. Resumen

- **Ya tienes**: 3 niveles lógicos (layer/sublayer/sublayer_detail), constantes METRO/LINEA2/estaciones, DB y API con esas columnas, toggles de visibilidad.  
- **Falta**: columna real `group`; separación type (render) vs feature_type (negocio); contrato GeoJSON con group/sub_layer/sub_sub_layer/type/feature_type; catálogo sin ALL persistido; sources (1 o 2 por group según pragma); filtro maestro que incluya group; UI que solo escriba en visibleGroups/activeSubLayers/activeSubSubLayers; migración definida (export → schema → backfill → repoblar, sin coexistencia).  

Con los ajustes críticos (sección 0), la migración en bloque (sección 4) y los puntos finos (sección 6), el sistema queda listo para producción: sin inferir group, sin mezclar type con negocio, sin persistir ALL, con filtro por group, estado consistente, catálogo versionado y jerárquico, y política clara para DEFAULT en backfill.
