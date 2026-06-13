'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueueStorage } from './storage'
import { QueueItem, UseOfflineQueueOptions } from './types'

export function useOfflineQueue<T = any>(
  storageKey: string,
  options: UseOfflineQueueOptions = {}
) {
  const {
    maxRetries: _maxRetries = 3,
    retryDelay: _retryDelay = 1000,
  } = options

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

  // Load from localStorage on mount
  useEffect(() => {
    const items = storage.get()
    setState(prev => ({ ...prev, items }))

    // Listen for online/offline events
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Add item to queue
  const add = useCallback((data: T) => {
    const id = Math.random().toString(36).substr(2, 9)
    const item: QueueItem<T> = {
      id,
      timestamp: Date.now(),
      data,
      retries: 0,
    }
    setState(prev => {
      const newItems = [...prev.items, item]
      storage.set(newItems)
      return { ...prev, items: newItems }
    })
    return item.id
  }, [])

  // Flush queue (submit to server)
  const flush = useCallback(
    async (submitFn: (items: QueueItem<T>[]) => Promise<any>) => {
      if (state.items.length === 0) return { success: true, submitted: 0 }

      setState(prev => ({ ...prev, isPending: true }))

      try {
        await submitFn(state.items)
        storage.clear()
        setState(prev => ({
          ...prev,
          items: [],
          isPending: false,
        }))
        return { success: true, submitted: state.items.length }
      } catch (error) {
        console.error('Queue flush failed:', error)
        setState(prev => ({ ...prev, isPending: false }))
        return { success: false, error, submitted: 0 }
      }
    },
    [state.items]
  )

  return {
    queue: state.items,
    add,
    flush,
    isPending: state.isPending,
    isOnline: state.isOnline,
  }
}
