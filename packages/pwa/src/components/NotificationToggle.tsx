'use client'

import { useState } from 'react'
import { usePushNotification, PushSubscriptionData } from '../hooks/usePushNotification'

export interface NotificationToggleProps {
  appName: string
  onSubscribe: (data: PushSubscriptionData) => Promise<void>
  onUnsubscribe: () => Promise<void>
}

export function NotificationToggle({ appName, onSubscribe, onUnsubscribe }: NotificationToggleProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotification()
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isSupported) {
    return (
      <div className="p-4 bg-gray-50 text-sm text-gray-500 rounded-lg">
        Browser Anda tidak mendukung push notification.
      </div>
    )
  }

  const handleToggle = async () => {
    setIsProcessing(true)
    try {
      if (isSubscribed) {
        await unsubscribe()
        await onUnsubscribe()
      } else {
        const subData = await subscribe()
        if (subData) {
          await onSubscribe(subData)
        }
      }
    } catch (e) {
      console.error('Failed to toggle push notification', e)
      alert('Gagal mengatur notifikasi. Pastikan Anda mengizinkan notifikasi di browser.')
    } finally {
      setIsProcessing(false)
    }
  }

  const disabled = isLoading || isProcessing

  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Notifikasi {appName}</h3>
        <p className="text-xs text-gray-500 mt-1">
          Dapatkan pemberitahuan langsung ke perangkat Anda.
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0a7d2c] focus:ring-offset-2 ${
          isSubscribed ? 'bg-[#0a7d2c]' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        role="switch"
        aria-checked={isSubscribed}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isSubscribed ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
