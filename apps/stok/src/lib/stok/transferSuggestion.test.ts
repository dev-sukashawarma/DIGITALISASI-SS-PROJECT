import { describe, it, expect } from 'vitest'
import { computeTransferSuggestions } from './transferSuggestion'
import type { MonitoringItem } from '@/lib/types/monitoring'

function makeItem(overrides: Partial<MonitoringItem>): MonitoringItem {
  return {
    outlet_id: 'o1',
    outlet_name: 'Outlet 1',
    bahan_baku_id: 'b1',
    item_name: 'Daging',
    satuan: 'kg',
    kategori: 'protein',
    current_qty: 10,
    threshold: 10,
    status: 'ok',
    is_flagged: false,
    last_updated: '2026-06-12T00:00:00Z',
    last_opname_date: null,
    ...overrides,
  }
}

describe('computeTransferSuggestions', () => {
  it('returns empty when no donor has surplus', () => {
    const items = [
      makeItem({ outlet_id: 'a', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', current_qty: 8, threshold: 10, status: 'warning' }),
    ]
    expect(computeTransferSuggestions(items)).toEqual([])
  })

  it('suggests qty = min(need, surplus) for one donor and one recipient', () => {
    const items = [
      makeItem({ outlet_id: 'a', outlet_name: 'A', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', outlet_name: 'B', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    const result = computeTransferSuggestions(items)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      donorOutletId: 'b',
      recipientOutletId: 'a',
      qty: 8,
      recipientStatus: 'below',
    })
  })

  it('never drops a donor below its threshold across multiple recipients', () => {
    const items = [
      makeItem({ outlet_id: 'a', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', current_qty: 4, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'd', current_qty: 20, threshold: 10, status: 'ok' }),
    ]
    const result = computeTransferSuggestions(items)
    const totalSent = result
      .filter((s) => s.donorOutletId === 'd')
      .reduce((sum, s) => sum + s.qty, 0)
    expect(totalSent).toBeLessThanOrEqual(10)
  })

  it('prioritizes below recipients before warning recipients', () => {
    const items = [
      makeItem({ outlet_id: 'warn', current_qty: 9, threshold: 10, status: 'warning' }),
      makeItem({ outlet_id: 'crit', current_qty: 1, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'donor', current_qty: 15, threshold: 10, status: 'ok' }),
    ]
    const result = computeTransferSuggestions(items)
    expect(result[0].recipientOutletId).toBe('crit')
  })

  it('only pairs outlets that share the same bahan_baku_id', () => {
    const items = [
      makeItem({ outlet_id: 'a', bahan_baku_id: 'b1', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', bahan_baku_id: 'b2', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    expect(computeTransferSuggestions(items)).toEqual([])
  })
})
