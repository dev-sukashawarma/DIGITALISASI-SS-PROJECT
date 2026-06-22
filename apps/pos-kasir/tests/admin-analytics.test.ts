import { describe, it, expect } from 'vitest'
import { resolveRange, computeAnalytics, type OrderRow } from '@/lib/admin-analytics'

const OUTLETS = [
  { id: 'o1', name: 'Cabang A' },
  { id: 'o2', name: 'Cabang B' },
]

// "Now" deterministik: 2026-06-20 11:00 lokal
const NOW = new Date('2026-06-20T11:00:00')

function order(id: string, outlet_id: string, total: number, iso: string): OrderRow {
  return { id, outlet_id, total_amount: total, created_at: iso, status: 'completed' }
}

// Data uji menyebar lintas beberapa hari
const ORDERS: OrderRow[] = [
  // Hari ini (2026-06-20) — total 66.417 di o1, 1 pesanan
  order('t1', 'o1', 66_417, '2026-06-20T08:30:00'),
  // Kemarin (2026-06-19) — total 877.701 (o1 600k @09:00, o2 277.701 @14:00), 2 pesanan
  order('y1', 'o1', 600_000, '2026-06-19T09:00:00'),
  order('y2', 'o2', 277_701, '2026-06-19T14:00:00'),
  // 5 hari lalu (2026-06-15) — masuk 7 hari, di luar hari ini/kemarin
  order('w1', 'o2', 100_000, '2026-06-15T12:00:00'),
]

describe('admin dashboard filter — semua elemen mengikuti rentang tanggal', () => {
  it('range "today" → KPI hanya menghitung pesanan hari ini', () => {
    const range = resolveRange('today', '', '', NOW)
    const a = computeAnalytics(ORDERS, OUTLETS, range)

    expect(a.todayRevenue).toBe(66_417)
    expect(a.totalOrdersCount).toBe(1)
    expect(a.peakHour).toBe(8)
    // Leaderboard ikut filter: hanya cabang dengan transaksi hari ini
    expect(a.leaderboard).toEqual([{ name: 'Cabang A', revenue: 66_417 }])
    // Pembanding = kemarin (877.701) → growth turun
    expect(a.hasComparison).toBe(true)
    expect(a.prevRevenue).toBe(877_701)
    expect(a.revenueGrowth).toBeLessThan(0)
  })

  it('range "yesterday" → SEMUA KPI & leaderboard berubah ke data kemarin', () => {
    const range = resolveRange('yesterday', '', '', NOW)
    const a = computeAnalytics(ORDERS, OUTLETS, range)

    // Inilah inti bug: kartu KPI harus menampilkan angka KEMARIN, bukan hari ini
    expect(a.todayRevenue).toBe(877_701)
    expect(a.totalOrdersCount).toBe(2)
    expect(a.avgOrderValue).toBe(Math.round(877_701 / 2))
    expect(a.peakHour).toBe(9)
    // Leaderboard kemarin: 2 cabang, terurut menurun
    expect(a.leaderboard).toEqual([
      { name: 'Cabang A', revenue: 600_000 },
      { name: 'Cabang B', revenue: 277_701 },
    ])
  })

  it('range "7days" → mengakumulasi seluruh pesanan dalam 7 hari', () => {
    const range = resolveRange('7days', '', '', NOW)
    const a = computeAnalytics(ORDERS, OUTLETS, range)

    // 66.417 + 600.000 + 277.701 + 100.000
    expect(a.todayRevenue).toBe(1_044_118)
    expect(a.totalOrdersCount).toBe(4)
    expect(a.leaderboard[0]).toEqual({ name: 'Cabang A', revenue: 666_417 })
  })

  it('angka KPI BERBEDA antar filter (bukti tidak lagi statis "hari ini")', () => {
    const today = computeAnalytics(ORDERS, OUTLETS, resolveRange('today', '', '', NOW))
    const yesterday = computeAnalytics(ORDERS, OUTLETS, resolveRange('yesterday', '', '', NOW))
    const sevenDays = computeAnalytics(ORDERS, OUTLETS, resolveRange('7days', '', '', NOW))

    expect(today.todayRevenue).not.toBe(yesterday.todayRevenue)
    expect(yesterday.todayRevenue).not.toBe(sevenDays.todayRevenue)
    expect(today.totalOrdersCount).not.toBe(sevenDays.totalOrdersCount)
  })

  it('range "all" → tanpa periode pembanding (growth disembunyikan)', () => {
    const range = resolveRange('all', '', '', NOW)
    const a = computeAnalytics(ORDERS, OUTLETS, range)

    expect(a.hasComparison).toBe(false)
    expect(a.revenueGrowth).toBe(0)
    expect(a.totalOrdersCount).toBe(4)
  })
})
