'use client'
import { useEffect, useRef, type RefObject } from 'react'
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion'
import { hitungCondong } from './condong'

const PEGAS = { stiffness: 120, damping: 14 }

/** Avatar condong ke arah kursor. Hanya di perangkat bermouse dan bila `aktif`. */
export function useCondongKursor(aktif: boolean): { ref: RefObject<HTMLDivElement | null>; rotate: MotionValue<number>; x: MotionValue<number> } {
  const ref = useRef<HTMLDivElement | null>(null)
  const rotasi = useMotionValue(0)
  const geser = useMotionValue(0)
  const rotate = useSpring(rotasi, PEGAS)
  const x = useSpring(geser, PEGAS)

  useEffect(() => {
    if (!aktif || !window.matchMedia('(pointer: fine)').matches) return
    const gerak = (e: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const b = el.getBoundingClientRect()
      const c = hitungCondong(e.clientX - (b.left + b.width / 2))
      rotasi.set(c.derajat)
      geser.set(c.px)
    }
    window.addEventListener('pointermove', gerak, { passive: true })
    return () => {
      window.removeEventListener('pointermove', gerak)
      rotasi.set(0)
      geser.set(0)
    }
  }, [aktif, rotasi, geser])

  return { ref, rotate, x }
}
