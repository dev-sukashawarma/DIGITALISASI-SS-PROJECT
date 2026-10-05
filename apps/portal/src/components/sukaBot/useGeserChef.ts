'use client'
import { useEffect, useRef, useState, type PointerEvent as PointerReact } from 'react'
import { jepitPosisi, posisiAwal, sudahGeser, type Titik, type Ukuran } from './avatar/posisi'

const KUNCI_POSISI = 'sukaBot.posisi'

function bacaPosisi(): Titik | null {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_POSISI) || 'null')
    return v && typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : null
  } catch { return null }
}
function simpanPosisi(p: Titik) {
  try { localStorage.setItem(KUNCI_POSISI, JSON.stringify(p)) } catch { /* abaikan */ }
}

/** Ukuran jendela. Hanya untuk komponen yang dirender di klien (widget dimuat dengan ssr:false). */
export function useUkuranLayar(): Ukuran {
  const [layar, setLayar] = useState<Ukuran>(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const ubah = () => setLayar({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', ubah)
    return () => window.removeEventListener('resize', ubah)
  }, [])
  return layar
}

type PenanganPointer = {
  onPointerDown: (e: PointerReact<HTMLElement>) => void
  onPointerMove: (e: PointerReact<HTMLElement>) => void
  onPointerUp: (e: PointerReact<HTMLElement>) => void
  onPointerCancel: (e: PointerReact<HTMLElement>) => void
}

/** Chef digeser dengan pointer (mouse & sentuh), dijepit di dalam layar, posisi diingat per perangkat. */
export function useGeserChef(ukuran: Ukuran, layar: Ukuran): {
  posisi: Titik
  penangan: PenanganPointer
  baruSajaDigeser: () => boolean
  kembalikan: () => void
} {
  const [posisi, setPosisi] = useState<Titik>(() => jepitPosisi(bacaPosisi() ?? posisiAwal(ukuran, layar), ukuran, layar))
  const posisiTerkini = useRef(posisi)
  posisiTerkini.current = posisi
  const geser = useRef<{ id: number; awalX: number; awalY: number; asal: Titik; aktif: boolean } | null>(null)
  const digeser = useRef(false)

  useEffect(() => {
    setPosisi((p) => jepitPosisi(p, ukuran, layar))
  }, [ukuran.w, ukuran.h, layar.w, layar.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const selesai = (e: PointerReact<HTMLElement>) => {
    const g = geser.current
    if (!g || g.id !== e.pointerId) return
    geser.current = null
    if (g.aktif) simpanPosisi(posisiTerkini.current)
  }

  const penangan: PenanganPointer = {
    onPointerDown: (e) => {
      if (e.button !== 0) return
      geser.current = { id: e.pointerId, awalX: e.clientX, awalY: e.clientY, asal: posisiTerkini.current, aktif: false }
      digeser.current = false
      // Tangkap sejak ditekan: geseran cepat bisa melompat keluar chef di gerakan pertama,
      // dan tanpa tangkapan event berikutnya tidak lagi sampai ke tombol ini.
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer sudah lepas */ }
    },
    onPointerMove: (e) => {
      const g = geser.current
      if (!g || g.id !== e.pointerId) return
      const dx = e.clientX - g.awalX
      const dy = e.clientY - g.awalY
      if (!g.aktif) {
        if (!sudahGeser(dx, dy)) return
        g.aktif = true
        digeser.current = true
      }
      setPosisi(jepitPosisi({ x: g.asal.x + dx, y: g.asal.y + dy }, ukuran, layar))
    },
    onPointerUp: selesai,
    onPointerCancel: selesai,
  }

  /** Dipanggil di onClick: true bila klik ini sebenarnya akhir dari geseran (lalu direset). */
  const baruSajaDigeser = () => {
    const d = digeser.current
    digeser.current = false
    return d
  }

  /** Chef kembali ke pojok kanan bawah; posisi tersimpan dihapus. */
  const kembalikan = () => {
    try { localStorage.removeItem(KUNCI_POSISI) } catch { /* abaikan */ }
    setPosisi(posisiAwal(ukuran, layar))
  }

  return { posisi, penangan, baruSajaDigeser, kembalikan }
}
