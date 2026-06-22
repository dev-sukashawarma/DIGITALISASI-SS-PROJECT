import { describe, it, expect } from 'vitest'
import { buildLeaderboard } from './leaderboard'
import type { SalesSummaryRow } from './types'

const row = (outlet_id: string, outlet_name: string, omzet: number, c = 1, a = 1): SalesSummaryRow =>
  ({ outlet_id, outlet_name, sales_source: 'pos', sales_date: '2026-06-18', omzet, jumlah_order_completed: c, jumlah_order_all: a })

describe('buildLeaderboard', () => {
  it('agregasi per outlet, urut omzet desc, hitung delta vs previous', () => {
    const cur = [row('a', 'A', 100000), row('a', 'A', 50000), row('b', 'B', 200000)]
    const prev = [row('a', 'A', 100000), row('b', 'B', 400000)]
    const lb = buildLeaderboard(cur, prev)
    expect(lb[0].outlet_name).toBe('B')          // 200k > 150k
    expect(lb[0].omzet).toBe(200000)
    expect(lb[0].deltaPct).toBe(-50)             // 200k vs 400k
    expect(lb[1].outlet_name).toBe('A')
    expect(lb[1].omzet).toBe(150000)
    expect(lb[1].deltaPct).toBe(50)              // 150k vs 100k
  })
})
