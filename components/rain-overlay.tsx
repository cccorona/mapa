"use client"

interface RainOverlayProps {
  className?: string
  opacity?: number
}

export function RainOverlay({ className, opacity = 0.4 }: RainOverlayProps) {
  return (
    <div
      className={`rain-overlay ${className ?? ""}`}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
        opacity,
      }}
    >
      <div className="rain-layer rain-layer-1" />
      <div className="rain-layer rain-layer-2" />
      <div className="rain-layer rain-layer-3" />
    </div>
  )
}
