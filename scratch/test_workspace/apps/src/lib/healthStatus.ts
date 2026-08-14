import type { HealthStatus, SystemHealthLogRow } from './types'

export function latestPerTarget(rows: SystemHealthLogRow[]): SystemHealthLogRow[] {
  const seen = new Map<string, SystemHealthLogRow>()
  for (const row of rows) {
    const existing = seen.get(row.target_name)
    if (!existing || new Date(row.checked_at) > new Date(existing.checked_at)) {
      seen.set(row.target_name, row)
    }
  }
  return Array.from(seen.values())
}

export interface HealthTransition {
  target_name: string
  from: HealthStatus
  to: HealthStatus
  checked_at: string
}

export function detectTransitions(rows: SystemHealthLogRow[]): HealthTransition[] {
  const byTarget = new Map<string, SystemHealthLogRow[]>()
  for (const row of rows) {
    const list = byTarget.get(row.target_name) ?? []
    list.push(row)
    byTarget.set(row.target_name, list)
  }

  const events: HealthTransition[] = []
  for (const list of byTarget.values()) {
    const sorted = [...list].sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      if (prev.status !== curr.status) {
        events.push({
          target_name: curr.target_name,
          from: prev.status,
          to: curr.status,
          checked_at: curr.checked_at,
        })
      }
    }
  }
  return events.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
}
