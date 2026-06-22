'use client'

import { useEffect } from 'react'

const DING_SOUND = '/sound-pesanan.mp3'

// Browser memblokir audio berbunyi otomatis tanpa interaksi user (autoplay
// policy) — ini pembatasan keamanan browser yang tidak bisa di-bypass dari
// JavaScript. Solusinya: "unlock" audio sedini mungkin, di level root layout,
// supaya interaksi APA PUN di seluruh app (termasuk klik tombol Login) sudah
// cukup membuka izin — bukan menunggu kasir berinteraksi di halaman /kasir.
//
// Catatan: izin ini melekat ke document/tab (bukan ke instance Audio
// tertentu), dan navigasi client-side Next.js (App Router) tidak reload
// dokumen — jadi izin yang didapat di halaman Login tetap terbawa sampai
// ke halaman /kasir.
export default function AudioUnlockMount() {
  useEffect(() => {
    const audio = new Audio(DING_SOUND)

    const unlock = () => {
      audio.play().then(() => {
        audio.pause()
        audio.currentTime = 0
      }).catch(() => {})
    }

    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    window.addEventListener('touchstart', unlock, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [])

  return null
}
