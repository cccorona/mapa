"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export interface ParticlesOverlayProps {
  enabled: boolean
  count: number
  size: number
  opacity: number
  speed: number
  className?: string
}

export function ParticlesOverlay({
  enabled,
  count,
  size,
  opacity,
  speed,
  className,
}: ParticlesOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const materialRef = useRef<THREE.PointsMaterial | null>(null)
  const speedRef = useRef(speed)

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return
    const width = container.offsetWidth
    const height = container.offsetHeight
    if (width <= 0 || height <= 0) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2
      positions[i * 3 + 2] = 0
      phases[i] = Math.random() * Math.PI * 2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    const phaseAttr = new THREE.BufferAttribute(phases, 1)
    phaseAttr.setUsage(THREE.StaticDrawUsage)
    geometry.setAttribute("phase", phaseAttr)

    const material = new THREE.PointsMaterial({
      size: size * 0.01,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      sizeAttenuation: false,
      color: 0xd4c9a8,
      blending: THREE.AdditiveBlending,
    })
    materialRef.current = material

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const startMs = performance.now()
    let raf: number

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const sp = speedRef.current
      const t = ((performance.now() - startMs) / 1000) * sp
      const posAttr = geometry.attributes.position as THREE.BufferAttribute
      const phaseAttr = geometry.attributes.phase as THREE.BufferAttribute
      const posArray = posAttr.array as Float32Array
      for (let i = 0; i < count; i++) {
        const baseY = posArray[i * 3 + 1] as number
        const phase = phaseAttr.array[i] as number
        posArray[i * 3 + 1] = baseY + Math.sin(t + phase) * 0.002
        if (posArray[i * 3 + 1] > 1.2) posArray[i * 3 + 1] = -1.2
      }
      posAttr.needsUpdate = true
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      const w = container.offsetWidth
      const h = container.offsetHeight
      renderer.setSize(w, h)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(raf)
      materialRef.current = null
      renderer.dispose()
      material.dispose()
      geometry.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [enabled, count])

  useEffect(() => {
    const mat = materialRef.current
    if (!mat) return
    mat.size = size * 0.01
    mat.opacity = opacity
  }, [size, opacity])

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 6,
        visibility: enabled ? "visible" : "hidden",
      }}
    />
  )
}
