'use client'
import { useCallback, useEffect, useReducer } from 'react'
import { AWAL, langkah, type Klip, type Pose } from './rencanaPutar'

export function usePemutarAvatar(pose: Pose): { klip: Klip; klik: () => void; selesai: (klip: Klip) => void } {
  // Pose awal langsung diterapkan saat inisialisasi agar render pertama tidak sempat menampilkan 'diam'.
  const [keadaan, kirim] = useReducer(langkah, pose, (p) => langkah(AWAL, { jenis: 'pose', pose: p }))
  useEffect(() => { kirim({ jenis: 'pose', pose }) }, [pose])
  const klik = useCallback(() => kirim({ jenis: 'klik' }), [])
  const selesai = useCallback((klip: Klip) => kirim({ jenis: 'selesai', klip }), [])
  return { klip: keadaan.klip, klik, selesai }
}
