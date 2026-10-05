'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ambilBlob } from './animWebp'
import { KLIP } from './klip.gen'
import type { FormatAnimasi, Sumber } from './modeTampil'
import type { Klip } from './rencanaPutar'

const LARUT_DETIK = 0.25
const GAYA = 'absolute inset-0 h-full w-full object-contain'
type Lapisan = { kunci: number; klip: Klip; siap: boolean }

function unduhLatar(format: FormatAnimasi) {
  const jalan = () => {
    for (const info of Object.values(KLIP)) {
      if (format === 'webm') fetch(info.webm).catch(() => {})
      else ambilBlob(info.webp).catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(jalan, { timeout: 5000 })
  else setTimeout(jalan, 2000)
}

function LapisanWebp({ klip, tampak, onSiap, onGagal }: { klip: Klip; tampak: boolean; onSiap: () => void; onGagal: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let batal = false
    let dibuat: string | null = null
    ambilBlob(KLIP[klip].webp).then(
      (b) => { if (!batal) { dibuat = URL.createObjectURL(b); setUrl(dibuat) } },
      () => { if (!batal) onGagal() },
    )
    return () => { batal = true; if (dibuat) URL.revokeObjectURL(dibuat) }
  }, [klip, onGagal])
  if (!url) return null
  return (
    <m.img src={url} alt="" draggable={false} className={GAYA}
      initial={{ opacity: 0 }} animate={{ opacity: tampak ? 1 : 0 }} transition={{ duration: LARUT_DETIK }}
      onLoad={onSiap} onError={onGagal} />
  )
}

/**
 * Gambar diam pose selalu ada di bawah (tampil sebelum animasi siap). Klip baru dimuat di lapisan
 * tak terlihat, dilarutkan saat mulai berputar, lalu lapisan lama dibuang.
 */
export default function LayarKlip({ klip, sumber, onSelesai, onGagal }: {
  klip: Klip
  sumber: Sumber
  onSelesai: (klip: Klip) => void
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
      // Mode gambar tidak merender lapisan animasi, jadi lapisan lama tak perlu disimpan.
      return sumber === 'gambar' ? [baru] : [...l, baru]
    })
  }, [klip, sumber])

  // WebP & gambar tak punya event `ended`: klip sekali-putar dianggap selesai setelah durasinya.
  const jadwalSelesai = useCallback((k: Klip) => {
    clearTimeout(timerSelesai.current)
    if (!KLIP[k].ulang) timerSelesai.current = setTimeout(() => onSelesai(k), KLIP[k].durasiMs)
  }, [onSelesai])
  useEffect(() => () => clearTimeout(timerSelesai.current), [])
  useEffect(() => { if (sumber === 'gambar') jadwalSelesai(klip) }, [klip, sumber, jadwalSelesai])

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

  const tandaiSiap = useCallback((l: Lapisan) => {
    setLapisan((xs) => xs.map((x) => (x.kunci === l.kunci ? { ...x, siap: true } : x)))
    setTimeout(() => setLapisan((xs) => xs.filter((x) => x.kunci >= l.kunci)), LARUT_DETIK * 1000 + 50)
    if (sumber === 'webp') jadwalSelesai(l.klip)
    if (!sudahUnduh.current && sumber !== 'gambar') { sudahUnduh.current = true; unduhLatar(sumber) }
  }, [sumber, jadwalSelesai])

  const mulaiPutar = useCallback((el: HTMLVideoElement | null) => {
    el?.play().catch((e: unknown) => {
      const nama = (e as { name?: string } | null)?.name
      // AbortError = dibuang di tengah jalan / tab tersembunyi (normal); hanya penolakan nyata = gagal.
      if (nama === 'NotAllowedError' || nama === 'NotSupportedError') onGagal()
    })
  }, [onGagal])

  // Animasi transparan: gambar diam & lapisan lama wajib hilang saat lapisan baru tampil,
  // kalau tidak chef terlihat dobel (yang lama tembus di belakang yang bergerak).
  const adaSiap = sumber !== 'gambar' && lapisan.some((l) => l.siap)
  return (
    <div ref={wadah} className="absolute inset-0">
      <AnimatePresence initial={false}>
        {!adaSiap && (
          <m.img key={klip} src={KLIP[klip].gambar} alt="" draggable={false} className={GAYA}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: LARUT_DETIK }} />
        )}
      </AnimatePresence>
      {sumber !== 'gambar' && lapisan.map((l, i) => {
        const atas = i === lapisan.length - 1
        const tampak = l.siap && !lapisan.slice(i + 1).some((x) => x.siap)
        // Hanya lapisan teratas yang boleh tampil: klip lama yang telat mulai tidak boleh menyela.
        const onSiap = () => { if (atas && !l.siap) tandaiSiap(l) }
        if (sumber === 'webp') {
          return <LapisanWebp key={l.kunci} klip={l.klip} tampak={tampak} onSiap={onSiap} onGagal={onGagal} />
        }
        const info = KLIP[l.klip]
        return (
          <m.video key={l.kunci} ref={mulaiPutar} src={info.webm} aria-hidden muted playsInline autoPlay
            preload="auto" loop={info.ulang} className={GAYA}
            initial={{ opacity: 0 }} animate={{ opacity: tampak ? 1 : 0 }} transition={{ duration: LARUT_DETIK }}
            onPlaying={onSiap}
            onEnded={() => { if (atas && !info.ulang) onSelesai(l.klip) }}
            onError={onGagal} />
        )
      })}
    </div>
  )
}
