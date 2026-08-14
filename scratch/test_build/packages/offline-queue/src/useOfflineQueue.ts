'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueueStorage } from './storage'
import { QueueItem, UseOfflineQueueOptions, FlushOutcome } from './types'

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

  // Load from IndexedDB on mount + track connectivity.
  useEffect(() => {
    let mounted = true
    storage.get().then((items) => {
      if (mounted) setState((prev) => ({ ...prev, items }))
    })

    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }))
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      mounted = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [storageKey])

  // Add item to queue (persisted to IndexedDB).
  const add = useCallback(async (data: T) => {
    const id = Math.random().toString(36).substr(2, 9)
    const item: QueueItem<T> = {
      id,
      timestamp: Date.now(),
      data,
      retries: 0,
    }

    // Update state optimistically, then persist.
    setState((prev) => {
      const newItems = [...prev.items, item]
      storage.set(newItems)
      return { ...prev, items: newItems }
    })

    return item.id
  }, [storageKey])

  // Flush queue, one item at a time, acking each on success.
  //
  // `submitFn` decides the fate of each item via its return value (`FlushOutcome`).
  // Returning nothing means `done`; throwing means `retry`. On the first `retry`
  // we stop so queued ordering is preserved for the next flush.
  const flush = useCallback(
    async (submitFn: (data: T, item: QueueItem<T>) => Promise<FlushOutcome | void>) => {
      const currentItems = await storage.get()
      if (currentItems.length === 0) {
        setState((prev) => ({ ...prev, items: [] }))
        return { success: true, submitted: 0 }
      }

      setState((prev) => ({ ...prev, isPending: true, items: currentItems }))

      let submitted = 0
      let stopped = false

      for (const item of currentItems) {
        let outcome: FlushOutcome
        try {
          outcome = (await submitFn(item.data, item)) || 'done'
        } catch (error) {
          console.error('Queue item flush failed (will retry):', error)
          outcome = 'retry'
        }

        if (outcome === 'retry') {
          stopped = true
          break
        }

        // `done` or `drop`: the server is reachable and has a final answer for
        // this item, so it should leave the queue either way.
        await storage.removeItem(item.id)
        if (outcome === 'done') submitted++
      }

      const remaining = await storage.get()
      setState((prev) => ({ ...prev, items: remaining, isPending: false }))
      return { success: !stopped, submitted }
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
