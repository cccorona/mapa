import type { MetroStation, MetroStory } from "@/types/metro"

export const METRO_STATIONS: MetroStation[] = [
  { id: "st-1", name: "Observatorio", line: "1", coords: { lat: 19.3582, lng: -99.2185 } },
  { id: "st-2", name: "Balderas", line: "1", coords: { lat: 19.4269, lng: -99.1558 } },
  { id: "st-3", name: "Pino Suárez", line: "1", coords: { lat: 19.4253, lng: -99.1333 } },
  { id: "st-4", name: "Pantitlán", line: "1", coords: { lat: 19.4157, lng: -99.0722 } },
  { id: "st-5", name: "Cuatro Caminos", line: "2", coords: { lat: 19.4610, lng: -99.1405 } },
  { id: "st-6", name: "Zócalo", line: "2", coords: { lat: 19.4326, lng: -99.1332 } },
  { id: "st-7", name: "Tasqueña", line: "2", coords: { lat: 19.3290, lng: -99.1420 } },
  { id: "st-8", name: "Centro Médico", line: "3", coords: { lat: 19.4065, lng: -99.1552 } },
  { id: "st-9", name: "Universidad", line: "3", coords: { lat: 19.3240, lng: -99.2000 } },
]

export const METRO_STORIES: MetroStory[] = [
  {
    id: "ms-1",
    stationId: "st-2",
    line: "1",
    title: "El adiós en Balderas",
    excerpt: "La última vez que nos vimos fue en el andén de Balderas, sin saber que sería la última.",
    description:
      "La última vez que nos vimos fue en el andén de Balderas, sin saber que sería la última. El tren se llevó a una de nosotras al norte y a la otra al sur. El andén quedó vacío, y desde entonces cada vez que paso por ahí siento que el tiempo se detuvo en ese instante.",
    date: "2020-03-15",
    coords: { lat: 19.4269, lng: -99.1558 },
    tags: ["despedida", "metrópoli", "rumbo"],
  },
  {
    id: "ms-2",
    stationId: "st-6",
    line: "2",
    title: "El músico bajo el Zócalo",
    excerpt: "Escuché un acordeón en el pasillo que conecta las líneas. Nunca lo volví a oír.",
    description:
      "Escuché un acordeón en el pasillo que conecta las líneas. Nunca lo volví a oír. La melodía se coló entre el rumor de pasos y el silbido del tren. Durante años busqué esa canción en grabaciones, en tianguis, en estaciones. No existe. O existe solo en ese recuerdo.",
    date: "2018-11-22",
    coords: { lat: 19.4326, lng: -99.1332 },
    tags: ["música", "búsqueda", "irrecuperable"],
  },
  {
    id: "ms-3",
    stationId: "st-8",
    line: "3",
    title: "La espera en Centro Médico",
    excerpt: "Esperé tres horas en el andén. La noticia llegó por teléfono antes de que llegara el tren.",
    description:
      "Esperé tres horas en el andén. La noticia llegó por teléfono antes de que llegara el tren. El nombre de la estación quedó asociado para siempre a ese momento: la pantalla del móvil, el silencio del túnel, la voz que decía que ya no hacía falta que siguiera esperando.",
    date: "2021-07-08",
    coords: { lat: 19.4065, lng: -99.1552 },
    tags: ["espera", "noticia", "umbral"],
  },
]
