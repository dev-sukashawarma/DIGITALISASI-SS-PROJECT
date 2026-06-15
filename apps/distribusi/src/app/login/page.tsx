'use client'

import { useEffect } from 'react'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export default function LoginPage() {
  useEffect(() => {
    window.location.replace(PORTAL_URL)
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <p className="text-gray-500 text-sm">Mengalihkan ke portal login…</p>
    </div>
  )
}
