# Esquema Completo de Investigación de Eventos

Este documento define el formato exacto para capturar eventos y poder transformarlos sin ambiguedad al modelo de la app.

## 1) Formato de entrega

- Entregar un archivo JSON con un arreglo en la raiz.
- Sin texto extra antes o despues del JSON.

```json
[
  { "...evento 1..." },
  { "...evento 2..." }
]
```

## 2) Esquema canonico de investigacion (entrada)

```json
{
  "evento": "string",
  "fecha_o_epoca": "string",
  "clasificacion": "DEATH | JOB_RESIGNATION | JOB_TERMINATION | RELATIONSHIP_END | MAJOR_DECISION | NEW_BEGINNING | RELOCATION | ACCIDENT | HEALTH_DIAGNOSIS | LEGAL_EVENT",
  "intensidad": 1,
  "descripcion": "string",
  "fuentes": [
    {
      "id": "F001",
      "tipo": "primaria | secundaria | hemerografica | archivo | oral",
      "titulo": "string",
      "autor": "string",
      "institucion": "string",
      "anio": 2024,
      "url": "https://...",
      "fecha_consulta": "YYYY-MM-DD",
      "cita_relevante": "string"
    }
  ],
  "ubicacion": {
    "nombre": "string",
    "alcaldia": "string",
    "lat": 19.4326,
    "lng": -99.1332,
    "precision": "exacta | aproximada | referencial"
  },
  "validacion": {
    "confianza": "alta | media | baja",
    "controversia": false,
    "notas_metodologicas": "string"
  },
  "metadatos": {
    "tags": ["string"],
    "investigador": "string",
    "fecha_registro": "YYYY-MM-DD"
  }
}
```

## 3) Definicion de cada campo (obligatorio/formato/reglas)

### evento
- Tipo: `string`
- Obligatorio: si
- Formato: 8 a 140 caracteres
- Uso: titulo publico del evento

### fecha_o_epoca
- Tipo: `string`
- Obligatorio: si
- Uso: fecha historica tal como se investigo (texto original)
- Formatos permitidos:
  - `DD de <mes> de YYYY` (ej. `13 de agosto de 1521`)
  - `<mes> de YYYY` (ej. `febrero de 1913`)
  - `YYYY` (ej. `1790`)
  - `YYYY - YYYY` (ej. `1737 - 1739`)
  - `Ca. YYYY a.e.c.` / `Ca. YYYY e.c.`
  - `Era Colonial`, `Prehispanica`, `Contemporanea`, etc.

### clasificacion
- Tipo: `enum string`
- Obligatorio: si
- Debe ser exactamente uno de:
  - `DEATH`
  - `JOB_RESIGNATION`
  - `JOB_TERMINATION`
  - `RELATIONSHIP_END`
  - `MAJOR_DECISION`
  - `NEW_BEGINNING`
  - `RELOCATION`
  - `ACCIDENT`
  - `HEALTH_DIAGNOSIS`
  - `LEGAL_EVENT`

### intensidad
- Tipo: `integer`
- Obligatorio: si
- Rango permitido: `1..5`

### descripcion
- Tipo: `string`
- Obligatorio: si
- Formato: 40 a 1200 caracteres
- Uso: contexto historico sintetico y verificable

### fuentes
- Tipo: `array<object>`
- Obligatorio: si
- Minimo: 1 fuente

#### fuentes[].id
- Tipo: `string`
- Obligatorio: si
- Formato recomendado: `F` + 3 digitos (ej. `F001`)

#### fuentes[].tipo
- Tipo: `enum string`
- Obligatorio: si
- Valores: `primaria | secundaria | hemerografica | archivo | oral`

#### fuentes[].titulo
- Tipo: `string`
- Obligatorio: si

#### fuentes[].autor
- Tipo: `string`
- Obligatorio: si (si no hay autor personal, usar institucion)

#### fuentes[].institucion
- Tipo: `string`
- Obligatorio: si

#### fuentes[].anio
- Tipo: `integer`
- Obligatorio: si
- Rango recomendado: `1000..2100`

#### fuentes[].url
- Tipo: `string`
- Obligatorio: recomendado (si es fuente digital)
- Formato: URL completa con `http://` o `https://`

#### fuentes[].fecha_consulta
- Tipo: `string`
- Obligatorio: si
- Formato exacto: `YYYY-MM-DD`

#### fuentes[].cita_relevante
- Tipo: `string`
- Obligatorio: si
- Uso: fragmento que respalda el dato central del evento

### ubicacion
- Tipo: `object`
- Obligatorio: si

#### ubicacion.nombre
- Tipo: `string`
- Obligatorio: si
- Uso: nombre legible del sitio

#### ubicacion.alcaldia
- Tipo: `string`
- Obligatorio: recomendado (usar `""` si no aplica)

#### ubicacion.lat
- Tipo: `number`
- Obligatorio: si
- Rango: `-90..90`

#### ubicacion.lng
- Tipo: `number`
- Obligatorio: si
- Rango: `-180..180`

#### ubicacion.precision
- Tipo: `enum string`
- Obligatorio: si
- Valores: `exacta | aproximada | referencial`

### validacion
- Tipo: `object`
- Obligatorio: si

#### validacion.confianza
- Tipo: `enum string`
- Obligatorio: si
- Valores: `alta | media | baja`

#### validacion.controversia
- Tipo: `boolean`
- Obligatorio: si
- Uso: `true` cuando hay versiones historicas contradictorias o baja certeza

#### validacion.notas_metodologicas
- Tipo: `string`
- Obligatorio: si (puede ser `""`)
- Uso: explicar criterios de triangulacion o conflicto de fuentes

### metadatos
- Tipo: `object`
- Obligatorio: si

#### metadatos.tags
- Tipo: `array<string>`
- Obligatorio: si (puede ser `[]`)
- Uso: etiquetas de busqueda/curaduria

#### metadatos.investigador
- Tipo: `string`
- Obligatorio: si

#### metadatos.fecha_registro
- Tipo: `string`
- Obligatorio: si
- Formato exacto: `YYYY-MM-DD`

## 4) Mapeo directo al modelo de la app

Cuando se inserta en la app, se transforma asi:

- `evento` -> `title`
- `clasificacion` -> `type`
- `intensidad` -> `intensity` (como string `"1"`..`"5"`)
- `descripcion` -> `description`
- `ubicacion.nombre` -> `location`
- `ubicacion.lat/lng` -> `coords.lat/lng`
- `metadatos.tags` -> `tags`
- `fecha_o_epoca` -> se conserva como texto historico
- `date` tecnico (ISO) se normaliza durante la carga

Campos tecnicos que la app exige y se derivan en carga:
- `id` (generado o provisto por lote)
- `date` (ISO `YYYY-MM-DD`)
- `excerpt` (resumen corto derivado o provisto)

## 5) Reglas de calidad de investigacion

- Todo dato critico debe tener respaldo en `fuentes`.
- Evitar afirmaciones absolutas sin cita.
- Si es leyenda/folklore, marcar `validacion.controversia = true`.
- Si no hay coordenada exacta, usar aproximada y marcar `ubicacion.precision = "aproximada"`.

## 6) Ejemplo completo valido

```json
{
  "evento": "Conquista y destruccion de Tenochtitlan",
  "fecha_o_epoca": "13 de agosto de 1521",
  "clasificacion": "DEATH",
  "intensidad": 5,
  "descripcion": "Sitio militar asimetrico que culmino con la caida de Tenochtitlan y el colapso del estado mexica.",
  "fuentes": [
    {
      "id": "F001",
      "tipo": "secundaria",
      "titulo": "Historia general de Mexico",
      "autor": "Varios autores",
      "institucion": "El Colegio de Mexico",
      "anio": 2010,
      "url": "https://example.org/fuente1",
      "fecha_consulta": "2026-02-27",
      "cita_relevante": "La ciudad cayo formalmente el 13 de agosto de 1521."
    }
  ],
  "ubicacion": {
    "nombre": "Centro Historico, Ciudad de Mexico",
    "alcaldia": "Cuauhtemoc",
    "lat": 19.4326,
    "lng": -99.1332,
    "precision": "referencial"
  },
  "validacion": {
    "confianza": "alta",
    "controversia": false,
    "notas_metodologicas": "Triangulacion con 2 fuentes secundarias y 1 cronica."
  },
  "metadatos": {
    "tags": ["conquista", "tenochtitlan", "virreinato"],
    "investigador": "Nombre Apellido",
    "fecha_registro": "2026-02-27"
  }
}
```
