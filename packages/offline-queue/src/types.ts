export interface QueueItem<T = any> {
  id: string
  timestamp: number
  data: T
  retries: number
  lastError?: string
}

/**
 * Outcome of submitting a single queued item during flush.
 * - `done`  : server accepted it → remove from queue.
 * - `drop`  : terminal rejection (business rule like late/alpha, or a 4xx) →
 *             remove from queue; retrying will never succeed and would wedge it.
 * - `retry` : transient failure (network down, 5xx) → keep it AND stop the batch
 *             so ordering is preserved for the next flush.
 *
 * A submitFn that throws is treated as `retry` (transport failure). A submitFn
 * that resolves without a value is treated as `done` (back-compat shorthand).
 */
export type FlushOutcome = 'done' | 'drop' | 'retry'

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
