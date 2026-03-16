"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

interface AtmosphericOverlayProps {
  className?: string
  zoom?: number
  opacity?: number
}

export function AtmosphericOverlay({ className, zoom = 11, opacity = 1 }: AtmosphericOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.offsetWidth
    const height = container.offsetHeight

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uZoom: { value: zoom },
        uOpacity: { value: opacity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uZoom;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv);
          float zoomFog = smoothstep(6.0, 15.0, uZoom) * 0.15;
          float edgeFog = (1.0 - smoothstep(0.2, 0.9, dist)) * (0.05 + zoomFog);
          float breath = 0.01 * sin(uTime * 0.5);
          float alpha = (edgeFog + breath) * uOpacity;
          vec3 sepia = vec3(0.55, 0.45, 0.35);
          gl_FragColor = vec4(sepia * 0.15, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    })

    materialRef.current = material

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const startMs = performance.now()
    let raf: number

    const animate = () => {
      raf = requestAnimationFrame(animate)
      material.uniforms.uTime.value = (performance.now() - startMs) / 1000
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
      renderer.dispose()
      material.dispose()
      geometry.dispose()
      container.removeChild(renderer.domElement)
      materialRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!materialRef.current?.uniforms) return
    materialRef.current.uniforms.uZoom.value = zoom
    materialRef.current.uniforms.uOpacity.value = opacity
  }, [zoom, opacity])

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  )
}
