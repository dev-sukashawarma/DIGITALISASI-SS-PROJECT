'use client'

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UsePwaInstallReturn {
  /** Whether the browser supports PWA install and the prompt is available */
  isInstallable: boolean
  /** Whether the app is already installed (running in standalone mode) */
  isInstalled: boolean
  /** Trigger the native install prompt */
  promptInstall: () => Promise<boolean>
  /** Dismiss the install UI (stores preference in localStorage) */
  dismiss: () => void
  /** Whether user has previously dismissed the install prompt */
  isDismissed: boolean
}

const DISMISS_KEY = 'suka-pwa-install-dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true

      setIsInstalled(isStandalone)

      // Check dismiss timestamp
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10)
        if (elapsed < DISMISS_DURATION_MS) {
          setIsDismissed(true)
        } else {
          localStorage.removeItem(DISMISS_KEY)
        }
      }
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for successful install
    const onInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return outcome === 'accepted'
    } catch {
      return false
    }
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }, [])

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
    dismiss,
    isDismissed,
  }
}
