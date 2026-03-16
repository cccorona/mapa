import type { SymbolName } from "@/lib/icons"
import { palette } from "@/lib/palette"

/** Symbol → color (semantic). Use with getSymbolForType() for event colors. */
export const SYMBOL_COLORS: Record<SymbolName, string> = {
  vela: palette.sepiaLight,
  grieta: palette.forestGreen,
  hilo: palette.parchment,
  puerta: palette.sage,
  documento: palette.sepiaMid,
  germen: palette.forestGreen,
  cruz: palette.sepiaDark,
}
