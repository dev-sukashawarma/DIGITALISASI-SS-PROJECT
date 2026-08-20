'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'
const SESSION_TIMEOUT_MS = 15_000

/**
 * Client khusus halaman handoff.
 *
 * Root `Providers` sudah membuat client global yang mendeteksi token URL secara
 * otomatis. Jika client itu dan halaman ini sama-sama memproses fragment SSO,
 * Chrome Android dapat menunggu inisialisasi yang sama tanpa selesai. Client
 * ini sengaja mematikan deteksi fragment otomatis; token di bawah hanya diproses
 * satu kali dan cookie yang dihasilkan tetap memakai konfigurasi suite yang sama.
 */
function createSsoHandoffClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 31536000,
      },
      auth: {
        detectSessionInUrl: false,
        autoRefreshToken: false,
      },
    }
  )
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error('Sesi Stok tidak merespons. Silakan coba lagi.')),
      timeoutMs
    )
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

/**
 * Serah-terima sesi dari app native (POS Android) ke web stok.
 *
 * Token dikirim di URL *fragment* (`#access_token=...&refresh_token=...`), bukan
 * query string: fragment tidak pernah ikut ke server, jadi tidak nyangkut di
 * access log Vercel/CDN maupun Referer. Di sini token ditukar jadi cookie sesi
 * lewat browser client @supabase/ssr — cookie yang sama persis dibaca middleware
 * `enforceAppAccess`, jadi user langsung masuk tanpa login ulang.
 *
 * Rute ini dikecualikan dari matcher middleware (lihat src/middleware.ts) karena
 * saat dibuka user memang belum punya cookie.
 */
export default function SsoHandoffPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    // Hanya path internal — cegah open redirect lewat `next=https://...`.
    const nextParam = params.get('next') || '/dashboard'
    const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

    if (!accessToken || !refreshToken) {
      window.location.replace(PORTAL_URL)
      return
    }

    const client = createSsoHandoffClient()
    withTimeout(
      client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
      SESSION_TIMEOUT_MS
    )
      .then(({ error }) => {
        if (error) {
          setError(error.message)
          return
        }
        // Buang token dari history supaya tidak tertinggal di back-stack browser.
        window.location.replace(next)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Gagal memproses sesi'))
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fff8f1] px-6 text-center">
      {error ? (
        <>
          <p className="text-base font-semibold text-red-700">Sesi tidak bisa dilanjutkan</p>
          <p className="text-sm text-neutral-600">{error}</p>
          <a href={PORTAL_URL} className="mt-2 text-sm font-semibold text-orange-700 underline">
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
