import type { ReactNode } from "react"

const iconProps = { width: 16, height: 16, "aria-hidden": true }

export const TYPE_ICONS_BY_SYMBOL: Record<string, ReactNode> = {
  vela: (
    <svg {...iconProps} viewBox="0 0 16 16" fill="none">
      <line x1="8" y1="14" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="8" cy="14" rx="2.5" ry="0.8" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <path d="M8 6 C8 6 6.5 4.5 7 3 C7.5 1.5 9 2 9 3.5 C9 5 8 6 8 6Z" fill="currentColor" opacity="0.8" />
    </svg>
  ),
  grieta: (
    <svg {...iconProps} viewBox="0 0 16 16" fill="none">
      <path d="M3 3 L7 7 L5 9 L9 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7 L10 5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  hilo: (
    <svg {...iconProps} viewBox="0 0 16 16" fill="none">
      <path d="M2 8 C4 6 6 10 8 8 C10 6 12 10 14 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8" y1="6" x2="8" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="8" y1="10" x2="8" y2="11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="1 1" />
    </svg>
  ),
  puerta: (
    <svg {...iconProps} viewBox="0 0 16 16" fill="none">
      <rect x="4" y="2" width="8" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="8" r="0.8" fill="currentColor" />
      <line x1="4" y1="2" x2="4" y2="14" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
    </svg>
  ),
  documento: (
    <svg {...iconProps} viewBox="0 0 16 16" fill="none">
      <path d="M4 2 L10 2 L12 5 L12 14 L4 14 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <path d="M10 2 L10 5 L12 5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <line x1="6" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
      <line x1="6" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
    </svg>
  ),
  germen: (
    <svg {...iconProps} viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="12" rx="2" ry="1.5" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
      <path d="M8 10 C8 6 6 4 8 2 C10 4 8 6 8 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="4" r="1" fill="currentColor" opacity="0.7" />
    </svg>
  ),
  cruz: (
    <svg {...iconProps} viewBox="0 0 16 16" fill="none">
      <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    </svg>
  ),
}
