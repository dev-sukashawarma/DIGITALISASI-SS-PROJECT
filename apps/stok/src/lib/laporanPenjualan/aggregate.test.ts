import { describe, it, expect } from 'vitest'
import { summarizeDay, buildAnalytics, channelMatches, channelKey, cleanMenuName, type RawOrder } from './aggregate'

const A = 'outlet-a', B = 'outlet-b', TES = 'outlet-tes'
const info = new Map([
  [A, { name: 'SUKA SHAWARMA A', cleanName: 'A', category: 'internal' as const }],
  [B, { name: 'MITRA B', cleanName: 'MITRA B', category: 'mitra' as const }],
])
const valid = new Set([A, B])

const order = (id: string, outlet: string | null, channel: string | null, at: string, total: number, items: [string, number, number][], status = 'completed'): RawOrder => ({
  id, status, channel, outlet_id: outlet, created_at: at, total_amount: total, discount_amount: 1000, promo_subsidy: 0,
  order_items: items.map(([menu_item_name, quantity, subtotal]) => ({ menu_item_name, quantity, subtotal })),
})

const day1 = summarizeDay([
  order('1', A, null, '2026-09-20T03:00:00Z', 50000, [['Sapi|NOTE|pedas', 2, 50000]]),       // 10:00 WIB
  order('2', B, 'gofood', '2026-09-20T05:00:00Z', 30000, [['Ayam', 1, 30000]]),              // 12:00 WIB
  order('3', TES, null, '2026-09-20T05:30:00Z', 99999, [['Sapi', 9, 99999]]),                 // outlet tak valid
  order('4', A, 'gofood', '2026-09-20T06:00:00Z', 0, [], 'cancelled'),
])
const day2 = summarizeDay([
  order('5', B, 'tiktok_go', '2026-09-21T11:00:00Z', 40000, [['Ayam', 1, 40000], ['Sapi', 1, 0]]), // 18:00 WIB
])

const build = (channelFilter = 'all', outletFilter = 'all') =>
  buildAnalytics([day1, day2], { channelFilter, outletFilter, validOutletIdSet: valid, outletInfoMap: info })

describe('Laporan Penjualan — ringkasan per hari', () => {
  it('semua outlet: outlet tak valid dibuang, batal dihitung', () => {
    const a = build()
    expect(a.totalOrders).toBe(3)
    expect(a.netRevenue).toBe(120000)
    expect(a.totalDeductions).toBe(3000)
    expect(a.totalRevenue).toBe(123000)
    expect(a.canceledCount).toBe(1)
    expect(a.hourly[10]).toBe(1)
    expect(a.hourlyPorsi[18]).toBe(2)
    expect(a.peakHour).toBe(10)
    expect(a.channelStats.tiktok.count).toBe(1)
    expect(a.bestSellers.map(i => i.name)).toEqual(['Sapi', 'Ayam']) // seri qty 3 vs 2
  })

  it('filter outlet spesifik tetap menghitung order outlet itu apa adanya', () => {
    const a = build('all', TES)
    expect(a.totalOrders).toBe(1)
    expect(a.outletVolumeList[0].outletName).toBe('outlet-t')
  })

  it('filter channel mengikuti aturan query lama (offline = channel NULL)', () => {
    expect(build('offline').totalOrders).toBe(1)
    expect(build('food_apps').totalOrders).toBe(2)
    expect(build('tiktok').totalOrders).toBe(1)
    expect(build('gofood').canceledCount).toBe(1)
    expect(channelMatches('offline', '')).toBe(false)
    expect(channelKey('')).toBe('offline')
    expect(channelKey('GrabFood')).toBe('grabfood')
  })

  it('urutan seri outlet = urutan kemunculan order pertamanya', () => {
    const d = summarizeDay([
      order('1', B, null, '2026-09-20T03:00:00Z', 1, [['X', 1, 1]]),
      order('2', A, null, '2026-09-20T04:00:00Z', 1, [['Y', 1, 1]]),
    ])
    const a = buildAnalytics([d], { channelFilter: 'all', outletFilter: 'all', validOutletIdSet: valid, outletInfoMap: info })
    expect(a.outletVolumeList.map(o => o.outletId)).toEqual([B, A])
  })

  it('nama menu dibersihkan dari metadata', () => {
    expect(cleanMenuName('Sapi|NOTE|pedas')).toBe('Sapi')
    expect(cleanMenuName(null)).toBe('Item Tanpa Nama')
  })
})
