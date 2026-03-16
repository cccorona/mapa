# Plan: Iconografía centralizada y capas del mapa

Documento de referencia para el refactor de iconografía y capas. Ejecutar por fases.

## Objetivo

Eliminar las tres implementaciones actuales del mismo símbolo (type-icons, type-glyph, getMarkerSvg), centralizar colores, usar imágenes Mapbox en lugar de markers DOM, añadir capa de landmarks surrealistas y control por zoom. SVG como fuente de verdad; PNG como artefacto para Mapbox.

---

## Arquitectura final

```
assets
 ├ icons/              ← SVG fuente (viewBox 24x24, currentColor)
 │   vela.svg, grieta.svg, hilo.svg, puerta.svg, documento.svg, germen.svg, cruz.svg
 ├ icons-raster/       ← generado por script (vela.png, vela@2x.png, …)
 ├ landmarks/          ← PNG surrealistas (torre_latino.png, bellas_artes.png, …)
lib
 ├ constants.ts        ← EVENT_TYPE_TO_SYMBOL (event type → symbol)
 ├ icons.ts            ← getSymbolForType(), SYMBOLS, SymbolName
 ├ palette.ts          ← sepiaLight, sepiaDark, forestGreen, boneWhite (sin hex sueltos)
 ├ theme.ts            ← SYMBOL_COLORS = { vela: palette.sepiaLight, … }
components
 ├ symbol-icon.tsx     ← SymbolIcon({ name }: { name: SymbolName }, size?)
 ├ mapbox-canvas.tsx   ← capas con addImage, style.load, minzoom, orden de capas
scripts
 ├ build-icons.ts      ← SVG → PNG 1x/2x (sharp / resvg)
```

---

## Fase 1 — Centralizar iconografía

**Problema:** Tres implementaciones (type-icons.tsx 16px, type-glyph.tsx 28px, getMarkerSvg 24px).

**Acción:**

1. Crear `assets/icons/` con un SVG por símbolo: `vela.svg`, `grieta.svg`, `hilo.svg`, `puerta.svg`, `documento.svg`, `germen.svg`, `cruz.svg`.
2. **Requisitos obligatorios en cada SVG:**
   - `viewBox="0 0 24 24"`
   - `stroke="currentColor"` y `fill="none"` (o `fill="currentColor"` si es sólido)
   - `stroke-width="1.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
   - Sin colores fijos.
   - **Padding visual:** el dibujo debe caber dentro de **~20px** dentro del viewBox (área útil 20×20, padding ~2px). Regla: viewBox 24, drawing area ≈ 20, padding ≈ 2px.
3. Configurar Next/Webpack para importar SVG como componentes (ej. `@svgr/webpack` o `next-plugin-svgr`).
4. **Tipar desde una sola lista:**
   - `export const SYMBOLS = ["vela", "grieta", "hilo", "puerta", "documento", "germen", "cruz"] as const`
   - `export type SymbolName = (typeof SYMBOLS)[number]`
5. Crear `components/symbol-icon.tsx`: mapa `SYMBOL_COMPONENTS`, `SymbolIcon({ name, size = 24 })` con `name: SymbolName`.
6. Sustituir TYPE_ICONS_BY_SYMBOL y TypeGlyph por `<SymbolIcon name={…} size={16|28} />`.
7. Eliminar `lib/type-icons.tsx` y `components/type-glyph.tsx`.

---

## Fase 2 — Sistema de colores (palette + theme)

**Acción:**

1. Crear `lib/palette.ts`: tokens (sepiaLight, sepiaDark, forestGreen, boneWhite, etc.); hex solo aquí.
2. Crear `lib/theme.ts`: `SYMBOL_COLORS = { vela: palette.sepiaLight, … }`.
3. En `lib/constants.ts` mantener solo `EVENT_TYPE_TO_SYMBOL`. Color por evento: `SYMBOL_COLORS[getSymbolForType(eventType)]`.
4. UI: `<SymbolIcon name={…} style={{ color: SYMBOL_COLORS[name] }} />`.

---

## Fase 3 — Mapbox: imágenes en lugar de markers DOM

**Acción:**

1. **Pipeline raster:** `scripts/build-icons.ts` — SVG → PNG 24px y 48px con sharp; salida en `public/icons/` (vela.png, vela@2x.png).
2. **PixelRatio:** cargar PNG @2x y `map.addImage(symbol, image, { pixelRatio: 2 })`.
3. **loadImage es asíncrono:** envolver en Promise, **await** antes de addImage; **await loadMapIcons(map)** antes de **addLayers()**. Ejemplo:

```ts
const image = await new Promise<HTMLImageElement>((resolve, reject) => {
  map.loadImage(`/icons/${symbol}@2x.png`, (err, img) => {
    if (err || !img) reject(err)
    else resolve(img)
  })
})
map.addImage(symbol, image, { pixelRatio: 2 })
```

4. **Registro una sola vez:** `if (map.hasImage(symbol)) continue`; y `map.__iconsLoaded = true` tras cargar todo.
5. **Evento correcto:** usar **`map.on("style.load", ...)`** para registrar iconos, no `map.on("load")`. Al cambiar de estilo Mapbox borra las imágenes; `load` no se vuelve a disparar.
6. Sustituir markers DOM por capa `symbol` con `layout["icon-image"]: ["get", "symbol"]`; GeoJSON con `properties.symbol`.
7. `buildEventsGeoJSON`: cada punto con `symbol` según `getSymbolForType(event.type)`.
8. Eliminar `getMarkerSvg` y creación de markers DOM.

**Reglas:** Await loadImage antes de addImage y addLayers; `style.load` para registrar; hasImage + __iconsLoaded.

---

## Fase 4 — Landmarks surrealistas

**Acción:**

1. `public/landmarks.geojson`: puntos con `properties.icon` (torre_latino, bellas_artes, etc.).
2. PNG en `public/landmarks/`: **eventos 24px**, **landmarks 56px** base.
3. Nueva fuente y capa `symbol` con `"icon-image": ["get", "icon"]`.
4. **icon-size:** `["interpolate", ["linear"], ["zoom"], 10, 0.3, 15, 0.6, 18, 1]`.
5. **Opcional:** `icon-opacity` por zoom (14→0.6, 17→1) para que los landmarks “aparezcan”.
6. Semántica: eventos → `symbol`; landmarks → `icon`. Dos capas, dos GeoJSON.
7. **Opcional:** lazy load de iconos landmarks cuando zoom ≥ 15.

---

## Fase 5 — minzoom y orden de capas

**minzoom:**

- Metro: `9`
- Eventos: `12`
- Landmarks: `15`

**Orden de capas (de abajo a arriba):**

1. Metro lines  
2. Event points  
3. Landmarks  
4. Labels (si existen)

Añadir capas con `map.addLayer(...)` en ese orden (o `beforeId`).

---

## Fase 6 — Sprite atlas (opcional)

Con < 20 iconos y HTTP/2 suele bastar con loadImage. Cuando haya 30+ iconos, usar `@mapbox/spritezero` para sprite.png + sprite.json. Con sprites no se pueden añadir iconos dinámicamente después.

---

## Resumen de eliminaciones

| Antes                      | Después                                |
| -------------------------- | -------------------------------------- |
| type-icons.tsx             | SymbolIcon desde assets/icons          |
| type-glyph.tsx             | SymbolIcon desde assets/icons          |
| getMarkerSvg + markers DOM | Capa symbol + PNG desde pipeline       |
| Colores en 3 sitios        | palette + theme.SYMBOL_COLORS          |

---

## Checklist de implementación

- [x] Fase 1: SVGs en assets/icons (padding visual 20px), SYMBOLS + SymbolName, SymbolIcon, sustituir type-icons/type-glyph, borrar archivos viejos.
- [x] Fase 2: palette.ts, theme.ts, constants solo EVENT_TYPE_TO_SYMBOL, color vía SYMBOL_COLORS[getSymbolForType(…)].
- [x] Fase 3: build-icons.ts, await loadMapIcons antes de addLayers, pixelRatio: 2, hasImage, **style.load**, capa symbol eventos, GeoJSON con symbol.
- [x] Fase 4: landmarks.geojson, imágenes 56px, capa landmarks, icon-size por zoom, (opcional) icon-opacity y lazy load.
- [x] Fase 5: minzoom 9/12/15, orden de capas metro → eventos → landmarks → labels.
- [ ] Fase 6: dejar para cuando > ~30 iconos.
