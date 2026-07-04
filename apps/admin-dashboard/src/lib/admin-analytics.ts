// Logika filter & agregasi untuk dashboard admin (Overview Ringkas).
// Dipisah dari komponen agar bisa diuji unit (lihat tests/admin-analytics.test.ts)
// dan agar SEMUA elemen halaman (KPI, leaderboard) memakai sumber hitung yang
// sama dengan rentang tanggal terpilih — bukan hanya chart.

import type { Outlet } from '@/pos-types'
import { resolveOrderSource, type OrderSourceInfo } from './order-source'

export type ChartRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'

export const CHART_RANGES: Record<ChartRange, string> = {
  'today': 'Hari Ini',
  'yesterday': 'Kemarin',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  'all': 'Semua Waktu',
  'custom': 'Custom Tanggal',
}

// Label singkat untuk dipasang di kartu KPI (mis. "PENDAPATAN 7 HARI")
export const PERIOD_SHORT: Record<ChartRange, string> = {
  'today': 'Hari Ini',
  'yesterday': 'Kemarin',
  '7days': '7 Hari',
  '30days': '30 Hari',
  'all': 'Total',
  'custom': 'Periode',
}

export interface OrderRow {
  id: string
  status: string
  total_amount: number
  created_at: string
  outlet_id: string
  channel?: string | null
  sales_source?: string | null
}

// Satu baris rincian kontribusi per sumber (channel/online/pos) untuk Overview.
export interface SourceBreakdownRow extends OrderSourceInfo {
  revenue: number
  orders: number
  percentage: number
}

export interface DateRange {
  start: Date | null
  end: Date | null
  prevStart: Date | null
  prevEnd: Date | null
  hasComparison: boolean
}

export interface AdminAnalytics {
  todayRevenue: number
  revenueGrowth: number
  totalOrdersCount: number
  ordersGrowth: number
  avgOrderValue: number
  peakHour: number
  leaderboard: { name: string; revenue: number }[]
  sourceBreakdown: SourceBreakdownRow[]
  prevRevenue: number
  hasComparison: boolean
}

// Resolusi rentang tanggal terpilih + periode pembanding (untuk growth).
// Memakai tanggal lokal (≈ Asia/Jakarta) agar selaras dengan sales_date view.
// `now` bisa di-inject untuk pengujian deterministik.
export function resolveRange(
  range: ChartRange,
  customStart: string,
  customEnd: string,
  now: Date = new Date()
): DateRange {
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

  let start: Date | null = null
  let end: Date | null = endOfDay(now)

  if (range === 'today') {
    start = startOfDay(now)
  } else if (range === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    start = startOfDay(y); end = endOfDay(y)
  } else if (range === '7days') {
    const s = new Date(now); s.setDate(s.getDate() - 6)
    start = startOfDay(s)
  } else if (range === '30days') {
    const s = new Date(now); s.setDate(s.getDate() - 29)
    start = startOfDay(s)
  } else if (range === 'all') {
    start = null
  } else if (range === 'custom' && customStart && customEnd) {
    start = startOfDay(new Date(customStart)); end = endOfDay(new Date(customEnd))
  } else {
    // custom belum lengkap → fallback hari ini
    start = startOfDay(now)
  }

  // Periode pembanding: rentang sama panjang tepat sebelum `start`.
  let prevStart: Date | null = null
  let prevEnd: Date | null = null
  if (start && end) {
    const span = end.getTime() - start.getTime()
    prevEnd = new Date(start.getTime() - 1)
    prevStart = new Date(start.getTime() - span - 1)
  }

  return { start, end, prevStart, prevEnd, hasComparison: !!(prevStart && prevEnd) }
}

// Hitung seluruh KPI + leaderboard untuk periode aktif. Inilah yang membuat
// kartu statistik & Top 5 Cabang ikut berubah saat filter tanggal diganti.
export function computeAnalytics(
  orders: OrderRow[],
  outlets: Pick<Outlet, 'id' | 'name'>[],
  range: DateRange
): AdminAnalytics {
  const { start, end, prevStart, prevEnd, hasComparison } = range
  const inRange = (ts: string, s: Date | null, e: Date | null) => {
    const t = new Date(ts).getTime()
    return (!s || t >= s.getTime()) && (!e || t <= e.getTime())
  }

  const periodOrders = orders.filter(o => inRange(o.created_at, start, end))
  const prevOrders = hasComparison
    ? orders.filter(o => inRange(o.created_at, prevStart, prevEnd))
    : []

  const todayRevenue = periodOrders.reduce((s, o) => s + o.total_amount, 0)
  const totalOrdersCount = periodOrders.length
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(todayRevenue / totalOrdersCount) : 0

  const prevRevenue = prevOrders.reduce((s, o) => s + o.total_amount, 0)
  const prevCount = prevOrders.length

  const revenueGrowth = !hasComparison ? 0 : (prevRevenue === 0
    ? (todayRevenue > 0 ? 100 : 0)
    : Math.round(((todayRevenue - prevRevenue) / prevRevenue) * 100))

  const ordersGrowth = !hasComparison ? 0 : (prevCount === 0
    ? (totalOrdersCount > 0 ? 100 : 0)
    : Math.round(((totalOrdersCount - prevCount) / prevCount) * 100))

  const hourly = Array(24).fill(0)
  periodOrders.forEach(o => {
    const hour = new Date(o.created_at).getHours()
    hourly[hour]++
  })
  const peakHour = hourly.indexOf(Math.max(...hourly, 1))

  const branchMap: Record<string, number> = {}
  periodOrders.forEach(o => {
    branchMap[o.outlet_id] = (branchMap[o.outlet_id] || 0) + o.total_amount
  })
  const leaderboard = Object.entries(branchMap)
    .map(([id, rev]) => {
      const out = outlets.find(x => x.id === id)
      return { name: out ? out.name : 'Unknown', revenue: rev }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Kontribusi per sumber pesanan (channel eksternal / website online / POS).
  const sourceMap = new Map<string, { info: OrderSourceInfo; revenue: number; orders: number }>()
  periodOrders.forEach(o => {
    const info = resolveOrderSource(o.channel, o.sales_source)
    const cur = sourceMap.get(info.key) ?? { info, revenue: 0, orders: 0 }
    cur.revenue += o.total_amount
    cur.orders += 1
    sourceMap.set(info.key, cur)
  })
  const sourceBreakdown: SourceBreakdownRow[] = Array.from(sourceMap.values())
    .map(({ info, revenue, orders }) => ({
      ...info,
      revenue,
      orders,
      percentage: todayRevenue > 0 ? Math.round((revenue / todayRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    todayRevenue,
    revenueGrowth,
    totalOrdersCount,
    ordersGrowth,
    avgOrderValue,
    peakHour,
    leaderboard,
    sourceBreakdown,
    prevRevenue,
    hasComparison,
  }
}
