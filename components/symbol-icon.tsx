"use client"

import type { SymbolName } from "@/lib/icons"

const svgProps = {
  viewBox: "0 0 24 24" as const,
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function VelaIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps} {...props}>
      <g transform="translate(2,2) scale(1.25)">
        <line x1="8" y1="14" x2="8" y2="6" />
        <ellipse cx="8" cy="14" rx="2.5" ry="0.8" opacity="0.5" />
        <path d="M8 6 C8 6 6.5 4.5 7 3 C7.5 1.5 9 2 9 3.5 C9 5 8 6 8 6Z" fill="currentColor" opacity="0.8" />
      </g>
    </svg>
  )
}

function GrietaIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps} {...props}>
      <g transform="translate(2,2) scale(1.25)">
        <path d="M3 3 L7 7 L5 9 L9 13" />
        <path d="M7 7 L10 5" opacity="0.5" />
      </g>
    </svg>
  )
}

function HiloIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps} {...props}>
      <g transform="translate(2,2) scale(1.25)">
        <path d="M2 8 C4 6 6 10 8 8 C10 6 12 10 14 8" />
        <line x1="8" y1="6" x2="8" y2="5" />
        <line x1="8" y1="10" x2="8" y2="11" strokeDasharray="1 1" />
      </g>
    </svg>
  )
}

function PuertaIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps} {...props}>
      <g transform="translate(2,2) scale(1.25)">
        <rect x="4" y="2" width="8" height="12" rx="0.5" />
        <circle cx="11" cy="8" r="0.8" fill="currentColor" />
        <line x1="4" y1="2" x2="4" y2="14" strokeWidth={0.7} opacity="0.4" />
      </g>
    </svg>
  )
}

function DocumentoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps} {...props}>
      <g transform="translate(2,2) scale(1.25)">
        <path d="M4 2 L10 2 L12 5 L12 14 L4 14 Z" />
        <path d="M10 2 L10 5 L12 5" />
        <line x1="6" y1="7" x2="10" y2="7" opacity="0.7" />
        <line x1="6" y1="10" x2="10" y2="10" opacity="0.7" />
      </g>
    </svg>
  )
}

function GermenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps} {...props}>
      <g transform="translate(2,2) scale(1.25)">
        <ellipse cx="8" cy="12" rx="2" ry="1.5" opacity="0.6" />
        <path d="M8 10 C8 6 6 4 8 2 C10 4 8 6 8 10" />
        <circle cx="8" cy="4" r="1" fill="currentColor" opacity="0.7" />
      </g>
    </svg>
  )
}

function CruzIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps} {...props}>
      <g transform="translate(2,2) scale(1.25)">
        <line x1="8" y1="2" x2="8" y2="14" />
        <line x1="4" y1="8" x2="12" y2="8" />
        <circle cx="8" cy="8" r="2.5" strokeWidth={1.2} opacity="0.5" />
      </g>
    </svg>
  )
}

const SYMBOL_COMPONENTS: Record<SymbolName, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  vela: VelaIcon,
  grieta: GrietaIcon,
  hilo: HiloIcon,
  puerta: PuertaIcon,
  documento: DocumentoIcon,
  germen: GermenIcon,
  cruz: CruzIcon,
}

export interface SymbolIconProps {
  name: SymbolName
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function SymbolIcon({ name, size = 24, className, style }: SymbolIconProps) {
  const Icon = SYMBOL_COMPONENTS[name]
  if (!Icon) return null
  return <Icon width={size} height={size} className={className} style={style} aria-hidden />
}
