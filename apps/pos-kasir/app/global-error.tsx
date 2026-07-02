"use client"

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string; statusCode?: number }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Next.js Global Error Boundary Caught:', error)
  }, [error])

  // Deteksi kode error, default 500
  let statusCode = error.statusCode || 500
  if (error.message.includes('503')) statusCode = 503
  if (error.message.includes('501')) statusCode = 501
  if (error.message.includes('403')) statusCode = 403

  return (
    <html>
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '16px' }}>
          <div style={{ textAlign: 'center', padding: '48px 32px', background: 'white', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '28rem', width: '100%', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', marginBottom: '24px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
              </svg>
            </div>
            <h1 style={{ fontSize: '4rem', fontWeight: 900, color: '#111827', margin: '0 0 8px 0', lineHeight: 1 }}>{statusCode}</h1>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', margin: '0 0 16px 0' }}>Kesalahan Sistem Fatal</h2>
            <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '8px', marginBottom: '24px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <code style={{ color: '#4b5563', fontSize: '12px', fontFamily: 'monospace' }}>{error.message || 'Internal Server Error'}</code>
            </div>
            <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.5, margin: '0 0 32px 0' }}>
              Sistem inti gagal memuat halaman ini karena gangguan teknis.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => reset()} 
                style={{ width: '100%', padding: '14px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}
              >
                Coba Muat Ulang
              </button>
              <button 
                onClick={() => window.location.href = '/'} 
                style={{ width: '100%', padding: '14px 16px', background: 'white', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}
              >
                Kembali ke Awal
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
