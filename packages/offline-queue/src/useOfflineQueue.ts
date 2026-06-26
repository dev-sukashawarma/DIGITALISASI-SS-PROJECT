'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueueStorage } from './storage'
import { QueueItem, UseOfflineQueueOptions } from './types'

export function useOfflineQueue<T = any>(
  storageKey: string,
  _options: UseOfflineQueueOptions = {}
) {
  const [state, setState] = useState<{
    items: QueueItem<T>[]
    isPending: boolean
    isOnline: boolean
  }>({
    items: [],
    isPending: false,
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  })

  const storage = new QueueStorage<T>(storageKey)

  // Load from IndexedDB on mount
  useEffect(() => {
    let mounted = true
    storage.get().then((items) => {
      if (mounted) setState((prev) => ({ ...prev, items }))
    })

    // Listen for online/offline events
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }))
      // When back online, we could auto-flush if desired, but we leave it to the consumer for now.
    }
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for Service Worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FLUSH_QUEUE' && event.data.storageKey === storageKey) {
        console.log(`[Offline Queue] Background sync triggered for ${storageKey}`)
        // The consumer of useOfflineQueue should ideally handle the flush.
        // We set a flag or trigger a custom event that the consumer can listen to.
        window.dispatchEvent(new CustomEvent(`flush-queue-${storageKey}`))
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage)
    }

    return () => {
      mounted = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [storageKey])

  // Register Background Sync if supported
  const registerSync = async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready
        // Cast to any to bypass TS complaining about sync property
        await (registration as any).sync.register(`sync-${storageKey}`)
      } catch (e) {
        console.warn('Background sync registration failed:', e)
      }
    }
  }

  // Add item to queue
  const add = useCallback(async (data: T) => {
    const id = Math.random().toString(36).substr(2, 9)
    const item: QueueItem<T> = {
      id,
      timestamp: Date.now(),
      data,
      retries: 0,
    }
    
    // We update state optimistically and then persist
    setState((prev) => {
      const newItems = [...prev.items, item]
      storage.set(newItems).then(() => {
        if (!navigator.onLine) {
          registerSync()
        }
      })
      return { ...prev, items: newItems }
    })
    
    return item.id
  }, [storageKey])

  // Flush queue (submit to server)
  const flush = useCallback(
    async (submitFn: (items: QueueItem<T>[]) => Promise<any>) => {
      // Refresh latest items from IDB in case service worker mutated it
      const currentItems = await storage.get()
      if (currentItems.length === 0) {
        setState(prev => ({ ...prev, items: [] }))
        return { success: true, submitted: 0 }
      }

      setState(prev => ({ ...prev, isPending: true, items: currentItems }))

      try {
        await submitFn(currentItems)
        await storage.clear()
        setState(prev => ({
          ...prev,
          items: [],
          isPending: false,
        }))
        return { success: true, submitted: currentItems.length }
      } catch (error) {
        console.error('Queue flush failed:', error)
        setState(prev => ({ ...prev, isPending: false }))
        return { success: false, error, submitted: 0 }
      }
    },
    [storageKey]
  )

  return {
    queue: state.items,
    add,
    flush,
    isPending: state.isPending,
    isOnline: state.isOnline,
  }
}
