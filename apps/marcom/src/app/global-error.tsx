'use client'

import { useEffect } from 'react'

/**
 * Jaring terakhir. `app/error.tsx` TIDAK menangkap error yang dilempar oleh
 * root layout maupun oleh error boundary itu sendiri — tanpa berkas ini, Next
 * menampilkan halaman bawaannya ("This page couldn't load") yang hanya memuat
 * digest, tanpa satu pun petunjuk. Layar inilah yang tampil di insiden
 * 2026-09-18 pada /dashboard.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global application error:', error)
  }, [error])

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAF8F5',
          color: '#1A1715',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: '100%',
            background: '#fff',
            border: '1px solid #EFE8DE',
            borderRadius: 24,
            padding: 28,
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
            Terjadi Kesalahan Server
          </h2>
          <p style={{ fontSize: 13, color: '#78716c', margin: '0 0 12px' }}>
            {error.message ||
              'Aplikasi mengalami kendala saat memuat data. Silakan muat ulang.'}
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                color: '#a8a29e',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                background: '#FAFAF9',
                border: '1px solid #EFE8DE',
                borderRadius: 8,
                padding: '4px 8px',
                display: 'inline-block',
                margin: '0 0 16px',
              }}
            >
              Digest: {error.digest}
            </p>
          )}
          <div>
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: 'none',
                background: '#D9480F',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
