import { QueueItem } from './types'

export class QueueStorage<T> {
  constructor(private key: string) {}

  get(): QueueItem<T>[] {
    if (typeof window === 'undefined') return []
    try {
      const data = localStorage.getItem(this.key)
      return data ? JSON.parse(data) : []
    } catch (e) {
      console.warn(`Failed to read queue from localStorage: ${e}`)
      return []
    }
  }

  set(items: QueueItem<T>[]): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(this.key, JSON.stringify(items))
    } catch (e) {
      console.warn(`Failed to write queue to localStorage: ${e}`)
    }
  }

  clear(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(this.key)
    } catch (e) {
      console.warn(`Failed to clear queue from localStorage: ${e}`)
    }
  }
}
