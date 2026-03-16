# Explicación de las capas del mapa y opciones de lluvia, niebla, nieve y atmósfera

## Resumen: dos "modos" según el estilo del mapa

El mapa puede usar **dos tipos de efectos de precipitación** según el estilo base:

| Estilo | Lluvia / Nieve |
|--------|----------------|
| **Standard (3D)** (`mapbox://styles/mapbox/standard`) | Efectos **nativos** de Mapbox GL (partículas `setRain` / `setSnow`). Solo disponibles en este estilo. |
| **Todos los demás** (CDMX simplificado, Claro, Oscuro, Calles, Satélite, etc.) | Efectos **custom**: overlays en CSS/Three.js encima del mapa (lluvia/nieve simuladas). |

La variable que lo decide en código es `styleSupportsNativePrecipitation = mapStyle?.includes?.("mapbox/standard")` en `components/mapbox-canvas.tsx` (líneas 345 y 968).

---

## Capas del panel "Capas" (subpanel Prueba mapa)

Son **overlays que se dibujan encima del mapa** y **no dependen del estilo**. Siempre puedes usarlas en cualquier tipo de mapa.

### 1. Atmosférico (shader)

- **Qué es:** Niebla suave en los bordes del mapa + ligera "respiración" animada.
- **Implementación:** `components/atmospheric-overlay.tsx` — Three.js con un shader (GLSL) que usa `uZoom`, `uOpacity` y `uTime`.
- **Dónde activarlo:** Panel **Capas** → toggle "Atmosférico (shader)" + slider "Opac. atmosf.".
- **Comportamiento:** Funciona en **todos** los estilos (Standard, CDMX, light, dark, satélite, etc.).

### 2. Niebla (mist)

- **Qué es:** Gradientes radiales semitransparentes que dan sensación de bruma/niebla.
- **Implementación:** Div con `radial-gradient` en `components/mapbox-canvas.tsx` (aprox. líneas 1015–1027).
- **Dónde activarlo:** Panel **Capas** → "Niebla" + "Opac. niebla".
- **Comportamiento:** Funciona en **todos** los estilos.

### 3. Viñeta (vignette)

- **Qué es:** Oscurecimiento en los bordes (efecto de túnel).
- **Implementación:** Div con `radial-gradient` en el mismo bloque de overlays del canvas.
- **Dónde activarlo:** Panel **Capas** → "Viñeta" + "Opac. viñeta".
- **Comportamiento:** Funciona en **todos** los estilos.

### 4. Lluvia (rain)

- **Qué hace según el estilo:**
  - **Si el estilo es Standard:** El toggle de lluvia en el subpanel **Lluvia/Nieve** usa la API nativa `setRain()` (partículas Mapbox). La capa "Lluvia" del panel Capas no se usa para el efecto nativo.
  - **Si el estilo NO es Standard:** La lluvia se muestra con el **overlay custom** `components/rain-overlay.tsx` (varias capas CSS con `repeating-linear-gradient` y animación `rain-fall` en `app/globals.css`).
- **Cómo "hacer que llueva" en un mapa que no es Standard (p. ej. CDMX simplificado):**
  - Opción A: Panel **Capas** → activar "Lluvia" y subir "Opac. lluvia".
  - Opción B: Subpanel **Lluvia/Nieve** → activar "Lluvia" (y color si quieres). En estilos no Standard, eso también activa el overlay custom.
- Lógica en código: `showRain = (overlays.rain) || (mapboxRain.enabled && !styleSupportsNativePrecipitation)` (aprox. línea 972).

---

## Nieve: solo se controla desde Lluvia/Nieve

- **Si el estilo es Standard:** Se usa `setSnow()` nativo (partículas).
- **Si el estilo NO es Standard:** Se usa el overlay `components/snow-overlay.tsx` (capas CSS con animación `snow-fall` en `app/globals.css`).
- **Cómo "hacer que nieve" en un mapa que no es Standard:** Subpanel **Lluvia/Nieve** → activar "Nieve" (y color). No hay toggle de nieve en el panel Capas; la nieve se muestra cuando `mapboxSnow.enabled && !styleSupportsNativePrecipitation`.

---

## Opciones por objetivo (resumen)

| Objetivo | Dónde activarlo | ¿En todos los estilos? |
|----------|------------------|-------------------------|
| **Lluvia** (en estilos que no son Standard) | Capas → "Lluvia" y opacidad, **o** Lluvia/Nieve → "Lluvia" | Sí (overlay CSS). En Standard se usa lluvia nativa desde Lluvia/Nieve. |
| **Niebla / neblina** | Capas → "Niebla" y "Opac. niebla" | Sí. |
| **Nieve** (en estilos que no son Standard) | Lluvia/Nieve → "Nieve" (y color) | Sí (overlay CSS). En Standard se usa nieve nativa. |
| **Capa atmosférica** | Capas → "Atmosférico (shader)" y "Opac. atmosf." | Sí (shader Three.js). |
| **Viñeta** | Capas → "Viñeta" y "Opac. viñeta" | Sí. |

---

## Diagrama de flujo (qué se muestra según estilo y toggles)

- **Estilo Standard (3D):** Lluvia y Nieve usan partículas nativas de Mapbox (`setRain` / `setSnow`).
- **Resto de estilos:** Lluvia y Nieve usan overlays CSS custom (`RainOverlay`, `SnowOverlay`).
- **Atmosférico, Niebla, Viñeta:** siempre son los mismos overlays (shader o CSS), independientes del estilo.

Con esto puedes tener lluvia, neblina, nieve o capa atmosférica en cualquier tipo de mapa; en estilos que no son Standard, lluvia y nieve usan los overlays custom (CSS) en lugar de las partículas nativas de Mapbox.
