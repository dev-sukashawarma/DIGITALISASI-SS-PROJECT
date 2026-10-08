'use client'

import { useCallback, useEffect, useState } from 'react'
import { RASIO_NAYRA } from './klip.gen'
import { bolehVideo, pilihFormat, type FormatAnimasi, type Sumber } from './modeTampil'
import { type PoseNayra } from './rencanaPutar'
import { useCondongKursor } from './useCondongKursor'
import { usePemutarAvatar } from './usePemutarAvatar'
import LayarKlipNayra from './LayarKlipNayra'

export type { PoseNayra } from './rencanaPutar'

interface NayraAvatarProps {
  pose?: PoseNayra
  tinggi?: number
  ketukan?: number
  animasi?: boolean
}

export default function NayraAvatar({
  pose = 'diam',
  tinggi = 140,
  ketukan = 0,
  animasi = true,
}: NayraAvatarProps) {
  const { klip, klik, selesai } = usePemutarAvatar(pose)

  useEffect(() => {
    if (ketukan > 0) klik()
  }, [ketukan, klik])

  // Deteksi perangkat (WebM untuk Desktop Chromium, WebP untuk iOS Safari)
  const [perangkat, setPerangkat] = useState<{
    format: FormatAnimasi
    hematData: boolean
  } | null>(null)

  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
    setPerangkat({
      format: pilihFormat(nav.userAgent, nav.maxTouchPoints ?? 0),
      hematData: nav.connection?.saveData === true,
    })
  }, [])

  const [videoGagal, setVideoGagal] = useState(false)
  const gagal = useCallback(() => setVideoGagal(true), [])

  const sumber: Sumber =
    perangkat &&
    bolehVideo({
      kurangiGerak: !animasi,
      hematData: perangkat.hematData,
      videoGagal,
    })
      ? perangkat.format
      : 'gambar'

  // Cursor tilting
  const { ref, rotate, x } = useCondongKursor(animasi)

  // Klik tap bounce reaction
  const [bouncing, setBouncing] = useState(false)
  useEffect(() => {
    if (ketukan > 0) {
      setBouncing(true)
      const t = setTimeout(() => setBouncing(false), 350)
      return () => clearTimeout(t)
    }
  }, [ketukan])

  const lebar = Math.round(tinggi * RASIO_NAYRA)

  return (
    <div
      ref={ref}
      style={{
        width: lebar,
        height: tinggi,
      }}
      className="relative select-none pointer-events-none"
    >
      {/* Container dengan rotasi condong & bounce */}
      <div
        style={{
          transform: `perspective(500px) rotate(${rotate}deg) translateX(${x}px) ${
            bouncing ? 'scale(1.1) translateY(-6px)' : 'scale(1)'
          }`,
          transformOrigin: '50% 95%',
          transition: bouncing
            ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 0.08s ease-out',
        }}
        className="relative w-full h-full select-none"
      >
        <LayarKlipNayra
          klip={klip}
          sumber={sumber}
          onSelesai={selesai}
          onGagal={gagal}
        />

        {/* Indikator Mode Pose Berpikir */}
        {klip === 'berpikir' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#1A1715]/85 backdrop-blur-xs text-white text-[9px] font-bold flex items-center gap-1 shadow-md animate-bounce">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9480F] animate-ping" />
            <span>Menganalisis...</span>
          </div>
        )}

        {/* Indikator Mode Pose Sapa / Senang */}
        {klip === 'sapa' && (
          <div className="absolute -top-3 right-0 text-base animate-ping [animation-duration:1s]">
            ✨
          </div>
        )}

        {/* Indikator Mode Pose Bingung */}
        {klip === 'bingung' && (
          <div className="absolute -top-3 right-0 text-base animate-bounce">
            ❓
          </div>
        )}
      </div>
    </div>
  )
}
