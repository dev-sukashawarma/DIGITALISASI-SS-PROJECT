'use client'
import { useCallback, useEffect, useState } from 'react'
import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from 'framer-motion'
import LayarKlip from './avatar/LayarKlip'
import { bolehVideo } from './avatar/modeTampil'
import type { Pose } from './avatar/rencanaPutar'
import { useCondongKursor } from './avatar/useCondongKursor'
import { usePemutarAvatar } from './avatar/usePemutarAvatar'

export type { Pose } from './avatar/rencanaPutar'

/** Chef SUKA Bot: klip video per pose (lihat avatar/rencanaPutar.ts) + reaksi kursor/hover/klik. */
export default function AvatarSukaBot({ pose = 'diam', ukuran = 56 }: { pose?: Pose; ukuran?: number }) {
  const { klip, klik, selesai } = usePemutarAvatar(pose)
  const kurangiGerak = useReducedMotion() ?? false
  // Server tidak tahu preferensi perangkat: render pertama selalu gambar, video diputuskan setelah mount.
  const [diKlien, setDiKlien] = useState(false)
  const [hematData, setHematData] = useState(false)
  const [videoGagal, setVideoGagal] = useState(false)
  useEffect(() => {
    setHematData((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true)
    setDiKlien(true)
  }, [])
  const gagal = useCallback(() => setVideoGagal(true), [])
  const video = diKlien && bolehVideo({ kurangiGerak, hematData, videoGagal })
  const { ref, rotate, x } = useCondongKursor(!kurangiGerak)

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <div ref={ref} style={{ width: ukuran, height: ukuran }} aria-hidden>
          <m.div
            onClick={klik}
            style={{ rotate, x }}
            className="relative h-full w-full rounded-full overflow-hidden bg-suka-orange shadow-lg select-none"
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <LayarKlip klip={klip} video={video} onSelesai={selesai} onGagal={gagal} />
          </m.div>
        </div>
      </LazyMotion>
    </MotionConfig>
  )
}
