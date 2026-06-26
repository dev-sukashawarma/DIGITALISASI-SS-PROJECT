'use client'

import { usePwaInstall } from '../hooks/usePwaInstall'

interface InstallPromptProps {
  /** App display name shown in the install banner */
  appName: string
}

/**
 * Floating install banner that appears when the PWA is installable.
 * Auto-hides if user dismisses (7-day cooldown) or app is already installed.
 * 
 * Uses SUKA brand colors for consistent look across all apps.
 */
export function InstallPrompt({ appName }: InstallPromptProps) {
  const { isInstallable, isDismissed, promptInstall, dismiss } = usePwaInstall()

  if (!isInstallable || isDismissed) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        background: 'linear-gradient(135deg, #0a7d2c 0%, #087025 100%)',
        color: '#ffffff',
        borderRadius: '0.875rem',
        boxShadow: '0 10px 25px -5px rgba(10, 125, 44, 0.3), 0 4px 10px -4px rgba(0, 0, 0, 0.2)',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontSize: '0.875rem',
        maxWidth: '28rem',
        margin: '0 auto',
        animation: 'suka-pwa-slide-up 0.4s ease-out',
      }}
    >
      <div
        style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '0.625rem',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '1.25rem',
        }}
      >
        📲
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: '0.125rem' }}>
          Install {appName}
        </div>
        <div style={{ opacity: 0.85, fontSize: '0.75rem' }}>
          Akses cepat dari home screen
        </div>
      </div>

      <button
        onClick={async () => { await promptInstall() }}
        style={{
          padding: '0.5rem 1rem',
          background: '#f29744',
          color: '#701604',
          border: 'none',
          borderRadius: '0.5rem',
          fontWeight: 700,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          flexShrink: 0,
          fontFamily: 'inherit',
        }}
      >
        Install
      </button>

      <button
        onClick={dismiss}
        aria-label="Tutup"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          padding: '0.25rem',
          fontSize: '1.125rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes suka-pwa-slide-up {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
