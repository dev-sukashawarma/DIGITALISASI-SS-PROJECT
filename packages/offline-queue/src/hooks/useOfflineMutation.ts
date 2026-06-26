import { useEffect, useCallback } from 'react'
import { useOfflineQueue } from '../useOfflineQueue'

export function useOfflineMutation<T = any>(
  storageKey: string,
  mutationFn: (data: T) => Promise<any>
) {
  const { queue, add, flush, isPending, isOnline } = useOfflineQueue<T>(storageKey)

  // Automatically flush when coming back online or when background sync triggers
  useEffect(() => {
    const handleFlush = () => {
      flush(async (items) => {
        // Execute mutations sequentially or in parallel depending on requirements
        for (const item of items) {
          await mutationFn(item.data)
        }
      })
    }

    if (isOnline && queue.length > 0) {
      handleFlush()
    }

    window.addEventListener(`flush-queue-${storageKey}`, handleFlush)
    return () => {
      window.removeEventListener(`flush-queue-${storageKey}`, handleFlush)
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
