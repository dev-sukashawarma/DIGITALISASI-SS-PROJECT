import { get, set, del } from 'idb-keyval'
import { QueueItem } from './types'

export class QueueStorage<T> {
  constructor(private key: string) {}

  async get(): Promise<QueueItem<T>[]> {
    if (typeof window === 'undefined') return []
    try {
      const data = await get<QueueItem<T>[]>(this.key)
      return data || []
    } catch (e) {
      console.warn(`Failed to read queue from IndexedDB: ${e}`)
      return []
    }
  }

  async set(items: QueueItem<T>[]): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      await set(this.key, items)
    } catch (e) {
      console.warn(`Failed to write queue to IndexedDB: ${e}`)
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      await del(this.key)
    } catch (e) {
      console.warn(`Failed to clear queue from IndexedDB: ${e}`)
    }
  }
}
