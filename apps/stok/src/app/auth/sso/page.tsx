'use client'

import { useEffect, useRef, useState } from 'react'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

type HandoffResponse = {
  ok?: boolean
  error?: string
}

function safeInternalPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

/**
 * Serah-terima sesi dari POS Android.
 *
 * Token tetap datang melalui URL fragment agar tidak masuk access log. Halaman
 * ini segera menghapus fragment dari address bar, lalu menukarnya menjadi cookie
 * melalui route handler same-origin. Penukaran sengaja dilakukan di server:
 * AuthProvider pada root layout juga menginisialisasi Supabase di browser dan
 * operasi auth yang bersamaan dapat saling menunggu di Chrome Android.
 */
export default function SsoHandoffPage() {
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const handoffRef = useRef<{ accessToken: string; refreshToken: string; next: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function handoff() {
      if (!handoffRef.current) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const searchParams = new URLSearchParams(window.location.search)

        const accessToken =
          hashParams.get('access_token') ||
          searchParams.get('access_token') ||
          hashParams.get('accessToken') ||
          searchParams.get('accessToken')

        const refreshToken =
          hashParams.get('refresh_token') ||
          searchParams.get('refresh_token') ||
          hashParams.get('refreshToken') ||
          searchParams.get('refreshToken')

        const nextParam =
          hashParams.get('next') ||
          searchParams.get('next')

        if (!accessToken || !refreshToken) {
          window.location.replace(PORTAL_URL)
          return
        }

        handoffRef.current = {
          accessToken: accessToken.trim(),
          refreshToken: refreshToken.trim(),
          next: safeInternalPath(nextParam),
        }

        // Token tidak boleh tertinggal di address bar/history walaupun request gagal.
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
      }

      const { accessToken, refreshToken, next } = handoffRef.current
      setError(null)

      try {
        const response = await fetch('/api/auth/sso', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            accessToken,
            refreshToken,
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        })
        const result = (await response.json().catch(() => ({}))) as HandoffResponse

        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Sesi Stok tidak dapat dibuat. Silakan coba lagi.')
        }

        window.location.replace(next)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Gagal memproses sesi')
        }
      }
    }

    void handoff()
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fff8f1] px-6 text-center">
      {error ? (
        <>
          <p className="text-base font-semibold text-red-700">Sesi tidak bisa dilanjutkan</p>
          <p className="text-sm text-neutral-600">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-2 text-sm font-semibold text-orange-700 underline"
          >
            Coba lagi
          </button>
          <a href={PORTAL_URL} className="text-sm text-neutral-600 underline">
            Login manual di portal
          </a>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-neutral-600">Menyiapkan sesi stok outlet…</p>
        </>
      )}
    </div>
  )
}
