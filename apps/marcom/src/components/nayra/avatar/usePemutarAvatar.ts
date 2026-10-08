'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { AWAL, langkah, type KlipNayra, type PoseNayra } from './rencanaPutar'

export function usePemutarAvatar(pose: PoseNayra): {
  klip: KlipNayra
  klik: () => void
  selesai: (klip: KlipNayra) => void
} {
  const [keadaan, kirim] = useReducer(langkah, pose, (p) =>
    langkah(AWAL, { jenis: 'pose', pose: p })
  )

  useEffect(() => {
    kirim({ jenis: 'pose', pose })
  }, [pose])

  const klik = useCallback(() => kirim({ jenis: 'klik' }), [])
  const selesai = useCallback((klip: KlipNayra) => kirim({ jenis: 'selesai', klip }), [])

  return { klip: keadaan.klip, klik, selesai }
}
