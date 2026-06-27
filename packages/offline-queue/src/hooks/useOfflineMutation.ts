import { useEffect, useCallback } from 'react'
import { useOfflineQueue } from '../useOfflineQueue'

export function useOfflineMutation<T = any>(
  storageKey: string,
  mutationFn: (data: T) => Promise<any>
) {
  const { queue, add, flush, isPending, isOnline } = useOfflineQueue<T>(storageKey)

  // Automatically flush when online with pending items.
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      // A thrown mutation is treated as `retry` by flush; a clean resolve is `done`.
      flush(async (data) => {
        await mutationFn(data)
      })
    }
  }, [isOnline, queue.length, flush, storageKey, mutationFn])

  const mutate = useCallback(async (data: T) => {
    if (isOnline) {
      try {
        await mutationFn(data)
      } catch (error) {
        // Fallback to queue if network fails during request
        await add(data)
      }
    } else {
      await add(data)
    }
  }, [isOnline, mutationFn, add])

  return {
    mutate,
    pendingItems: queue.length,
    isSyncing: isPending
  }
}
