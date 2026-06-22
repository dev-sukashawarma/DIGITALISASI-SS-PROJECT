export type HealthStatus = 'up' | 'degraded' | 'down' | 'unconfigured'

export interface DeriveStatusInput {
  reachable: boolean
  dbStatus: 'ok' | 'error' | null
  responseTimeMs: number | null
}

const SLOW_RESPONSE_THRESHOLD_MS = 3000

export function deriveStatus(input: DeriveStatusInput): HealthStatus {
  if (!input.reachable) return 'down'
  if (input.dbStatus === 'error') return 'degraded'
  if (input.responseTimeMs !== null && input.responseTimeMs > SLOW_RESPONSE_THRESHOLD_MS) return 'degraded'
  return 'up'
}
