'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { KLIP } from './klip.gen'
import type { Klip } from './rencanaPutar'

const LARUT_DETIK = 0.25
type Lapisan = { kunci: number; klip: Klip; siap: boolean }

function unduhKlipLainDiLatar() {
  const jalan = () => { for (const info of Object.values(KLIP)) fetch(info.video).catch(() => {}) }
  if ('requestIdleCallback' in window) window.requestIdleCallback(jalan, { timeout: 5000 })
  else setTimeout(jalan, 2000)
}

/**
 * Gambar pose selalu ada di bawah (tampil sebelum video siap). Di mode video, klip baru dimuat
 * di lapisan tak terlihat, dilarutkan saat mulai berputar, lalu lapisan lama dibuang.
 */
export default function LayarKlip({ klip, video, onSelesai, onGagal }: {
  klip: Klip
  video: boolean
  onSelesai: (klip: Klip) => void
  onGagal: () => void
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const sudahUnduh = useRef(false)
  const [lapisan, setLapisan] = useState<Lapisan[]>([{ kunci: 0, klip, siap: false }])

  useEffect(() => {
    setLapisan((l) => {
      const atas = l[l.length - 1]
      if (atas.klip === klip) return l
      const baru = { kunci: atas.kunci + 1, klip, siap: false }
      // Mode gambar tidak merender video, jadi lapisan lama tak perlu disimpan.
      return video ? [...l, baru] : [baru]
    })
  }, [klip, video])

  // Mode gambar: klip sekali-putar dianggap selesai setelah durasinya.
  useEffect(() => {
    if (video || KLIP[klip].ulang) return
    const t = setTimeout(() => onSelesai(klip), KLIP[klip].durasiMs)
    return () => clearTimeout(t)
  }, [klip, video, onSelesai])

  useEffect(() => {
    const saat = () => {
      wadah.current?.querySelectorAll('video').forEach((v) => {
        if (document.hidden) v.pause()
        else if (!v.ended) v.play().catch(() => {})
      })
    }
    document.addEventListener('visibilitychange', saat)
    return () => document.removeEventListener('visibilitychange', saat)
  }, [])

  const tandaiSiap = useCallback((kunci: number) => {
    setLapisan((l) => l.map((x) => (x.kunci === kunci ? { ...x, siap: true } : x)))
    setTimeout(() => setLapisan((l) => l.filter((x) => x.kunci >= kunci)), LARUT_DETIK * 1000 + 50)
    if (!sudahUnduh.current) { sudahUnduh.current = true; unduhKlipLainDiLatar() }
  }, [])

  const mulaiPutar = useCallback((el: HTMLVideoElement | null) => {
    el?.play().catch((e: unknown) => {
      const nama = (e as { name?: string } | null)?.name
      // AbortError = elemen dibuang di tengah jalan (normal); hanya penolakan nyata yang dianggap gagal.
      if (nama === 'NotAllowedError' || nama === 'NotSupportedError') onGagal()
    })
  }, [onGagal])

  return (
    <div ref={wadah} className="absolute inset-0">
      <AnimatePresence initial={false}>
        <m.img
          key={klip}
          src={KLIP[klip].gambar}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: LARUT_DETIK }}
        />
      </AnimatePresence>
      {video && lapisan.map((l, i) => {
        const atas = i === lapisan.length - 1
        const info = KLIP[l.klip]
        return (
          <m.video
            key={l.kunci}
            ref={mulaiPutar}
            src={info.video}
            aria-hidden
            muted
            playsInline
            autoPlay
            preload="auto"
            loop={info.ulang}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: l.siap ? 1 : 0 }}
            transition={{ duration: LARUT_DETIK }}
            // Hanya lapisan teratas yang boleh tampil: klip lama yang telat mulai tidak boleh menyela.
            onPlaying={() => { if (atas && !l.siap) tandaiSiap(l.kunci) }}
            onEnded={() => { if (atas && !info.ulang) onSelesai(l.klip) }}
            onError={onGagal}
          />
        )
      })}
    </div>
  )
}
