'use client'

import { useRef, useLayoutEffect, useCallback, useEffect, useState } from 'react'

// Gunakan useLayoutEffect di browser, fallback ke useEffect saat SSR
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export interface RankShiftInfo {
  diff: number // > 0: naik peringkat, < 0: turun peringkat
  oldRank: number
  newRank: number
}

interface Pos {
  top: number
  left: number
}

/**
 * Hook FLIP (First, Last, Invert, Play) untuk transisi pergeseran baris & kartu leaderboard.
 * Menghitung selisih koordinat 2D (X dan Y) dan menganimasikan elemen ke posisi baru
 * dengan hardware-accelerated CSS transform (60 FPS, tanpa layout thrashing).
 */
export function useFlipList<T extends { outletId: string }>(items: T[]) {
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const prevPositionsRef = useRef<Map<string, Pos>>(new Map())
  const prevRanksRef = useRef<Map<string, number>>(new Map())
  const [shifts, setShifts] = useState<Map<string, RankShiftInfo>>(new Map())
  const isInitialMount = useRef(true)

  // Callback untuk mendaftarkan ref elemen DOM setiap baris/kartu
  const registerRow = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) {
        elementsRef.current.set(id, el)
      } else {
        elementsRef.current.delete(id)
      }
    },
    [],
  )

  useIsomorphicLayoutEffect(() => {
    // Pada mount awal, rekam posisi dan rank awal tanpa animasi
    if (isInitialMount.current) {
      isInitialMount.current = false
      const initialPositions = new Map<string, Pos>()
      const initialRanks = new Map<string, number>()

      items.forEach((item, index) => {
        initialRanks.set(item.outletId, index + 1)
        const el = elementsRef.current.get(item.outletId)
        if (el) {
          const rect = el.getBoundingClientRect()
          initialPositions.set(item.outletId, { top: rect.top, left: rect.left })
        }
      })

      prevPositionsRef.current = initialPositions
      prevRanksRef.current = initialRanks
      return
    }

    // 1. FIRST & LAST: Hitung perpindahan posisi untuk setiap elemen yang terdaftar
    const newPositions = new Map<string, Pos>()
    const newRanks = new Map<string, number>()
    const updatedShifts = new Map<string, RankShiftInfo>()

    items.forEach((item, index) => {
      const newRank = index + 1
      newRanks.set(item.outletId, newRank)

      const oldRank = prevRanksRef.current.get(item.outletId)
      if (oldRank !== undefined && oldRank !== newRank) {
        updatedShifts.set(item.outletId, {
          diff: oldRank - newRank, // misal dari #3 ke #1 = +2 (naik)
          oldRank,
          newRank,
        })
      }

      const el = elementsRef.current.get(item.outletId)
      if (el) {
        const rect = el.getBoundingClientRect()
        newPositions.set(item.outletId, { top: rect.top, left: rect.left })
      }
    })

    if (updatedShifts.size > 0) {
      setShifts(updatedShifts)
    }

    // 2. INVERT & PLAY: Animasi 3D Zoom-Forward & Glide
    const activeAnimations: Animation[] = []
    const fallbackElements: HTMLElement[] = []

    items.forEach((item) => {
      const el = elementsRef.current.get(item.outletId)
      const prevPos = prevPositionsRef.current.get(item.outletId)
      const currentPos = newPositions.get(item.outletId)

      if (el && prevPos && currentPos) {
        const dx = prevPos.left - currentPos.left
        const dy = prevPos.top - currentPos.top
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          const shift = updatedShifts.get(item.outletId)
          const diff = shift ? shift.diff : 0

          if (typeof el.animate === 'function') {
            el.style.transition = 'none'

            let keyframes: Keyframe[]

            if (diff > 0) {
              // Outlet yang MENYALIP (Overtaking Leader):
              // Tahap 1 (0% -> 24%): ZOOM KEDEPAN DULU di posisi lama (scale 1.10, glow emas 3D, z-index 100)
              // Tahap 2 (24% -> 78%): Meluncur menggantikan posisi baru sambil tetap melayang di depan
              // Tahap 3 (78% -> 90%): Micro-landing bounce
              // Tahap 4 (100%): Mendarat sempurna di slot baru
              keyframes = [
                {
                  transform: `translate3d(${dx}px, ${dy}px, 0px) scale(1)`,
                  boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)',
                  borderColor: 'rgba(245, 158, 11, 0.2)',
                  zIndex: 100,
                  offset: 0,
                },
                {
                  transform: `translate3d(${dx}px, ${dy}px, 0px) scale(1.10)`,
                  boxShadow:
                    '0 30px 60px -10px rgba(245, 158, 11, 0.55), 0 0 40px rgba(245, 158, 11, 0.45)',
                  borderColor: 'rgba(251, 191, 36, 1)',
                  zIndex: 100,
                  offset: 0.24,
                },
                {
                  transform: `translate3d(0px, 0px, 0px) scale(1.08)`,
                  boxShadow:
                    '0 25px 50px -10px rgba(245, 158, 11, 0.45), 0 0 30px rgba(245, 158, 11, 0.35)',
                  borderColor: 'rgba(251, 191, 36, 0.8)',
                  zIndex: 100,
                  offset: 0.78,
                },
                {
                  transform: `translate3d(0px, 0px, 0px) scale(0.985)`,
                  boxShadow: '0 10px 20px -5px rgba(245, 158, 11, 0.25)',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                  zIndex: 100,
                  offset: 0.9,
                },
                {
                  transform: 'translate3d(0px, 0px, 0px) scale(1)',
                  boxShadow: '',
                  borderColor: '',
                  zIndex: '',
                  offset: 1,
                },
              ]
            } else if (diff < 0) {
              // Outlet yang TERSALIP (Displaced / Downward):
              // Sinking sedikit ke belakang (scale 0.97, opacity 0.85), meluncur di bawah kartu yang menyalip
              keyframes = [
                {
                  transform: `translate3d(${dx}px, ${dy}px, 0px) scale(1)`,
                  zIndex: 10,
                  opacity: 1,
                  offset: 0,
                },
                {
                  transform: `translate3d(${dx * 0.7}px, ${dy * 0.7}px, 0px) scale(0.97)`,
                  zIndex: 10,
                  opacity: 0.82,
                  offset: 0.24,
                },
                {
                  transform: `translate3d(0px, 0px, 0px) scale(0.98)`,
                  zIndex: 10,
                  opacity: 0.9,
                  offset: 0.78,
                },
                {
                  transform: 'translate3d(0px, 0px, 0px) scale(1)',
                  zIndex: '',
                  opacity: 1,
                  offset: 1,
                },
              ]
            } else {
              // Pergeseran posisi biasa (penyesuaian letak tanpa perubahan peringkat):
              keyframes = [
                {
                  transform: `translate3d(${dx}px, ${dy}px, 0px)`,
                  offset: 0,
                },
                {
                  transform: 'translate3d(0px, 0px, 0px)',
                  offset: 1,
                },
              ]
            }

            const anim = el.animate(keyframes, {
              duration: 850,
              easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
              fill: 'none',
            })

            anim.onfinish = () => {
              el.style.transition = ''
            }

            activeAnimations.push(anim)
          } else {
            // Fallback untuk environment tanpa Web Animations API
            el.style.transform = `translate(${dx}px, ${dy}px)`
            el.style.transition = 'none'
            fallbackElements.push(el)
          }
        }
      }
    })

    // Update referensi posisi dan rank untuk siklus berikutnya
    prevPositionsRef.current = newPositions
    prevRanksRef.current = newRanks

    // Fallback animation trigger
    let rafId: number | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    if (fallbackElements.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      document.body.offsetHeight
      rafId = requestAnimationFrame(() => {
        fallbackElements.forEach((el) => {
          el.style.transition = 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)'
          el.style.transform = 'translate(0, 0)'
        })
      })
      timer = setTimeout(() => {
        fallbackElements.forEach((el) => {
          el.style.transition = ''
          el.style.transform = ''
        })
      }, 650)
    }

    // Fade out badge shift setelah 5 detik
    const shiftTimer = setTimeout(() => {
      setShifts(new Map())
    }, 5000)

    return () => {
      activeAnimations.forEach((anim) => anim.cancel())
      if (rafId) cancelAnimationFrame(rafId)
      if (timer) clearTimeout(timer)
      clearTimeout(shiftTimer)
    }
  }, [items])

  return {
    registerRow,
    shifts,
  }
}
