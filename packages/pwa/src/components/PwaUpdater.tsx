'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Detects when a new service worker version is available and shows
 * a toast-style notification prompting the user to reload.
 * 
 * When user clicks "Update", sends SKIP_WAITING to the waiting SW
 * and reloads the page so the new version takes effect immediately.
 */
export function PwaUpdater() {
  const [showUpdate, setShowUpdate] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const onControllerChange = () => {
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker.ready.then((reg) => {
      // Check for waiting SW on load
      if (reg.waiting) {
        setRegistration(reg)
        setShowUpdate(true)
        return
      }

      // Listen for new SW installing
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW waiting — show update prompt
            setRegistration(reg)
            setShowUpdate(true)
          }
        })
      })
    })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const handleUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    setShowUpdate(false)
  }, [registration])

  if (!showUpdate) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: '#1f2937',
        color: '#ffffff',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontSize: '0.875rem',
        maxWidth: '24rem',
        animation: 'suka-pwa-slide-down 0.3s ease-out',
      }}
    >
      <span style={{ fontSize: '1.125rem' }}>🔄</span>

      <span style={{ flex: 1 }}>Versi baru tersedia</span>

      <button
        onClick={handleUpdate}
        style={{
          padding: '0.375rem 0.875rem',
          background: '#0a7d2c',
          color: '#ffffff',
          border: 'none',
          borderRadius: '0.375rem',
          fontWeight: 600,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Update
      </button>

      <button
        onClick={() => setShowUpdate(false)}
        aria-label="Tutup"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          padding: '0.25rem',
          fontSize: '1rem',
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes suka-pwa-slide-down {
          from { opacity: 0; transform: translateX(-50%) translateY(-1rem); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
