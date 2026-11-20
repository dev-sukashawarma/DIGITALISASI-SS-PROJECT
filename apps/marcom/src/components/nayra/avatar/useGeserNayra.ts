'use client'

import { useEffect, useRef, useState, type PointerEvent as PointerReact } from 'react'
import { jepitPosisi, posisiAwal, sudahGeser, type Titik, type Ukuran } from './posisi'

const KUNCI_POSISI = 'nayraBot.posisi'

function bacaPosisi(): Titik | null {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_POSISI) || 'null')
    return v && typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : null
  } catch {
    return null
  }
}

function simpanPosisi(p: Titik) {
  try {
    localStorage.setItem(KUNCI_POSISI, JSON.stringify(p))
  } catch {
    // ignore
  }
}

export function useUkuranLayar(): Ukuran {
  // Inisialisasi statis agar SSR dan render awal klien identik (hindari React hydration #418).
  const [layar, setLayar] = useState<Ukuran>({ w: 1280, h: 800 })

  useEffect(() => {
    const handleResize = () => setLayar({ w: window.innerWidth, h: window.innerHeight })
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return layar
}

export function useGeserNayra(ukuran: Ukuran, layar: Ukuran) {
  // Jangan baca localStorage saat render awal agar tidak memicu hydration mismatch.
  const [posisi, setPosisi] = useState<Titik>(() => posisiAwal(ukuran, layar))

  const posisiTerkini = useRef(posisi)
  posisiTerkini.current = posisi

  const sudahMuatTersimpan = useRef(false)
  useEffect(() => {
    if (sudahMuatTersimpan.current) return
    sudahMuatTersimpan.current = true
    const tersimpan = bacaPosisi()
    if (tersimpan) {
      setPosisi(jepitPosisi(tersimpan, ukuran, { w: window.innerWidth, h: window.innerHeight }))
    } else {
      setPosisi(posisiAwal(ukuran, { w: window.innerWidth, h: window.innerHeight }))
    }
  }, [ukuran])

  const geser = useRef<{
    id: number
    awalX: number
    awalY: number
    asal: Titik
    aktif: boolean
  } | null>(null)

  const digeser = useRef(false)

  useEffect(() => {
    setPosisi((p) => jepitPosisi(p, ukuran, layar))
  }, [ukuran.w, ukuran.h, layar.w, layar.h])

  const selesai = (e: PointerReact<HTMLElement>) => {
    const g = geser.current
    if (!g || g.id !== e.pointerId) return
    geser.current = null
    if (g.aktif) {
      simpanPosisi(posisiTerkini.current)
    }
  }

  const penangan = {
    onPointerDown: (e: PointerReact<HTMLElement>) => {
      // Hanya tombol utama (kiri)
      if (e.button !== 0) return
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      geser.current = {
        id: e.pointerId,
        awalX: e.clientX,
        awalY: e.clientY,
        asal: posisiTerkini.current,
        aktif: false,
      }
      digeser.current = false
    },
    onPointerMove: (e: PointerReact<HTMLElement>) => {
      const g = geser.current
      if (!g || g.id !== e.pointerId) return
      const dx = e.clientX - g.awalX
      const dy = e.clientY - g.awalY
      if (!g.aktif) {
        if (!sudahGeser(dx, dy)) return
        g.aktif = true
        digeser.current = true
      }
      const baru = jepitPosisi(
        { x: g.asal.x + dx, y: g.asal.y + dy },
        ukuran,
        layar
      )
      setPosisi(baru)
    },
    onPointerUp: selesai,
    onPointerCancel: selesai,
  }

  const baruSajaDigeser = () => digeser.current

  const kembalikan = () => {
    const awal = posisiAwal(ukuran, layar)
    setPosisi(awal)
    simpanPosisi(awal)
  }

  return { posisi, penangan, baruSajaDigeser, kembalikan }
}
