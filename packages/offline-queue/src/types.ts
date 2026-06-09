export interface QueueItem<T = any> {
  id: string
  timestamp: number
  data: T
  retries: number
  lastError?: string
}

export interface QueueState<T = any> {
  items: QueueItem<T>[]
  isPending: boolean
  isOnline: boolean
}

export interface UseOfflineQueueOptions {
  maxRetries?: number
  retryDelay?: number
  storageKey?: string
}
