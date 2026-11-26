'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ShieldAlert, RotateCw, ExternalLink } from 'lucide-react'
import { safeInternalPath, searchTanpaToken } from './urlAman'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

type HandoffResponse = {
  ok?: boolean
  error?: string
}

type HandoffPayload = {
  tokenHash: string | null
  accessToken: string | null
  refreshToken: string | null
  next: string
}

/**
 * Serah-terima sesi SSO dari notifikasi SUKA Kerja SuperApps / POS Android ke Web Finance.
 *
 * Mendukung dua mode:
 * 1. `token_hash` (magiclink sekali pakai dari Edge Function `pos-sso-handoff` — membuat
 *    sesi web mandiri tanpa merotasi refresh token milik aplikasi Android).
 * 2. Pasangan `access_token` + `refresh_token`.
 */
export default function FinanceSsoHandoffPage() {
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const handoffRef = useRef<HandoffPayload | null>(null)

  useEffect(() => {
    let cancelled = false

    async function handoff() {
      if (!handoffRef.current) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const searchParams = new URLSearchParams(window.location.search)

        const tokenHash =
          hashParams.get('token_hash') ||
          searchParams.get('token_hash') ||
          hashParams.get('tokenHash') ||
          searchParams.get('tokenHash')

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

        const nextParam = hashParams.get('next') || searchParams.get('next')
        const safeNext = safeInternalPath(nextParam, window.location.origin)

        if (!tokenHash && (!accessToken || !refreshToken)) {
          const targetFull = `${window.location.origin}${safeNext}`
          window.location.replace(`${PORTAL_URL}/?next=${encodeURIComponent(targetFull)}`)
          return
        }

        handoffRef.current = {
          tokenHash: tokenHash?.trim() || null,
          accessToken: accessToken?.trim() || null,
          refreshToken: refreshToken?.trim() || null,
          next: safeNext,
        }

        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${searchTanpaToken(window.location.search)}`
        )
      }

      const { tokenHash, accessToken, refreshToken, next } = handoffRef.current
      setError(null)

      try {
        const response = await fetch('/api/auth/sso', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token_hash: tokenHash,
            tokenHash,
            access_token: accessToken,
            refresh_token: refreshToken,
            accessToken,
            refreshToken,
          }),
        })
        const result = (await response.json().catch(() => ({}))) as HandoffResponse

        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Sesi Finance tidak dapat disiapkan. Silakan masuk melalui portal.')
        }

        window.location.replace(next)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Gagal memproses sesi masuk')
        }
      }
    }

    void handoff()
    return () => {
      cancelled = true
    }
  }, [attempt])

  const fallbackPortalUrl =
    typeof window !== 'undefined'
      ? `${PORTAL_URL}/?next=${encodeURIComponent(`${window.location.origin}${handoffRef.current?.next ?? '/approval'}`)}`
      : PORTAL_URL

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fff8f1] px-6 text-center font-sans">
      <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
        {error ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-stone-900">Sesi otomatis belum berhasil</p>
            <p className="text-xs leading-relaxed text-stone-600">{error}</p>
            <div className="mt-2 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => setAttempt((v) => v + 1)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-orange-700 cursor-pointer"
              >
                <RotateCw className="h-4 w-4" />
                <span>Coba Lagi</span>
              </button>
              <a
                href={fallbackPortalUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Masuk lewat Portal</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            <p className="text-sm font-bold text-stone-900">Menyiapkan Dashboard Finance</p>
            <p className="text-xs text-stone-500">Membuka halaman Hub Approval secara otomatis...</p>
          </div>
        )}
      </div>
    </div>
  )
}
