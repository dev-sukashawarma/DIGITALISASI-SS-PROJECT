'use client'

import { useState } from 'react'
import Image from 'next/image'

interface AttractScreenProps {
  onStart: () => void
  coverUrl: string | null
}

export default function AttractScreen({ onStart, coverUrl }: AttractScreenProps) {
  const [isLeaving, setIsLeaving] = useState(false)

  function handleTap() {
    if (isLeaving) return
    setIsLeaving(true)
    setTimeout(onStart, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-50 cursor-pointer select-none
        ${isLeaving ? 'animate-fade-out' : 'animate-fade-in'}`}
      onClick={handleTap}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt="Cover promo"
          fill
          className="object-cover"
          priority
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-amber-gradient" />
      )}

      {/* Overlay gelap agar teks terbaca di atas gambar apapun */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Tap-to-start text */}
      <div className="absolute bottom-16 left-0 right-0 text-center px-6">
        <p className="text-white text-2xl font-bold tracking-wide drop-shadow-lg animate-pulse">
          Ketuk di mana saja untuk memesan
        </p>
      </div>
    </div>
  )
}
