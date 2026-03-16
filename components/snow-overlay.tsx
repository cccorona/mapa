"use client"

interface SnowOverlayProps {
  className?: string
  opacity?: number
}

export function SnowOverlay({ className, opacity = 0.6 }: SnowOverlayProps) {
  return (
    <div
      className={`snow-overlay ${className ?? ""}`}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
        opacity,
      }}
    >
      <div className="snow-layer snow-layer-1" />
      <div className="snow-layer snow-layer-2" />
      <div className="snow-layer snow-layer-3" />
    </div>
  )
}
