'use client'
import { useCallback, useEffect, useState } from 'react'
import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from 'framer-motion'
import LayarKlip from './avatar/LayarKlip'
import { RASIO } from './avatar/klip.gen'
import { bolehVideo, pilihFormat, type FormatAnimasi, type Sumber } from './avatar/modeTampil'
import type { Pose } from './avatar/rencanaPutar'
import { useCondongKursor } from './avatar/useCondongKursor'
import { usePemutarAvatar } from './avatar/usePemutarAvatar'

export type { Pose } from './avatar/rencanaPutar'

/**
 * Chef SUKA Bot seluruh badan (klip per pose, lihat avatar/rencanaPutar.ts) + reaksi kursor/hover.
 * Klik ditangani pemanggil (widget membedakan klik dari geser); `ketukan` yang bertambah memicu `sapa`.
 */
export default function AvatarSukaBot({ pose = 'diam', tinggi = 140, ketukan = 0 }: { pose?: Pose; tinggi?: number; ketukan?: number }) {
  const { klip, klik, selesai } = usePemutarAvatar(pose)
  useEffect(() => { if (ketukan > 0) klik() }, [ketukan, klik])

  const kurangiGerak = useReducedMotion() ?? false
  // Server tidak tahu perangkatnya: render pertama selalu gambar, format diputuskan setelah mount.
  const [perangkat, setPerangkat] = useState<{ format: FormatAnimasi; hematData: boolean } | null>(null)
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
    setPerangkat({ format: pilihFormat(nav.userAgent, nav.maxTouchPoints ?? 0), hematData: nav.connection?.saveData === true })
  }, [])
  const [videoGagal, setVideoGagal] = useState(false)
  const gagal = useCallback(() => setVideoGagal(true), [])
  const sumber: Sumber = perangkat && bolehVideo({ kurangiGerak, hematData: perangkat.hematData, videoGagal })
    ? perangkat.format
    : 'gambar'
  const { ref, rotate, x } = useCondongKursor(!kurangiGerak)

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <div ref={ref} style={{ width: Math.round(tinggi * RASIO), height: tinggi }} aria-hidden>
          <m.div
            style={{ rotate, x, transformOrigin: '50% 100%' }}
            className="relative h-full w-full select-none"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <LayarKlip klip={klip} sumber={sumber} onSelesai={selesai} onGagal={gagal} />
          </m.div>
        </div>
      </LazyMotion>
    </MotionConfig>
  )
}
