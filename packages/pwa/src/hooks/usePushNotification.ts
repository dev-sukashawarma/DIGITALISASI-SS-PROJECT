'use client'

import { useState, useEffect, useCallback } from 'react'
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '../vapid'

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export function usePushNotification() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSupport = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        setIsSupported(true)
        try {
          const registration = await navigator.serviceWorker.ready
          const sub = await registration.pushManager.getSubscription()
          if (sub) {
            setSubscription(sub)
            setIsSubscribed(true)
          }
        } catch (e) {
          console.error('Error checking push subscription:', e)
        }
      }
      setIsLoading(false)
    }
    checkSupport()
  }, [])

  const subscribe = useCallback(async (): Promise<PushSubscriptionData | null> => {
    if (!isSupported) throw new Error('Push notifications are not supported in this browser')
    
    setIsLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      })

      setSubscription(sub)
      setIsSubscribed(true)
      
      const subJSON = sub.toJSON()
      // You should send this data to your backend (e.g. Supabase)
      return {
        endpoint: subJSON.endpoint as string,
        keys: {
          p256dh: subJSON.keys?.p256dh as string,
          auth: subJSON.keys?.auth as string,
        }
      }
    } catch (e) {
      console.error('Failed to subscribe:', e)
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return

    setIsLoading(true)
    try {
      await subscription.unsubscribe()
      setSubscription(null)
      setIsSubscribed(false)
      // Also remember to call your backend to remove the subscription
      return true
    } catch (e) {
      console.error('Failed to unsubscribe:', e)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [subscription])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscription,
    subscribe,
    unsubscribe,
  }
}
