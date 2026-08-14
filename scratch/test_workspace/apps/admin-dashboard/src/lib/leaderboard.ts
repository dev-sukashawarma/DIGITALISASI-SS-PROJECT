import type { SalesSummaryRow } from './types'
import { aov, deltaPct } from './format'

export interface LeaderboardEntry {
  outlet_id: string
  outlet_name: string
  omzet: number
  orders: number
  aov: number
  deltaPct: number | null
}

function omzetPerOutlet(rows: SalesSummaryRow[]) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.outlet_id, (m.get(r.outlet_id) ?? 0) + r.omzet)
  return m
}

export function buildLeaderboard(current: SalesSummaryRow[], previous: SalesSummaryRow[]): LeaderboardEntry[] {
  const prev = omzetPerOutlet(previous)
  const agg = new Map<string, { name: string; omzet: number; orders: number }>()
  for (const r of current) {
    const cur = agg.get(r.outlet_id) ?? { name: r.outlet_name, omzet: 0, orders: 0 }
    cur.omzet += r.omzet; cur.orders += r.jumlah_order_completed
    agg.set(r.outlet_id, cur)
  }
  return [...agg.entries()]
    .map(([outlet_id, v]) => ({
      outlet_id, outlet_name: v.name, omzet: v.omzet, orders: v.orders,
      aov: aov(v.omzet, v.orders), deltaPct: deltaPct(v.omzet, prev.get(outlet_id) ?? 0),
    }))
    .sort((a, b) => b.omzet - a.omzet)
}
