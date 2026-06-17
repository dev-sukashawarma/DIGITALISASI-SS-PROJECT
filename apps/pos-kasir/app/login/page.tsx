'use client'

import { useEffect } from 'react'

// Login staff (admin/kasir) kini lewat Portal (gerbang SSO tunggal). Halaman ini
// hanya meneruskan ke Portal. Device kiosk TIDAK lewat sini — diaktivasi kasir
// via `/kiosk/qr-login`. Lihat ADR-008.
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export default function LoginRedirectPage() {
  useEffect(() => {
    window.location.replace(PORTAL_URL)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
      <p className="text-gray-500 text-sm font-medium">Mengalihkan ke portal login…</p>
    </div>
  )
}
