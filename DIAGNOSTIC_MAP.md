# Diagnóstico de carga del mapa

## Estado

- Logging añadido en `components/mapbox-canvas.tsx`.
- La app responde correctamente (HTTP 200 en el puerto del dev server).

## Qué revisar en la consola del navegador

1. Ejecuta `npm run dev` y abre la app (por ejemplo `http://localhost:3000`).
2. Abre DevTools (F12) > pestaña **Console**.
3. Busca mensajes con prefijo `[Mapbox]`:

   | Mensaje                | Significado                                           |
   |------------------------|-------------------------------------------------------|
   | `init check: { hasToken, hasContainer, width, height }` | Estado al montar el mapa. Revisa si `hasToken` es true, si `width` y `height` son > 0. |
   | `creating Map instance...` | Se va a crear la instancia de Mapbox.                |
   | `load OK`              | El mapa cargó correctamente.                          |
   | `error: ...`           | Error reportado por Mapbox. Revisa el mensaje.        |
   | `init failed: ...`     | Excepción durante la inicialización.                  |

4. Anota cualquier error en rojo o warning relacionado con Mapbox.

## Próximos pasos según lo que veas

- **`width: 0, height: 0`** → Contenedor sin tamaño. Usar `ResizeObserver` y retrasar la inicialización hasta tener dimensiones válidas.
- **Error SSR / `window` o `self` no definido** → Cargar `MapboxCanvas` con `next/dynamic` y `ssr: false`.
- **Error 401 o de token** → Revisar `NEXT_PUBLIC_MAPBOX_TOKEN` en `.env.local`.
- **`load OK` pero mapa en blanco** → Posible problema de CSS o del estilo de Mapbox.

## Mapbox GL JS v3

- Proyecto usa `mapbox-gl@3.19.0` (v3).
- Estilo `mapbox://styles/mapbox/dark-v11` es un estilo clásico y sigue soportado en v3.
- Opcional: para usar Mapbox Standard (`mapbox://styles/mapbox/standard`) cambiar la opción `style` en el constructor del mapa.
