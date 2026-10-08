'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useCondongKursor } from './useCondongKursor'

export type PoseNayra = 'diam' | 'sapa' | 'berpikir'

interface NayraAvatarProps {
  pose?: PoseNayra
  tinggi?: number
  ketukan?: number
  animasi?: boolean
}

export default function NayraAvatar({
  pose = 'diam',
  tinggi = 130,
  ketukan = 0,
  animasi = true,
}: NayraAvatarProps) {
  // Cursor tilt
  const { ref, rotate, x } = useCondongKursor(animasi)

  // Klik tap bounce reaction
  const [bouncing, setBouncing] = useState(false)

  useEffect(() => {
    if (ketukan > 0) {
      setBouncing(true)
      const t = setTimeout(() => setBouncing(false), 400)
      return () => clearTimeout(t)
    }
  }, [ketukan])

  // Select animated or static source
  const getKlipSrc = (p: PoseNayra) => {
    switch (p) {
      case 'sapa':
        return animasi ? '/nayra/sapa.anim.webp' : '/nayra/sapa.webp'
      case 'berpikir':
        return animasi ? '/nayra/berpikir.anim.webp' : '/nayra/berpikir.webp'
      default:
        return animasi ? '/nayra/diam.anim.webp' : '/nayra/diam.webp'
    }
  }

  // Rasio aspek Nayra (width:height approx 0.7)
  const lebar = Math.round(tinggi * 0.72)

  return (
    <div
      ref={ref}
      style={{
        width: lebar,
        height: tinggi,
      }}
      className="relative select-none pointer-events-none"
    >
      {/* Glowing Aura Ring di belakang karakter */}
      <div className="absolute inset-0 -bottom-2 rounded-full bg-gradient-to-tr from-[#D9480F]/25 via-purple-500/15 to-transparent blur-md pointer-events-none" />

      {/* Container dengan rotasi condong & bounce */}
      <div
        style={{
          transform: `perspective(500px) rotate(${rotate}deg) translateX(${x}px) ${
            bouncing ? 'scale(1.1) translateY(-6px)' : 'scale(1)'
          }`,
          transformOrigin: '50% 90%',
          transition: bouncing
            ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 0.08s ease-out',
        }}
        className="relative w-full h-full"
      >
        <Image
          src={getKlipSrc(pose)}
          alt="Nayra Marketing Bot"
          width={lebar}
          height={tinggi}
          className="w-full h-full object-contain drop-shadow-xl"
          priority
          unoptimized // Diperlukan agar animasi WebP berputar lancar tanpa re-encode
        />

        {/* Indikator Mode Pose Berpikir */}
        {pose === 'berpikir' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#1A1715]/80 backdrop-blur-xs text-white text-[9px] font-bold flex items-center gap-1 shadow-md animate-bounce">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9480F] animate-ping" />
            <span>Menganalisis...</span>
          </div>
        )}

        {/* Indikator Mode Pose Sapa / Senang */}
        {pose === 'sapa' && (
          <div className="absolute -top-3 right-0 text-base animate-ping [animation-duration:1s]">
            💖
          </div>
        )}
      </div>
    </div>
  )
}
