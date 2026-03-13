"use client"

import { getSymbolForType } from "@/lib/icons"

function VelaGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M14 11 C14 11 11,8 12,5.5 C13,3 15.5,4 15.5,6 C15.5,8.5 14,11 14,11Z" fill="rgba(200,160,80,0.75)" />
      <line x1="14" y1="11" x2="14" y2="14" stroke="rgba(180,140,60,0.6)" strokeWidth="1.2" />
      <rect x="10.5" y="14" width="7" height="10" rx="1" stroke="rgba(200,170,100,0.6)" strokeWidth="1" fill="rgba(139,115,85,0.12)" />
      <ellipse cx="14" cy="24" rx="4" ry="1.2" stroke="rgba(139,115,85,0.35)" strokeWidth="0.7" />
    </svg>
  )
}

function GrietaGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M6 5 L12 13 L9 16 L16 23" stroke="rgba(74,124,111,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13 L18 9" stroke="rgba(74,124,111,0.4)" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  )
}

function HiloGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M4 14 C8 8 12 20 16 14 C20 8 24 20 28 14" stroke="rgba(180,150,100,0.75)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <line x1="14" y1="8" x2="14" y2="5" stroke="rgba(180,150,100,0.5)" strokeWidth="1" />
      <line x1="14" y1="20" x2="14" y2="24" stroke="rgba(180,150,100,0.4)" strokeWidth="0.9" strokeDasharray="2 2" />
    </svg>
  )
}

function PuertaGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="8" y="4" width="12" height="20" rx="0.5" stroke="rgba(160,184,160,0.7)" strokeWidth="1.2" fill="rgba(30,43,40,0.3)" />
      <line x1="8" y1="4" x2="8" y2="24" stroke="rgba(160,184,160,0.2)" strokeWidth="0.5" />
      <circle cx="18" cy="14" r="1.5" fill="rgba(160,184,160,0.6)" />
    </svg>
  )
}

function DocumentoGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M8 6 L14 6 L18 10 L18 24 L8 24 Z" stroke="rgba(139,115,85,0.8)" strokeWidth="1.2" strokeLinejoin="round" fill="rgba(30,43,40,0.3)" />
      <path d="M14 6 L14 10 L18 10" stroke="rgba(139,115,85,0.6)" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <line x1="10" y1="14" x2="16" y2="14" stroke="rgba(180,150,100,0.6)" strokeWidth="0.8" />
      <line x1="10" y1="18" x2="16" y2="18" stroke="rgba(180,150,100,0.5)" strokeWidth="0.8" />
    </svg>
  )
}

function GermenGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <ellipse cx="14" cy="22" rx="4" ry="2" stroke="rgba(74,124,111,0.6)" strokeWidth="0.9" />
      <path d="M14 18 C14 12 10 8 14 4 C18 8 14 12 14 18" stroke="rgba(160,184,160,0.8)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="14" cy="6" r="2" fill="rgba(200,170,100,0.6)" />
    </svg>
  )
}

function CruzGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <line x1="14" y1="4" x2="14" y2="24" stroke="rgba(139,115,85,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="14" x2="22" y2="14" stroke="rgba(139,115,85,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="14" cy="14" r="4" stroke="rgba(139,115,85,0.4)" strokeWidth="0.8" />
    </svg>
  )
}

const GLYPH_BY_SYMBOL: Record<string, () => JSX.Element> = {
  vela: VelaGlyph,
  grieta: GrietaGlyph,
  hilo: HiloGlyph,
  puerta: PuertaGlyph,
  documento: DocumentoGlyph,
  germen: GermenGlyph,
  cruz: CruzGlyph,
}

export function TypeGlyph({ type }: { type: string }) {
  const symbol = getSymbolForType(type)
  const Glyph = GLYPH_BY_SYMBOL[symbol] ?? VelaGlyph
  return <Glyph />
}
