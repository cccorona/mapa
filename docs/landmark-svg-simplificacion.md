# Simplificación de SVG de landmarks

El overlay de partículas (polygon mask) se trababa porque el SVG subido era un export de **potrace** con un path enorme (miles de comandos). El plugin de tsparticles parsea y tessella el path en el main thread y eso bloquea la UI.

**Objetivo:** que el SVG del landmark tenga solo un **puñado de líneas del contorno** (path con pocos puntos) para que el polygon mask sea liviano.

---

## Opciones

### 1. Simplificar antes de subir (manual o con herramienta)

- **Inkscape:** Abrir el SVG → seleccionar path → Menú *Path* → *Simplify* (Ctrl+L). Ajustar hasta que el path tenga pocos nodos pero siga reconociendo la silueta.
- **Editor vectorial:** Redibujar solo el contorno exterior con pocos puntos (ej. un polígono de 20–50 puntos).
- **Script externo:** Usar algo como [simplify-path](https://www.npmjs.com/package/simplify-path) (Douglas-Peucker) sobre el `d` del path y volver a generar el SVG.

No requiere cambios en el backend; el usuario sube ya un SVG “ligero”.

### 2. Simplificar en el servidor al subir (recomendado)

Al recibir el SVG en `POST /api/landmarks` o `PATCH /api/landmarks/[id]`:

1. Parsear el SVG (ej. `fast-xml-parser` o leer como texto y extraer el `<path d="...">`).
2. Extraer los puntos del path (parsear comandos M, L, C, etc. a una lista de [x,y]).
3. Aplicar **Douglas-Peucker** (o similar) con una tolerancia que deje ~50–200 puntos.
4. Regenerar un path `d` con solo M y L (o L suaves) y guardar ese SVG en Storage; `icon_svg_url` apunta a este archivo simplificado.

Ventaja: todos los landmarks (nuevos y ya existentes al re-subir el SVG) quedan con SVG liviano sin que el usuario tenga que simplificar a mano.

### 3. Script one-off para el SVG actual (implementado)

En el repo está **`scripts/simplify-svg-path.mjs`**:

- **Uso:**  
  `node scripts/simplify-svg-path.mjs <entrada.svg> [salida.svg]`  
  Si no pasas salida, imprime el SVG por stdout.
- **Qué hace:** Toma el **primer** `<path d="...">` del SVG, extrae puntos (M/L/C/c/l/m/z), aplica **Douglas-Peucker** (tolerancia 80 en unidades del path) y genera un nuevo SVG con un solo path de líneas M/L y cierre Z. El resto de paths del archivo se eliminan.
- **Pasos para tu SVG potrace:**
  1. Guarda el SVG completo (el de 1024×1024, potrace, con el `<g transform="translate(0,1024) scale(0.1,-0.1)">`) en `scripts/landmark-potrace.svg`.
  2. Ejecuta:  
     `node scripts/simplify-svg-path.mjs scripts/landmark-potrace.svg scripts/landmark-contorno.svg`
  3. Sube `landmark-contorno.svg` en admin como icono SVG del landmark (o reemplaza el archivo en Storage y actualiza `icon_svg_url`).
- **Ajustar simplificación:** Edita en el script la variable `tolerance` (línea ~165). Mayor tolerancia = menos puntos y contorno más “suave”; menor = más fidelidad al original.

---

## Recomendación

- **Corto plazo:** Simplificar el SVG actual (opción 3 o Inkscape) y volver a subirlo para ese landmark. Así puedes **reactivar el overlay** y comprobar que ya no se traba.
- **Después:** Implementar opción 2 (simplificar en servidor al subir) para que cualquier SVG futuro se guarde ya simplificado.

---

## Reactivar el overlay

Cuando el SVG sea liviano:

1. En `app/page.tsx`: descomentar `setLandmarkOverlay({ name, iconUrl, iconSvgUrl })` en `handleLandmarkClick` y cambiar `false && landmarkOverlay` por `landmarkOverlay` en el render de `LandmarkParticlesOverlay`.
2. Probar haciendo clic en un landmark con SVG simplificado.

---

## Referencias

- Douglas-Peucker: reduce puntos de una polyline manteniendo la forma (tolerancia en píxeles/unidades).
- npm: `simplify-path`, `points-on-path` (para extraer puntos de un path SVG), o implementación mínima de Douglas-Peucker en ~30 líneas.
