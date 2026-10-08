'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { KLIP_NAYRA, type KlipNayra } from './klip.gen'
import type { FormatAnimasi, Sumber } from './modeTampil'
import { ambilBlob } from './animWebp'

const LARUT_MS = 250
const GAYA = 'absolute inset-0 h-full w-full object-contain pointer-events-none'

type Lapisan = { kunci: number; klip: KlipNayra; siap: boolean }

function unduhLatar(format: FormatAnimasi) {
  const jalan = () => {
    for (const info of Object.values(KLIP_NAYRA)) {
      if (format === 'webm') fetch(info.webm).catch(() => {})
      else ambilBlob(info.webp).catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(jalan, { timeout: 5000 })
  } else {
    setTimeout(jalan, 2000)
  }
}

function LapisanWebp({
  klip,
  tampak,
  onSiap,
  onGagal,
}: {
  klip: KlipNayra
  tampak: boolean
  onSiap: () => void
  onGagal: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    let dibuat: string | null = null
    ambilBlob(KLIP_NAYRA[klip].webp).then(
      (b) => {
        if (!batal) {
          dibuat = URL.createObjectURL(b)
          setUrl(dibuat)
        }
      },
      () => {
        if (!batal) onGagal()
      }
    )
    return () => {
      batal = true
      if (dibuat) URL.revokeObjectURL(dibuat)
    }
  }, [klip, onGagal])

  if (!url) return null

  return (
    <img
      src={url}
      alt="Nayra Animasi WebP"
      draggable={false}
      className={`${GAYA} transition-opacity duration-300 ${tampak ? 'opacity-100' : 'opacity-0'}`}
      onLoad={onSiap}
      onError={onGagal}
    />
  )
}

export default function LayarKlipNayra({
  klip,
  sumber,
  onSelesai,
  onGagal,
}: {
  klip: KlipNayra
  sumber: Sumber
  onSelesai: (klip: KlipNayra) => void
  onGagal: () => void
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const sudahUnduh = useRef(false)
  const timerSelesai = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [lapisan, setLapisan] = useState<Lapisan[]>([{ kunci: 0, klip, siap: false }])

  useEffect(() => {
    setLapisan((l) => {
      const atas = l[l.length - 1]
      if (atas.klip === klip) return l
      const baru = { kunci: atas.kunci + 1, klip, siap: false }
      return sumber === 'gambar' ? [baru] : [...l, baru]
    })
  }, [klip, sumber])

  const jadwalSelesai = useCallback(
    (k: KlipNayra) => {
      clearTimeout(timerSelesai.current)
      if (!KLIP_NAYRA[k].ulang) {
        timerSelesai.current = setTimeout(() => onSelesai(k), KLIP_NAYRA[k].durasiMs)
      }
    },
    [onSelesai]
  )

  useEffect(() => () => clearTimeout(timerSelesai.current), [])

  useEffect(() => {
    if (sumber === 'gambar') jadwalSelesai(klip)
  }, [klip, sumber, jadwalSelesai])

  // Pause when document hidden to save CPU/battery
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

  const tandaiSiap = useCallback(
    (l: Lapisan) => {
      setLapisan((xs) => xs.map((x) => (x.kunci === l.kunci ? { ...x, siap: true } : x)))
      setTimeout(
        () => setLapisan((xs) => xs.filter((x) => x.kunci >= l.kunci)),
        LARUT_MS + 50
      )
      if (sumber === 'webp') jadwalSelesai(l.klip)
      if (!sudahUnduh.current && sumber !== 'gambar') {
        sudahUnduh.current = true
        unduhLatar(sumber)
      }
    },
    [sumber, jadwalSelesai]
  )

  const mulaiPutar = useCallback(
    (el: HTMLVideoElement | null) => {
      el?.play().catch((e: unknown) => {
        const nama = (e as { name?: string } | null)?.name
        if (nama === 'NotAllowedError' || nama === 'NotSupportedError') onGagal()
      })
    },
    [onGagal]
  )

  const adaSiap = sumber !== 'gambar' && lapisan.some((l) => l.siap)

  return (
    <div ref={wadah} className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Gambar Diam Fallback */}
      {!adaSiap && (
        <img
          src={KLIP_NAYRA[klip].gambar}
          alt="Nayra"
          draggable={false}
          className={`${GAYA} transition-opacity duration-300 opacity-100`}
        />
      )}

      {/* Lapisan Video WebM atau WebP beranimasi */}
      {sumber !== 'gambar' &&
        lapisan.map((l, i) => {
          const atas = i === lapisan.length - 1
          const tampak = l.siap && !lapisan.slice(i + 1).some((x) => x.siap)
          const onSiap = () => {
            if (atas && !l.siap) tandaiSiap(l)
          }

          if (sumber === 'webp') {
            return (
              <LapisanWebp
                key={l.kunci}
                klip={l.klip}
                tampak={tampak}
                onSiap={onSiap}
                onGagal={onGagal}
              />
            )
          }

          const info = KLIP_NAYRA[l.klip]
          return (
            <video
              key={l.kunci}
              ref={mulaiPutar}
              src={info.webm}
              aria-hidden
              muted
              playsInline
              autoPlay
              preload="auto"
              loop={info.ulang}
              className={`${GAYA} transition-opacity duration-300 ${
                tampak ? 'opacity-100' : 'opacity-0'
              }`}
              onPlaying={onSiap}
              onEnded={() => {
                if (atas && !info.ulang) onSelesai(l.klip)
              }}
              onError={onGagal}
            />
          )
        })}
    </div>
  )
}
