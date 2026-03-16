/**
 * Single source of truth for hex colors.
 * No raw hex elsewhere; semantic colors live in theme.ts.
 */
export const palette = {
  sepiaLight: "#C9A96E",
  sepiaMid: "#8b7355",
  sepiaDark: "#3F3A36",
  parchment: "#b49664",
  forestGreen: "#4a7c6f",
  sage: "#a0b8a0",
  bone: "#d4c9a8",
  ink: "#3E2B2B",
} as const

export type PaletteToken = (typeof palette)[keyof typeof palette]
