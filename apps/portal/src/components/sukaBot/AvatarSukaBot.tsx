'use client'
import { useState } from 'react'

export type Pose = 'diam' | 'berpikir' | 'rekap' | 'bingung'

/** Gambar pose di /public/suka-bot/<pose>.webp. Sampai aset jadi: lingkaran oranye "SB". */
export default function AvatarSukaBot({ pose = 'diam', ukuran = 56 }: { pose?: Pose; ukuran?: number }) {
  const [gagal, setGagal] = useState(false)
  if (gagal) {
    return (
      <div style={{ width: ukuran, height: ukuran }} className="rounded-full bg-gradient-to-br from-suka-orange to-suka-brown text-white font-bold flex items-center justify-center shadow-lg select-none">
        SB
      </div>
    )
  }
  return (
    <img
      src={`/suka-bot/${pose}.webp`}
      alt="SUKA Bot"
      width={ukuran}
      height={ukuran}
      onError={() => setGagal(true)}
      className={`rounded-full shadow-lg ${pose === 'berpikir' ? 'animate-pulse' : 'motion-safe:animate-[bounce_3s_ease-in-out_infinite]'}`}
    />
  )
}
