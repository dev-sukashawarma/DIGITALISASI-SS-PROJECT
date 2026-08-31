import type { SalesSummaryRow } from './types'
import { aov, deltaPct } from './format'

export type PerformanceTier = 'PESIMIS' | 'MODERAT' | 'PROGRESIF' | 'OPTIMIS'

export interface LeaderboardEntry {
  outlet_id: string
  outlet_name: string
  omzet: number
  orders: number
  aov: number
  deltaPct: number | null
  total_qty: number
  avg_daily_qty: number
  performance_tier: PerformanceTier
}

export function getPerformanceTier(avgDailyQty: number): PerformanceTier {
  if (avgDailyQty <= 75) return 'PESIMIS'
  if (avgDailyQty <= 150) return 'MODERAT'
  if (avgDailyQty < 300) return 'PROGRESIF'
  return 'OPTIMIS'
}

function omzetPerOutlet(rows: SalesSummaryRow[]) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.outlet_id, (m.get(r.outlet_id) ?? 0) + r.omzet)
  return m
}

export function buildLeaderboard(
  current: SalesSummaryRow[],
  previous: SalesSummaryRow[],
  daysCount: number = 1
): LeaderboardEntry[] {
  const safeDays = Math.max(1, daysCount)
  const prev = omzetPerOutlet(previous)
  const agg = new Map<string, { name: string; omzet: number; orders: number; qty: number }>()
  for (const r of current) {
    const cur = agg.get(r.outlet_id) ?? { name: r.outlet_name, omzet: 0, orders: 0, qty: 0 }
    cur.omzet += r.omzet
    cur.orders += r.jumlah_order_completed
    cur.qty += Number(r.total_qty || 0)
    agg.set(r.outlet_id, cur)
  }
  return [...agg.entries()]
    .map(([outlet_id, v]) => {
      const avg_daily_qty = Math.round((v.qty / safeDays) * 10) / 10
      return {
        outlet_id,
        outlet_name: v.name,
        omzet: v.omzet,
        orders: v.orders,
        aov: aov(v.omzet, v.orders),
        deltaPct: deltaPct(v.omzet, prev.get(outlet_id) ?? 0),
        total_qty: v.qty,
        avg_daily_qty,
        performance_tier: getPerformanceTier(avg_daily_qty),
      }
    })
    .sort((a, b) => b.omzet - a.omzet)
}

