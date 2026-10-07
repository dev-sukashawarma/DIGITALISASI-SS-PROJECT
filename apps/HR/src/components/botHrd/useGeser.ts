'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { jepitKeLayar, lewatAmbang, posisiDariPointer, type Titik, type Ukuran } from '@/lib/botHrd/posisi'

type Opsi = {
  /** Posisi saat ini (pojok kiri-atas) dibaca saat pointerdown. */
  ambilPosisi: () => Titik | null
  ambilUkuran: () => Ukuran
  onUbah: (pos: Titik) => void
  onSelesai?: (pos: Titik, bergeser: boolean) => void
  aktif?: boolean
}

/**
 * Geser dengan Pointer Events (mouse + sentuh). Pointer ditangkap sejak pointerdown;
 * gerak di bawah ambang dianggap klik. `pernahGeser()` tetap true sampai pointerdown
 * berikutnya, sehingga onClick bisa mengabaikan klik susulan setelah geseran.
 */
export function useGeser(opsi: Opsi) {
  const o = useRef(opsi)
  o.current = opsi
  const sesi = useRef<{ id: number; pointer: Titik; elemen: Titik; bergeser: boolean; terakhir: Titik } | null>(null)
  const bergeserRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (o.current.aktif === false) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // tombol di dalam gagang (reset/tutup) tidak memulai geser
    const tombolDalam = (e.target as HTMLElement).closest('button')
    if (tombolDalam && tombolDalam !== e.currentTarget) return
    const awal = o.current.ambilPosisi()
    if (!awal) return
    bergeserRef.current = false
    sesi.current = { id: e.pointerId, pointer: { x: e.clientX, y: e.clientY }, elemen: awal, bergeser: false, terakhir: awal }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // abaikan
    }
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const s = sesi.current
    if (!s || s.id !== e.pointerId) return
    const sekarang = { x: e.clientX, y: e.clientY }
    if (!s.bergeser) {
      if (!lewatAmbang(s.pointer, sekarang)) return
      s.bergeser = true
      bergeserRef.current = true
    }
    const layar = { lebar: window.innerWidth, tinggi: window.innerHeight }
    s.terakhir = jepitKeLayar(posisiDariPointer(s.pointer, s.elemen, sekarang), o.current.ambilUkuran(), layar)
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (sesi.current) o.current.onUbah(sesi.current.terakhir)
      })
    }
  }, [])

  const akhiri = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const s = sesi.current
    if (!s || s.id !== e.pointerId) return
    sesi.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // abaikan
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (s.bergeser) {
      o.current.onUbah(s.terakhir)
      o.current.onSelesai?.(s.terakhir, true)
    } else {
      o.current.onSelesai?.(s.elemen, false)
    }
  }, [])

  return {
    bind: { onPointerDown, onPointerMove, onPointerUp: akhiri, onPointerCancel: akhiri },
    pernahGeser: () => bergeserRef.current,
  }
}
