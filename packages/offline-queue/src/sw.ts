import { get, del } from 'idb-keyval'
import { QueueItem } from './types'

/**
 * Handles Background Sync events in the Service Worker.
 * Usage in sw.ts:
 * 
 * import { handleSyncEvent } from '@suka/offline-queue/sw'
 * 
 * self.addEventListener('sync', (event) => {
 *   if (event.tag.startsWith('sync-')) {
 *     const storageKey = event.tag.replace('sync-', '')
 *     event.waitUntil(handleSyncEvent(storageKey, async (items) => {
 *       // Send items to your API
 *       await fetch('/api/sync', { method: 'POST', body: JSON.stringify(items) })
 *     }))
 *   }
 * })
 */
export async function handleSyncEvent<T = any>(
  storageKey: string,
  submitFn: (items: QueueItem<T>[]) => Promise<void>
): Promise<void> {
  try {
    const items = await get<QueueItem<T>[]>(storageKey)
    if (!items || items.length === 0) {
      return // Nothing to sync
    }

    await submitFn(items)
    
    // Clear storage on success
    await del(storageKey)
    console.log(`[Offline Queue] Successfully synced ${items.length} items for ${storageKey}`)
  } catch (error) {
    console.error(`[Offline Queue] Failed to sync ${storageKey}:`, error)
    // Throwing error tells the browser to retry the sync later
    throw error
  }
}
