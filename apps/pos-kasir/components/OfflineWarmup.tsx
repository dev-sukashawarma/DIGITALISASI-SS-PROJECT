'use client'

import { useEffect } from 'react'

// Rute kasir yang di-pre-cache supaya siap dibuka offline walau belum diklik.
const WARM_ROUTES = [
  '/kasir',
  '/kasir/order-manual',
  '/kasir/histori',
  '/kasir/reports',
  '/kasir/shift',
  '/kasir/menu',
]

/**
 * "Warm-up" cache halaman kasir selagi online.
 *
 * Bagian "pintar" dari mode offline: begitu app online & idle, komponen ini
 * mengambil tiap rute kasir dalam DUA bentuk supaya Service Worker menyimpannya:
 *  1. Varian RSC (`headers: { RSC: '1' }`) → dipakai saat navigasi HALUS
 *     (klik menu sidebar). Ditangkap handler `pages-offline` di sw.ts.
 *  2. Varian dokumen (HTML) via Cache API langsung → dipakai saat navigasi
 *     KERAS (reload / ketik URL).
 *
 * Hasilnya: saat offline, semua halaman kasir bisa dibuka — bukan stuck di
 * skeleton atau layar "This site can't be reached".
 */
export default function OfflineWarmup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('caches' in window)) return

    let cancelled = false

    const warm = async () => {
      if (!navigator.onLine || cancelled) return
      let cache: Cache | null = null
      try {
        cache = await caches.open('pages-offline')
      } catch {
        cache = null
      }

      for (const path of WARM_ROUTES) {
        if (cancelled || !navigator.onLine) return
        // Varian RSC (navigasi halus)
        await fetch(path, { headers: { RSC: '1' }, credentials: 'same-origin' }).catch(() => {})
        // Varian dokumen (navigasi keras / reload)
        if (cache) {
          await cache
            .add(new Request(path, { credentials: 'same-origin' }))
            .catch(() => {})
        }
      }
    }

    const schedule = () => {
      const ric: (cb: () => void) => void =
        (window as any).requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 1500))
      ric(() => warm())
    }

    schedule()
    window.addEventListener('online', schedule)
    // Segarkan salinan berkala supaya cache tidak basi
    const interval = window.setInterval(schedule, 5 * 60 * 1000)

    return () => {
      cancelled = true
      window.removeEventListener('online', schedule)
      window.clearInterval(interval)
    }
  }, [])

  return null
}
