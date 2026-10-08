'use client'

import { useEffect, useRef, useState } from 'react'

export const MAKS_DERAJAT = 6
export const MAKS_GESER = 4
export const JANGKAUAN = 400

export function hitungCondong(dx: number): { derajat: number; px: number } {
  const t = Math.max(-1, Math.min(1, dx / JANGKAUAN))
  return { derajat: t * MAKS_DERAJAT, px: t * MAKS_GESER }
}

/** Hook untuk membuat karakter condong / menengok ke arah kursor mouse secara halus */
export function useCondongKursor(aktif: boolean = true) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [transform, setTransform] = useState({ rotate: 0, x: 0 })
  const targetRef = useRef({ rotate: 0, x: 0 })
  const currentRef = useRef({ rotate: 0, x: 0 })
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!aktif || typeof window === 'undefined') return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const handlePointerMove = (e: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const dx = e.clientX - centerX
      const c = hitungCondong(dx)
      targetRef.current = { rotate: c.derajat, x: c.px }
    }

    const loop = () => {
      // Smooth lerp interpolation
      const k = 0.12
      currentRef.current.rotate += (targetRef.current.rotate - currentRef.current.rotate) * k
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * k

      setTransform({
        rotate: Math.round(currentRef.current.rotate * 100) / 100,
        x: Math.round(currentRef.current.x * 100) / 100,
      })

      animFrameRef.current = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      setTransform({ rotate: 0, x: 0 })
    }
  }, [aktif])

  return { ref, rotate: transform.rotate, x: transform.x }
}
