"use client"

import { useState, memo, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { ObservationEvent } from "@/lib/data"
import { EVENT_TYPES as DOMAIN_TYPES, EMOTIONAL_INTENSITY_SCALE } from "@/lib/constants"
import { getSymbolForType } from "@/lib/icons"
import { SymbolIcon } from "@/components/symbol-icon"
import type { MapConfig, ArtisticMode, LightPreset } from "@/lib/map-config"
import { ARTISTIC_PRESETS, DEFAULT_MAP_CONFIG, exportMapConfig } from "@/lib/map-config"

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

function formatDateSafe(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  return `${String(day).padStart(2, "0")} de ${MONTHS_ES[month - 1]} de ${year}`
}

const EVENT_TYPES = [
  { value: "all", label: "Todos los tipos" },
  ...DOMAIN_TYPES.map((t) => ({ value: t.value, label: t.label })),
]

const INTENSITY_LEVELS = [
  { value: "all", label: "Toda intensidad" },
  ...EMOTIONAL_INTENSITY_SCALE.map((i) => ({ value: i.value, label: i.level })),
]

const MAP_STYLES = [
  { value: "mapbox://styles/ccoronacesar/cmmqs03ui008e01s1028b1h27", label: "CDMX simplificado" },
  { value: "mapbox://styles/mapbox/standard", label: "Standard (3D)" },
  { value: "mapbox://styles/mapbox/light-v11", label: "Claro" },
  { value: "mapbox://styles/mapbox/dark-v11", label: "Oscuro" },
  { value: "mapbox://styles/mapbox/streets-v12", label: "Calles" },
  { value: "mapbox://styles/mapbox/outdoors-v12", label: "Exterior" },
  { value: "mapbox://styles/mapbox/satellite-v9", label: "Satélite" },
  { value: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satélite + calles" },
]

const PROJECTION_MODES = [
  { value: "mercator" as const, label: "Plano (Mercator)" },
  { value: "globe" as const, label: "Globo 3D" },
]

const LIGHT_PRESETS: { value: LightPreset; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "dawn", label: "Amanecer" },
  { value: "dusk", label: "Atardecer" },
  { value: "night", label: "Noche" },
]

const SOUL_ORB_COLORS = [
  { value: "#050505", label: "Negro (alma)" },
  { value: "#1f1f2e", label: "Índigo oscuro" },
  { value: "#2d1a1a", label: "Borgoña oscura" },
]

const ARTISTIC_MODES: { value: ArtisticMode; label: string }[] = [
  { value: "none", label: "Sin filtro" },
  { value: "varo", label: "Remedios Varo" },
  { value: "carrington", label: "Leonora Carrington" },
  { value: "goya", label: "Goya" },
]

const POPUP_PRESETS = {
  etereo: {
    titleSize: 23,
    bodySize: 18,
    metaSize: 11,
    backdropOpacity: 48,
    veilOpacity: 100,
    panelGlow: 88,
    blurIn: 3,
    animDuration: 900,
  },
  legible: {
    titleSize: 24,
    bodySize: 19,
    metaSize: 12,
    backdropOpacity: 34,
    veilOpacity: 70,
    panelGlow: 52,
    blurIn: 1,
    animDuration: 620,
  },
  balanceado: {
    titleSize: 22,
    bodySize: 17,
    metaSize: 11,
    backdropOpacity: 40,
    veilOpacity: 100,
    panelGlow: 70,
    blurIn: 2,
    animDuration: 760,
  },
} as const

interface MapPanelProps {
  events: ObservationEvent[]
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
  filters: {
    type: string
    intensity: string
    showDensity: boolean
    showMetroLines: boolean
    showAllLayers?: boolean
    /** Dominios del catálogo visibles en el mapa (code -> visible). */
    visibleGroups?: Record<string, boolean>
    dateFrom: string
    dateTo: string
  }
  onFilterChange: (key: string, value: string | boolean | Record<string, boolean>) => void
  /** Lista de layer_geodata por grupo (id, name) para sub-toggles. */
  layerGeodataByGroup?: Record<string, { id: string; name: string; type: string }[]>
  /** Visibilidad por grupo y layer_geodata id para sub-toggles. */
  visibleLayerGeodata?: Record<string, Record<string, boolean>>
  onVisibleLayerGeodataChange?: (groupCode: string, layerGeodataId: string, visible: boolean) => void
  /** Capas del estilo Mapbox con id escenografia-* para toggles. */
  escenografiaLayers?: { id: string }[]
  escenografiaVisible?: Record<string, boolean>
  onEscenografiaChange?: (visible: Record<string, boolean>) => void
  mapConfig?: MapConfig
  onMapConfigChange?: (config: MapConfig) => void
  showMapTestPanel?: boolean
  isPrd?: boolean
}

const MapPanelInner = ({
  events,
  selectedEventId,
  onSelectEvent,
  collapsed,
  onToggleCollapse,
  filters,
  onFilterChange,
  layerGeodataByGroup = {},
  visibleLayerGeodata = {},
  onVisibleLayerGeodataChange,
  mapConfig,
  onMapConfigChange,
  escenografiaLayers = [],
  escenografiaVisible = {},
  onEscenografiaChange,
  showMapTestPanel = false,
  isPrd = false,
}: MapPanelProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("filtros")
  const [expandedTestSubpanel, setExpandedTestSubpanel] = useState<string | null>(null)
  const [catalogGroups, setCatalogGroups] = useState<{ code: string; name: string }[]>([])

  useEffect(() => {
    fetch("/api/layer-catalog")
      .then((r) => r.json())
      .then((c: { hierarchy?: Record<string, unknown>; groups?: { code: string; name: string }[] }) => {
        if (c?.groups && Array.isArray(c.groups)) {
          setCatalogGroups(c.groups)
        } else {
          const h = c?.hierarchy
          if (h && typeof h === "object") {
            setCatalogGroups(Object.keys(h).map((code) => ({ code, name: code })))
          }
        }
      })
      .catch(() => {})
  }, [])

  const filteredEvents = events.filter((e) => {
    if (filters.type !== "all" && e.type !== filters.type) return false
    if (filters.intensity !== "all" && e.intensity !== filters.intensity) return false
    return true
  })
  const boundaryGlowConfig = mapConfig?.boundaryGlow ?? DEFAULT_MAP_CONFIG.boundaryGlow

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full transition-all duration-500 ease-in-out overflow-hidden",
        "border-r border-[var(--panel-border)]",
        collapsed ? "w-14" : "w-full"
      )}
      style={{ background: "var(--panel-bg)" }}
      aria-label="Panel de observaciones"
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          "absolute top-5 z-10 flex items-center justify-center w-7 h-7 rounded-full",
          "border border-[var(--panel-border)] bg-[var(--panel-bg)]",
          "text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)]",
          "transition-all duration-300",
          collapsed ? "right-3" : "right-3"
        )}
        aria-label={collapsed ? "Expandir panel" : "Colapsar panel"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cn("transition-transform duration-500", collapsed ? "rotate-180" : "")}
          aria-hidden
        >
          <polyline points="8,3 4,6 8,9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Collapsed state – vertical label */}
      {collapsed && (
        <div className="flex flex-col items-center pt-16 gap-6 h-full">
          <span
            className="text-[var(--parchment-dim)] text-xs tracking-[0.25em] uppercase"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            Observaciones
          </span>
          <div className="w-px flex-1 bg-[var(--panel-border)] mt-4" />
          <span className="text-[var(--parchment-dim)] font-mono text-[12px] pb-6">
            {filteredEvents.length}
          </span>
        </div>
      )}

      {/* Expanded content */}
      {!collapsed && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="px-6 pt-7 pb-5 border-b border-[var(--panel-border)] flex-shrink-0">
            <div className="flex items-center gap-3 mb-1">
              {/* Glyph mark */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="8" stroke="var(--sepia)" strokeWidth="0.8" opacity="0.6" />
                <circle cx="10" cy="10" r="3" stroke="var(--parchment)" strokeWidth="0.8" opacity="0.4" />
                <line x1="10" y1="2" x2="10" y2="18" stroke="var(--parchment)" strokeWidth="0.5" opacity="0.2" />
                <line x1="2" y1="10" x2="18" y2="10" stroke="var(--parchment)" strokeWidth="0.5" opacity="0.2" />
              </svg>
              <h1 className="text-[var(--parchment)] font-serif text-lg font-medium leading-tight tracking-wide">
                Mapa de Observaciones
              </h1>
            </div>
            <p className="text-[var(--parchment-dim)] font-mono text-[12px] tracking-[0.15em] uppercase ml-8">
              Cartografía de momentos irreversibles
            </p>
            <div className="mt-4 ml-8 flex flex-wrap gap-4">
              <a
                href="/events/new"
                className="font-mono text-[12px] tracking-[0.15em] uppercase text-[var(--primary)] hover:text-[var(--parchment)] transition-colors"
              >
                + Registrar observación
              </a>
              {!isPrd && (
                <a
                  href="/admin"
                  className="font-mono text-[12px] tracking-[0.15em] uppercase text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
                >
                  Moderación
                </a>
              )}
            </div>
          </header>

          {/* Filters section */}
          <div className="flex-shrink-0 border-b border-[var(--panel-border)]">
            <button
              className="w-full flex items-center justify-between px-6 py-3 text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
              onClick={() => setExpandedSection(expandedSection === "filtros" ? null : "filtros")}
              aria-expanded={expandedSection === "filtros"}
            >
              <span className="font-mono text-[12px] tracking-[0.2em] uppercase">Filtros</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className={cn("transition-transform duration-300", expandedSection === "filtros" ? "rotate-180" : "")}
                aria-hidden
              >
                <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {expandedSection === "filtros" && (
              <div className="px-6 pb-5 space-y-4">
                {/* Type filter */}
                <div>
                  <label className="block font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                    Tipo de evento
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {EVENT_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => onFilterChange("type", t.value)}
                        className={cn(
                          "px-2.5 py-1 text-[12px] font-mono tracking-wide rounded-sm border transition-all duration-200",
                          filters.type === t.value
                            ? "border-[var(--sepia)] text-[var(--parchment)] bg-[var(--sepia)]/10"
                            : "border-[var(--panel-border)] text-[var(--parchment-dim)] hover:border-[var(--sepia)]/50 hover:text-[var(--parchment)]"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intensity filter */}
                <div>
                  <label className="block font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                    Intensidad emocional
                  </label>
                  <div className="flex gap-1.5">
                    {INTENSITY_LEVELS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => onFilterChange("intensity", l.value)}
                        className={cn(
                          "flex-1 py-1 text-[12px] font-mono tracking-wide rounded-sm border transition-all duration-200",
                          filters.intensity === l.value
                            ? "border-[var(--primary)] text-[var(--parchment)] bg-[var(--primary)]/10"
                            : "border-[var(--panel-border)] text-[var(--parchment-dim)] hover:border-[var(--primary)]/40"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-1.5">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => onFilterChange("dateFrom", e.target.value)}
                      className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[12px] focus:outline-none focus:border-[var(--sepia)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-1.5">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => onFilterChange("dateTo", e.target.value)}
                      className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[12px] focus:outline-none focus:border-[var(--sepia)] transition-colors"
                    />
                  </div>
                </div>

                {/* Density toggle */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] tracking-[0.12em] text-[var(--parchment-dim)]">
                    Mostrar densidad
                  </span>
                  <button
                    role="switch"
                    aria-checked={filters.showDensity}
                    onClick={() => onFilterChange("showDensity", !filters.showDensity)}
                    className={cn(
                      "relative w-8 h-4 rounded-full border transition-all duration-300",
                      filters.showDensity
                        ? "border-[var(--primary)] bg-[var(--primary)]/20"
                        : "border-[var(--panel-border)] bg-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                        filters.showDensity
                          ? "left-4 bg-[var(--primary)]"
                          : "left-0.5 bg-[var(--panel-border)]"
                      )}
                    />
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* Capas: toggles desde BD (layer_groups) */}
          <div className="flex-shrink-0 border-b border-[var(--panel-border)]">
              <button
                className="w-full flex items-center justify-between px-6 py-3 text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
                onClick={() => setExpandedSection(expandedSection === "capas" ? null : "capas")}
                aria-expanded={expandedSection === "capas"}
              >
                <span className="font-mono text-[12px] tracking-[0.2em] uppercase">Capas</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={cn("transition-transform duration-300", expandedSection === "capas" ? "rotate-180" : "")}
                  aria-hidden
                >
                  <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {expandedSection === "capas" && (
                <div className="px-6 pb-5 space-y-3">
                  {catalogGroups.map(({ code, name }) => {
                    const visible = filters.visibleGroups?.[code] ?? false
                    const layerGeodataItems = layerGeodataByGroup[code] ?? []
                    return (
                      <div key={code} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[12px] tracking-[0.12em] text-[var(--parchment-dim)] flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="flex-shrink-0">
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" />
                              <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor">M</text>
                            </svg>
                            {name}
                          </span>
                          <button
                            role="switch"
                            aria-checked={visible}
                            onClick={() =>
                              onFilterChange("visibleGroups", {
                                ...filters.visibleGroups,
                                [code]: !visible,
                              })
                            }
                            className={cn(
                              "relative w-8 h-4 rounded-full border transition-all duration-300 flex-shrink-0",
                              visible ? "border-[var(--primary)] bg-[var(--primary)]/20" : "border-[var(--panel-border)] bg-transparent"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                                visible ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                              )}
                            />
                          </button>
                        </div>
                        {visible && layerGeodataItems.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            {layerGeodataItems.map((item) => {
                              const subVisible = visibleLayerGeodata[code]?.[item.id] ?? true
                              return (
                                <label
                                  key={item.id}
                                  className="flex items-center gap-2 cursor-pointer group"
                                >
                                  <input
                                    type="checkbox"
                                    checked={subVisible}
                                    onChange={() => onVisibleLayerGeodataChange?.(code, String(item.id), !subVisible)}
                                    className="w-3.5 h-3.5 rounded border-[var(--panel-border)] bg-transparent text-[var(--primary)] focus:ring-[var(--primary)]/30"
                                  />
                                  <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--parchment-dim)] truncate group-hover:text-[var(--parchment)]">
                                    {item.name}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          {/* Escenografía: capas del estilo Mapbox con id escenografia-* */}
          <div className="flex-shrink-0 border-b border-[var(--panel-border)]">
              <button
                className="w-full flex items-center justify-between px-6 py-3 text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
                onClick={() => setExpandedSection(expandedSection === "escenografia" ? null : "escenografia")}
                aria-expanded={expandedSection === "escenografia"}
              >
                <span className="font-mono text-[12px] tracking-[0.2em] uppercase">Escenografía</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={cn("transition-transform duration-300", expandedSection === "escenografia" ? "rotate-180" : "")}
                  aria-hidden
                >
                  <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {expandedSection === "escenografia" && (
                <div className="px-6 pb-5 space-y-3">
                  {escenografiaLayers.map((layer) => {
                    const visible = escenografiaVisible[layer.id] ?? false
                    const label = layer.id.replace(/^escenografia-/, "") || layer.id
                    return (
                      <div key={layer.id} className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[12px] tracking-[0.12em] text-[var(--parchment-dim)] flex items-center gap-2">
                          {label}
                        </span>
                        <button
                          role="switch"
                          aria-checked={visible}
                          onClick={() =>
                            onEscenografiaChange?.({
                              ...escenografiaVisible,
                              [layer.id]: !visible,
                            })
                          }
                          className={cn(
                            "relative w-8 h-4 rounded-full border transition-all duration-300 flex-shrink-0",
                            visible ? "border-[var(--primary)] bg-[var(--primary)]/20" : "border-[var(--panel-border)] bg-transparent"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                              visible ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                            )}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          {/* Prueba mapa - oculto por diseño; capas dinámicas desde catálogo */}
          {false && showMapTestPanel && mapConfig && onMapConfigChange && (
            <div className="flex-shrink-0 border-b border-[var(--panel-border)]">
              <button
                className="w-full flex items-center justify-between px-6 py-3 text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
                onClick={() => setExpandedSection(expandedSection === "prueba-mapa" ? null : "prueba-mapa")}
                aria-expanded={expandedSection === "prueba-mapa"}
              >
                <span className="font-mono text-[12px] tracking-[0.2em] uppercase">Prueba mapa</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={cn("transition-transform duration-300", expandedSection === "prueba-mapa" ? "rotate-180" : "")}
                  aria-hidden
                >
                  <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {expandedSection === "prueba-mapa" && mapConfig && onMapConfigChange && (
                <>
                  <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-[var(--panel-border)] flex-wrap">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] tracking-[0.12em] text-[var(--parchment-dim)]">
                        Mostrar todo (metro + eventos)
                      </span>
                      <button
                        role="switch"
                        aria-checked={filters.showAllLayers ?? false}
                        onClick={() => onFilterChange("showAllLayers", !(filters.showAllLayers ?? false))}
                        className={cn(
                          "relative w-8 h-4 rounded-full border transition-all duration-300 flex-shrink-0",
                          filters.showAllLayers
                            ? "border-[var(--primary)] bg-[var(--primary)]/20"
                            : "border-[var(--panel-border)] bg-transparent"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                            filters.showAllLayers ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                          )}
                        />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const json = exportMapConfig(mapConfig)
                        const blob = new Blob([json], { type: "application/json" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = `mapa-config-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="py-1.5 px-3 border border-[var(--sepia)]/50 rounded-sm font-mono text-[10px] text-[var(--parchment)] hover:bg-[var(--sepia)]/10 transition-colors"
                    >
                      Guardar parámetros
                    </button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {(["estilo", "capas", "borde", "lluvia-nieve", "orbe", "filtro", "popup", "particulas"] as const).map((id) => (
                      <div key={id} className="border-b border-[var(--panel-border)]">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-6 py-3 text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
                          onClick={() => setExpandedTestSubpanel(expandedTestSubpanel === id ? null : id)}
                          aria-expanded={expandedTestSubpanel === id}
                        >
                          <span className="font-mono text-[11px] tracking-[0.15em] uppercase">
                            {id === "estilo" && "Estilo y vista"}
                            {id === "capas" && "Capas"}
                            {id === "borde" && "Borde CDMX"}
                            {id === "lluvia-nieve" && "Lluvia / Nieve"}
                            {id === "orbe" && "Orbe alma"}
                            {id === "filtro" && "Filtro"}
                            {id === "popup" && "Popup / lectura"}
                            {id === "particulas" && "Partículas"}
                          </span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            className={cn("transition-transform duration-300", expandedTestSubpanel === id ? "rotate-180" : "")}
                            aria-hidden
                          >
                            <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {expandedTestSubpanel === id && (
                          <div className="px-6 pb-4 space-y-4">
                            {id === "estilo" && (
                              <>
                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                      Estilo base
                    </label>
                    <select
                      value={mapConfig.style}
                      onChange={(e) => onMapConfigChange({ ...mapConfig, style: e.target.value })}
                      className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[12px] focus:outline-none focus:border-[var(--sepia)]"
                    >
                      {MAP_STYLES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                      Proyección
                    </label>
                    <select
                      value={mapConfig.projection}
                      onChange={(e) =>
                        onMapConfigChange({
                          ...mapConfig,
                          projection: e.target.value as "mercator" | "globe",
                        })
                      }
                      className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[10px] focus:outline-none focus:border-[var(--sepia)]"
                    >
                      {PROJECTION_MODES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {mapConfig.projection === "globe" && (
                      <p className="mt-1 font-mono text-[9px] text-[var(--parchment-dim)] opacity-70">
                        Aleja el zoom para ver el globo (visible con zoom &lt; 5)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                      Presets
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        onMapConfigChange({
                          ...mapConfig,
                          style: "mapbox://styles/mapbox/standard",
                          projection: "mercator",
                          zoom: mapConfig.zoom,
                          pitch: 50,
                          standardConfig: { lightPreset: "day", show3dObjects: true },
                        })
                      }
                      className="w-full py-2 px-3 border border-[var(--panel-border)] rounded-sm font-mono text-[10px] text-[var(--parchment-dim)] hover:border-[var(--sepia)] hover:text-[var(--parchment)] transition-colors"
                    >
                      Vista 3D ciudad
                    </button>
                  </div>

                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                      Zoom: {(mapConfig.zoom ?? 11).toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min={mapConfig.projection === "globe" ? 3 : 8}
                      max={18}
                      step={0.5}
                      value={mapConfig.zoom ?? 11}
                      onChange={(e) =>
                        onMapConfigChange({ ...mapConfig, zoom: Number(e.target.value) })
                      }
                      className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                    />
                  </div>

                  {mapConfig.style.includes("standard") && (
                    <div className="pt-2 border-t border-[var(--panel-border)]">
                      <span className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-3">
                        3D / Standard
                      </span>
                      <div className="space-y-2">
                        <div>
                          <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-1">Luz</label>
                          <select
                            value={mapConfig.standardConfig?.lightPreset ?? "day"}
                            onChange={(e) =>
                              onMapConfigChange({
                                ...mapConfig,
                                standardConfig: {
                                  ...(mapConfig.standardConfig ?? { lightPreset: "day", show3dObjects: true }),
                                  lightPreset: e.target.value as LightPreset,
                                },
                              })
                            }
                            className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[10px] focus:outline-none focus:border-[var(--sepia)]"
                          >
                            {LIGHT_PRESETS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Objetos 3D</span>
                          <button
                            role="switch"
                            aria-checked={mapConfig.standardConfig?.show3dObjects ?? true}
                            onClick={() =>
                              onMapConfigChange({
                                ...mapConfig,
                                standardConfig: {
                                  ...(mapConfig.standardConfig ?? { lightPreset: "day", show3dObjects: true }),
                                  show3dObjects: !(mapConfig.standardConfig?.show3dObjects ?? true),
                                },
                              })
                            }
                            className={cn(
                              "relative w-8 h-4 rounded-full border transition-all duration-300",
                              mapConfig.standardConfig?.show3dObjects ?? true
                                ? "border-[var(--primary)] bg-[var(--primary)]/20"
                                : "border-[var(--panel-border)] bg-transparent"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                                mapConfig.standardConfig?.show3dObjects ?? true
                                  ? "left-4 bg-[var(--primary)]"
                                  : "left-0.5 bg-[var(--panel-border)]"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                      Estilo artístico
                    </label>
                    <select
                      value={mapConfig.artisticMode}
                      onChange={(e) => {
                        const mode = e.target.value as ArtisticMode
                        const preset = ARTISTIC_PRESETS[mode]
                        onMapConfigChange({
                          ...mapConfig,
                          artisticMode: mode,
                          filter: preset ? { ...preset } : { ...mapConfig.filter },
                        })
                      }}
                      className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[10px] focus:outline-none focus:border-[var(--sepia)]"
                    >
                      {ARTISTIC_MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                      Pitch: {mapConfig.pitch}°
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={mapConfig.pitch}
                      onChange={(e) => onMapConfigChange({ ...mapConfig, pitch: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-2">
                      Bearing: {mapConfig.bearing}°
                    </label>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={mapConfig.bearing}
                      onChange={(e) => onMapConfigChange({ ...mapConfig, bearing: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                    />
                  </div>
                              </>
                            )}
                            {id === "capas" && (
                              <>
                    <span className="block font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] mb-3">
                      Capas
                    </span>
                    <details className="mb-3 group">
                      <summary className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--parchment-dim)] cursor-pointer list-none flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                        <span className="transition-transform group-open:rotate-90">›</span>
                        Ayuda: qué es cada capa
                      </summary>
                      <div className="mt-2 pl-4 border-l border-[var(--panel-border)] font-mono text-[9px] text-[var(--parchment-dim)] space-y-2">
                        <p><strong>Estilo Standard (3D):</strong> lluvia y nieve usan partículas nativas de Mapbox. <strong>Otros estilos</strong> (CDMX, Claro, Satélite…): lluvia y nieve son overlays CSS encima del mapa.</p>
                        <p><strong>Atmosférico:</strong> niebla en bordes + respiración (shader). <strong>Niebla:</strong> bruma con gradientes. <strong>Viñeta:</strong> oscurecimiento en bordes. <strong>Lluvia:</strong> aquí o en subpanel Lluvia/Nieve (en no-Standard activa overlay CSS). <strong>Nieve:</strong> solo desde Lluvia/Nieve.</p>
                        <p className="opacity-70">Documentación completa: <code className="text-[var(--sepia)]">docs/capas-mapa.md</code></p>
                      </div>
                    </details>
                    <div className="space-y-2">
                      {[
                        { key: "atmospheric" as const, label: "Atmosférico (shader)" },
                        { key: "mist" as const, label: "Niebla" },
                        { key: "vignette" as const, label: "Viñeta" },
                        { key: "rain" as const, label: "Lluvia" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-[var(--parchment-dim)]">{label}</span>
                          <button
                            role="switch"
                            aria-checked={mapConfig.overlays[key]}
                            onClick={() =>
                              onMapConfigChange({
                                ...mapConfig,
                                overlays: { ...mapConfig.overlays, [key]: !mapConfig.overlays[key] },
                              })
                            }
                            className={cn(
                              "relative w-8 h-4 rounded-full border transition-all duration-300",
                              mapConfig.overlays[key]
                                ? "border-[var(--primary)] bg-[var(--primary)]/20"
                                : "border-[var(--panel-border)] bg-transparent"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                                mapConfig.overlays[key] ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                              )}
                          />
                        </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        { key: "atmospheric" as const, label: "Opac. atmosf." },
                        { key: "mist" as const, label: "Opac. niebla" },
                        { key: "vignette" as const, label: "Opac. viñeta" },
                        { key: "rain" as const, label: "Opac. lluvia" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-0.5">
                            {label}: {mapConfig.opacity[key]}%
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={mapConfig.opacity[key]}
                            onChange={(e) =>
                              onMapConfigChange({
                                ...mapConfig,
                                opacity: { ...mapConfig.opacity, [key]: Number(e.target.value) },
                              })
                            }
                            className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                          />
                        </div>
                      ))}
                    </div>
                              </>
                            )}
                            {id === "borde" && (
                              <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Mostrar borde CDMX</span>
                        <button
                          role="switch"
                          aria-checked={boundaryGlowConfig.enabled}
                          onClick={() =>
                            onMapConfigChange({
                              ...mapConfig,
                              boundaryGlow: {
                                ...boundaryGlowConfig,
                                enabled: !boundaryGlowConfig.enabled,
                              },
                            })
                          }
                          className={cn(
                            "relative w-8 h-4 rounded-full border transition-all duration-300",
                            boundaryGlowConfig.enabled
                              ? "border-[var(--primary)] bg-[var(--primary)]/20"
                              : "border-[var(--panel-border)] bg-transparent"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                              boundaryGlowConfig.enabled ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        { key: "veilOpacity" as const, label: "Opac. velo", min: 0, max: 100, step: 1, unit: "%" },
                        { key: "glowOpacity" as const, label: "Opac. glow", min: 0, max: 100, step: 1, unit: "%" },
                        { key: "glowWidth" as const, label: "Ancho glow", min: 1, max: 24, step: 0.5, unit: "" },
                        { key: "glowBlur" as const, label: "Blur glow", min: 0, max: 8, step: 0.1, unit: "" },
                        { key: "lineOpacity" as const, label: "Opac. borde", min: 0, max: 100, step: 1, unit: "%" },
                        { key: "lineWidth" as const, label: "Ancho borde", min: 0.5, max: 4, step: 0.1, unit: "" },
                      ].map(({ key, label, min, max, step, unit }) => (
                        <div key={key}>
                          <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-0.5">
                            {label}: {boundaryGlowConfig[key]}
                            {unit}
                          </label>
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={boundaryGlowConfig[key]}
                            onChange={(e) =>
                              onMapConfigChange({
                                ...mapConfig,
                                boundaryGlow: {
                                  ...boundaryGlowConfig,
                                  [key]: Number(e.target.value),
                                },
                              })
                            }
                            className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                          />
                        </div>
                      ))}
                    </div>
                              </>
                            )}
                            {id === "lluvia-nieve" && (
                              <>
                    <p className="font-mono text-[9px] text-[var(--parchment-dim)] opacity-70 mb-2">
                      Efectos nativos Mapbox GL 3.9+ (partículas)
                    </p>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Lluvia</span>
                          <button
                            role="switch"
                            aria-checked={mapConfig.mapboxRain?.enabled ?? false}
                            onClick={() =>
                              onMapConfigChange({
                                ...mapConfig,
                                mapboxRain: {
                                  ...(mapConfig.mapboxRain ?? DEFAULT_MAP_CONFIG.mapboxRain),
                                  enabled: !(mapConfig.mapboxRain?.enabled ?? false),
                                },
                              })
                            }
                            className={cn(
                              "relative w-8 h-4 rounded-full border transition-all duration-300",
                              mapConfig.mapboxRain?.enabled
                                ? "border-[var(--primary)] bg-[var(--primary)]/20"
                                : "border-[var(--panel-border)] bg-transparent"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                                mapConfig.mapboxRain?.enabled ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                              )}
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-[var(--parchment-dim)]">Color:</span>
                          <input
                            type="color"
                            value={mapConfig.mapboxRain?.color ?? "#a8adbc"}
                            onChange={(e) =>
                              onMapConfigChange({
                                ...mapConfig,
                                mapboxRain: {
                                  ...(mapConfig.mapboxRain ?? DEFAULT_MAP_CONFIG.mapboxRain),
                                  color: e.target.value,
                                },
                              })
                            }
                            className="w-8 h-6 rounded border border-[var(--panel-border)] cursor-pointer bg-transparent"
                          />
                          <span className="font-mono text-[9px] text-[var(--parchment-dim)]">
                            {mapConfig.mapboxRain?.color ?? "#a8adbc"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Nieve</span>
                          <button
                            role="switch"
                            aria-checked={mapConfig.mapboxSnow?.enabled ?? false}
                            onClick={() =>
                              onMapConfigChange({
                                ...mapConfig,
                                mapboxSnow: {
                                  ...(mapConfig.mapboxSnow ?? DEFAULT_MAP_CONFIG.mapboxSnow),
                                  enabled: !(mapConfig.mapboxSnow?.enabled ?? false),
                                },
                              })
                            }
                            className={cn(
                              "relative w-8 h-4 rounded-full border transition-all duration-300",
                              mapConfig.mapboxSnow?.enabled
                                ? "border-[var(--primary)] bg-[var(--primary)]/20"
                                : "border-[var(--panel-border)] bg-transparent"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                                mapConfig.mapboxSnow?.enabled ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                              )}
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-[var(--parchment-dim)]">Color:</span>
                          <input
                            type="color"
                            value={mapConfig.mapboxSnow?.color ?? "#ffffff"}
                            onChange={(e) =>
                              onMapConfigChange({
                                ...mapConfig,
                                mapboxSnow: {
                                  ...(mapConfig.mapboxSnow ?? DEFAULT_MAP_CONFIG.mapboxSnow),
                                  color: e.target.value,
                                },
                              })
                            }
                            className="w-8 h-6 rounded border border-[var(--panel-border)] cursor-pointer bg-transparent"
                          />
                          <span className="font-mono text-[9px] text-[var(--parchment-dim)]">
                            {mapConfig.mapboxSnow?.color ?? "#ffffff"}
                          </span>
                        </div>
                      </div>
                    </div>
                              </>
                            )}
                            {id === "orbe" && (
                              <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Activar orbe</span>
                        <button
                          role="switch"
                          aria-checked={mapConfig.soulOrb?.enabled ?? false}
                          onClick={() =>
                            onMapConfigChange({
                              ...mapConfig,
                              soulOrb: {
                                ...mapConfig.soulOrb,
                                enabled: !(mapConfig.soulOrb?.enabled ?? false),
                              },
                            })
                          }
                          className={cn(
                            "relative w-8 h-4 rounded-full border transition-all duration-300",
                            mapConfig.soulOrb?.enabled
                              ? "border-[var(--primary)] bg-[var(--primary)]/20"
                              : "border-[var(--panel-border)] bg-transparent"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                              mapConfig.soulOrb?.enabled ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                            )}
                          />
                        </button>
                      </div>

                      <div>
                        <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-1">Color</label>
                        <select
                          value={mapConfig.soulOrb?.color ?? "#050505"}
                          onChange={(e) =>
                            onMapConfigChange({
                              ...mapConfig,
                              soulOrb: {
                                ...mapConfig.soulOrb,
                                color: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[10px] focus:outline-none focus:border-[var(--sepia)]"
                        >
                          {SOUL_ORB_COLORS.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-1">Lat</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={mapConfig.soulOrb?.lat ?? 19.43}
                            onChange={(e) =>
                              onMapConfigChange({
                                ...mapConfig,
                                soulOrb: {
                                  ...mapConfig.soulOrb,
                                  lat: Number(e.target.value),
                                },
                              })
                            }
                            className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[10px] focus:outline-none focus:border-[var(--sepia)]"
                          />
                        </div>
                        <div>
                          <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-1">Lng</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={mapConfig.soulOrb?.lng ?? -99.13}
                            onChange={(e) =>
                              onMapConfigChange({
                                ...mapConfig,
                                soulOrb: {
                                  ...mapConfig.soulOrb,
                                  lng: Number(e.target.value),
                                },
                              })
                            }
                            className="w-full bg-transparent border border-[var(--panel-border)] rounded-sm px-2 py-1.5 text-[var(--parchment-dim)] font-mono text-[10px] focus:outline-none focus:border-[var(--sepia)]"
                          />
                        </div>
                      </div>
                    </div>
                              </>
                            )}
                            {id === "filtro" && (
                              <>
                    {[
                      { key: "sepia" as const, label: "Sepia", min: 0, max: 100 },
                      { key: "hueRotate" as const, label: "Hue", min: -180, max: 180 },
                      { key: "saturate" as const, label: "Saturación", min: 0, max: 200 },
                      { key: "contrast" as const, label: "Contraste", min: 50, max: 150 },
                      { key: "brightness" as const, label: "Brillo", min: 50, max: 150 },
                    ].map(({ key, label, min, max }) => (
                      <div key={key} className="mb-2">
                        <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-0.5">
                          {label}: {mapConfig.filter[key]}
                        </label>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={mapConfig.filter[key]}
                          onChange={(e) =>
                            onMapConfigChange({
                              ...mapConfig,
                              filter: { ...mapConfig.filter, [key]: Number(e.target.value) },
                            })
                          }
                          className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                        />
                      </div>
                    ))}
                              </>
                            )}
                            {id === "popup" && (
                              <>
                    <div className="flex items-center gap-1.5 mb-3">
                      {[
                        { key: "etereo", label: "Etéreo" },
                        { key: "legible", label: "Legible" },
                        { key: "balanceado", label: "Balanceado" },
                      ].map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() =>
                            onMapConfigChange({
                              ...mapConfig,
                              popupConfig: { ...mapConfig.popupConfig, ...POPUP_PRESETS[preset.key as keyof typeof POPUP_PRESETS] },
                            })
                          }
                          className="px-2 py-1 border border-[var(--panel-border)] rounded-sm font-mono text-[10px] text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:border-[var(--sepia)]/60 transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    {[
                      { key: "titleSize" as const, label: "Título", min: 16, max: 32, step: 1, unit: "px" },
                      { key: "bodySize" as const, label: "Texto", min: 13, max: 26, step: 1, unit: "px" },
                      { key: "metaSize" as const, label: "Meta", min: 9, max: 16, step: 1, unit: "px" },
                      { key: "backdropOpacity" as const, label: "Fondo móvil", min: 0, max: 90, step: 1, unit: "%" },
                      { key: "veilOpacity" as const, label: "Velo etéreo", min: 0, max: 100, step: 1, unit: "%" },
                      { key: "panelGlow" as const, label: "Glow panel", min: 0, max: 100, step: 1, unit: "%" },
                      { key: "blurIn" as const, label: "Blur entrada", min: 0, max: 6, step: 0.1, unit: "px" },
                      { key: "animDuration" as const, label: "Duración", min: 250, max: 1500, step: 10, unit: "ms" },
                    ].map(({ key, label, min, max, step, unit }) => (
                      <div key={key} className="mb-2">
                        <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-0.5">
                          {label}: {mapConfig.popupConfig[key]}
                          {unit}
                        </label>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={mapConfig.popupConfig[key]}
                          onChange={(e) =>
                            onMapConfigChange({
                              ...mapConfig,
                              popupConfig: { ...mapConfig.popupConfig, [key]: Number(e.target.value) },
                            })
                          }
                          className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                        />
                      </div>
                    ))}
                              </>
                            )}
                            {id === "particulas" && (
                              <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[var(--parchment-dim)]">Activado</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={mapConfig.particlesOverlay?.enabled ?? false}
                          onClick={() =>
                            onMapConfigChange({
                              ...mapConfig,
                              particlesOverlay: {
                                ...(mapConfig.particlesOverlay ?? DEFAULT_MAP_CONFIG.particlesOverlay),
                                enabled: !(mapConfig.particlesOverlay?.enabled ?? false),
                              },
                            })
                          }
                          className={cn(
                            "relative w-8 h-4 rounded-full border transition-all duration-300",
                            mapConfig.particlesOverlay?.enabled
                              ? "border-[var(--primary)] bg-[var(--primary)]/20"
                              : "border-[var(--panel-border)] bg-transparent"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                              mapConfig.particlesOverlay?.enabled ? "left-4 bg-[var(--primary)]" : "left-0.5 bg-[var(--panel-border)]"
                            )}
                          />
                        </button>
                      </div>
                      {[
                        { key: "count" as const, label: "Cantidad", min: 100, max: 2000, step: 50 },
                        { key: "size" as const, label: "Tamaño", min: 0.5, max: 4, step: 0.1 },
                        { key: "opacity" as const, label: "Opacidad", min: 0.05, max: 1, step: 0.05 },
                        { key: "speed" as const, label: "Velocidad", min: 0.1, max: 1.5, step: 0.05 },
                      ].map(({ key, label, min, max, step }) => {
                        const value = mapConfig.particlesOverlay?.[key] ?? (DEFAULT_MAP_CONFIG.particlesOverlay as typeof mapConfig.particlesOverlay)[key]
                        return (
                          <div key={key} className="mb-2">
                            <label className="block font-mono text-[9px] text-[var(--parchment-dim)] mb-0.5">
                              {label}: {typeof value === "number" && key === "opacity" ? `${Math.round(value * 100)}%` : value}
                            </label>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step={step}
                              value={value as number}
                              onChange={(e) =>
                                onMapConfigChange({
                                  ...mapConfig,
                                  particlesOverlay: {
                                    ...(mapConfig.particlesOverlay ?? DEFAULT_MAP_CONFIG.particlesOverlay),
                                    [key]: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full h-1.5 rounded-full appearance-none bg-[var(--panel-border)] accent-[var(--primary)]"
                            />
                          </div>
                        )
                      })}
                    </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Events list */}
          <div className={cn(expandedSection === "registros" ? "flex-1 overflow-y-auto" : "flex-shrink-0")}>
            <button
              className="w-full flex items-center justify-between px-6 py-3 border-b border-[var(--panel-border)] text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
              onClick={() => setExpandedSection(expandedSection === "registros" ? null : "registros")}
              aria-expanded={expandedSection === "registros"}
            >
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
                Registros
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[var(--parchment-dim)]">
                  {filteredEvents.length}
                </span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={cn("transition-transform duration-300", expandedSection === "registros" ? "rotate-180" : "")}
                  aria-hidden
                >
                  <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            {expandedSection === "registros" && (
              <>
                <ul className="divide-y divide-[var(--panel-border)]" role="list">
                  {filteredEvents.map((event) => (
                    <li key={event.id}>
                      <button
                        onClick={() => onSelectEvent(event.id)}
                        className={cn(
                          "w-full text-left px-6 py-4 transition-all duration-300 group",
                          "hover:bg-[var(--halo)]",
                          selectedEventId === event.id && "bg-[var(--halo-sepia)] border-l-2 border-l-[var(--sepia)]"
                        )}
                        aria-current={selectedEventId === event.id ? "true" : undefined}
                      >
                        <div className="flex items-start gap-3">
                          {/* Type icon */}
                          <span
                            className={cn(
                              "mt-0.5 flex-shrink-0 transition-colors duration-200",
                              selectedEventId === event.id
                                ? "text-[var(--sepia)]"
                                : "text-[var(--parchment-dim)] group-hover:text-[var(--primary)]"
                            )}
                          >
                            <SymbolIcon name={getSymbolForType(event.type)} size={16} />
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <h3 className={cn(
                                "font-serif text-sm font-medium leading-snug truncate transition-colors duration-200",
                                selectedEventId === event.id
                                  ? "text-[var(--parchment)]"
                                  : "text-[var(--parchment)] group-hover:text-[var(--parchment)]"
                              )}>
                                {event.title}
                              </h3>
                              {/* Intensity dot */}
                              <span
                                className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
                                style={{
                                  background: ["4", "5"].includes(event.intensity)
                                    ? "var(--sepia)"
                                    : ["2", "3"].includes(event.intensity)
                                      ? "var(--primary)"
                                      : "var(--parchment-dim)",
                                  opacity: 0.8,
                                }}
                                title={`Intensidad: ${event.intensity}`}
                              />
                            </div>
                            <time
                              className="font-mono text-[9px] tracking-[0.12em] text-[var(--parchment-dim)] opacity-70"
                              dateTime={event.date}
                            >
                              {formatDateSafe(event.date)}
                            </time>
                            <p className="mt-1.5 text-[11px] font-mono text-[var(--parchment-dim)] leading-relaxed line-clamp-2 opacity-70 group-hover:opacity-90 transition-opacity">
                              {event.excerpt}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                {filteredEvents.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <p className="font-serif text-sm text-[var(--parchment-dim)] italic opacity-60">
                      Ningún registro coincide con los filtros seleccionados.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

export const MapPanel = memo(MapPanelInner)
