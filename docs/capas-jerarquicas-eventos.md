# Capas jerárquicas para eventos (modelo extensible)

## Objetivo

Asignar eventos a **capas** con tres niveles jerárquicos (`layer`, `sublayer`, `sublayer_detail`) para filtrar en el mapa y mostrar en el popup de estación. El modelo debe ser **genérico y extensible**: no solo transporte (metro), sino cualquier tipo de capa (Metrobús, vegetación, etc.).

---

## Modelo de 3 niveles (extensible)

Tres campos en datos y BD, **sin normalizar nombres**; valores cerrados/enums o códigos configurables por dominio.

| Nivel | Ejemplo Metro | Ejemplo Metrobús | Ejemplo Vegetación |
|-------|----------------|------------------|--------------------|
| **layer** | `METRO` | `METROBUS` | `VEGETACION` |
| **sublayer** | `LINEA2` | (ej. línea troncal) | (ej. tipo de zona) |
| **sublayer_detail** | `TASQUENA` | (ej. estación) | (ej. parque/área) |

- Si no se especifica layer → `DEFAULT`.
- **Mismo modelo** para cualquier dominio: transporte (metro, metrobús), medio ambiente (vegetación), futuras capas del mapa, etc.
- Las “capas adicionales en el mapa” (p. ej. una capa “Vegetación” o “Metrobús”) reutilizan estos tres niveles: se filtran eventos por `layer`/`sublayer`/`sublayer_detail` y se muestran cuando esa capa está activa.

---

## Requisitos de extensibilidad

1. **Dominios múltiples:** El mismo esquema sirve para METRO, METROBUS, VEGETACION o cualquier otra capa; no hardcodear solo “metro”.
2. **Configuración por layer:** Cada `layer` puede tener su propio mapa de sublayer/sublayer_detail (estaciones, parques, etc.); en código, config o constantes ampliables.
3. **Capas del mapa:** Cualquier “capa adicional” en el panel del mapa (vegetación, metrobús, etc.) usa el mismo modelo: filtro por `layer` (+ opcionalmente sublayer/sublayer_detail) y visibilidad según toggle de capa.

---

## Implementación (resumen)

- **BD:** Columnas `layer`, `sublayer`, `sublayer_detail` en `events`; default `layer = 'DEFAULT'`.
- **Tipos/config:** `lib/event-layers.ts` (o similar): tipos para los 3 niveles y mapas de configuración por layer (extensibles).
- **Admin:** Al asignar “estación” (o cualquier entidad), enviar `layer`, `sublayer`, `sublayer_detail` además de lat/lng y `location_label`.
- **Mapa:** Filtrar eventos por layer/sublayer/sublayer_detail según la capa activa; popup de estación/entidad mostrando eventos que coinciden con esos códigos.
- **Futuro:** Añadir una nueva “capa en el mapa” (p. ej. Vegetación) = añadir valores de layer/sublayer/detail en config y un toggle que filtre por ellos.

---

## Ejemplos de uso del mismo modelo

| Capa en el mapa | layer | sublayer | sublayer_detail |
|-----------------|-------|----------|-----------------|
| Metro L2        | `METRO` | `LINEA2` | `TASQUENA` |
| Metrobús       | `METROBUS` | (línea) | (estación) |
| Vegetación     | `VEGETACION` | (tipo) | (parque/área) |

Un solo modelo, mismos tres campos; cada dominio define sus propios valores en configuración.

---

## Implementado (Metro)

- **Migración:** `supabase/migrations/010_event_layers.sql` — columnas `layer` (default `'DEFAULT'`), `sublayer`, `sublayer_detail`; `get_events_in_bounds` y `update_event_location` las devuelven/aceptan; `update_event_layers` para cambiar solo capas (p. ej. pasar a DEFAULT).
- **Config Metro:** `lib/event-layers.ts` — METRO → LINEA2 → códigos de estación L2 (ej. TASQUENA); `getStationCodeForName`, `eventMatchesStation`, `isEventInMetroLayer`.
- **Admin:** En Editar, se muestra la capa actual y se puede elegir "Por defecto" o "Metro (Línea 2)" + estación; "Guardar ubicación" asigna coords + layer/sublayer/sublayer_detail; "Pasar a capa por defecto" llama a `PATCH .../layers` con `layer: 'DEFAULT'`.
- **Mapa:** Con "Solo metro" activo se muestran solo eventos con `layer === 'METRO'`. Al abrir el popup de una estación L2 se filtran eventos por METRO/LINEA2/código de estación y se listan en el popup.
