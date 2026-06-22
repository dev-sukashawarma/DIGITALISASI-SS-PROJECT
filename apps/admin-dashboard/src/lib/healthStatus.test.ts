import { describe, it, expect } from 'vitest'
import { latestPerTarget, detectTransitions } from './healthStatus'
import type { SystemHealthLogRow } from './types'

const make = (p: Partial<SystemHealthLogRow>): SystemHealthLogRow => ({
  id: 1, target_type: 'app', target_name: 'stok', status: 'up', db_status: 'ok',
  last_activity_at: null, response_time_ms: 50, detail: null, checked_at: '2026-06-20T10:00:00Z',
  ...p,
})

describe('latestPerTarget', () => {
  it('keeps only the newest row per target_name (rows are checked_at desc)', () => {
    const rows = [
      make({ id: 3, target_name: 'stok', checked_at: '2026-06-20T10:10:00Z', status: 'down' }),
      make({ id: 2, target_name: 'stok', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
      make({ id: 1, target_name: 'absensi', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
    ]
    const result = latestPerTarget(rows)
    expect(result).toHaveLength(2)
    expect(result.find(r => r.target_name === 'stok')?.id).toBe(3)
  })
})

describe('detectTransitions', () => {
  it('returns an event only when status changes between consecutive checks for the same target', () => {
    const rows = [
      make({ id: 3, target_name: 'stok', checked_at: '2026-06-20T10:10:00Z', status: 'down' }),
      make({ id: 2, target_name: 'stok', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
      make({ id: 1, target_name: 'stok', checked_at: '2026-06-20T10:00:00Z', status: 'up' }),
    ]
    const events = detectTransitions(rows)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      target_name: 'stok',
      from: 'up',
      to: 'down',
      checked_at: '2026-06-20T10:10:00Z',
    })
  })

  it('returns no events when a target never changes status', () => {
    const rows = [
      make({ id: 2, target_name: 'absensi', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
      make({ id: 1, target_name: 'absensi', checked_at: '2026-06-20T10:00:00Z', status: 'up' }),
    ]
    expect(detectTransitions(rows)).toHaveLength(0)
  })
})
