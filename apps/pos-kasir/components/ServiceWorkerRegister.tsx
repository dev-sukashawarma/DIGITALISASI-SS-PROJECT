'use client'

import { useEffect } from 'react'

/**
 * Registrasi manual service worker (public/sw.js).
 * Diperlukan karena Next 16 build memakai Turbopack — plugin webpack
 * @serwist/next tidak jalan, jadi auto-registrasinya juga tidak ada.
 * sw.js dibundel oleh scripts/build-sw.mjs saat `prebuild`.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[SW] Registrasi service worker gagal:', err))
  }, [])

  return null
}
