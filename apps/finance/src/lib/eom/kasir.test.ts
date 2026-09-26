import { buildChannelBreakdown, buildCashRows, itemFlags, splitByCutoff, MITRA_SUFFIX } from './kasir'
import { buildPenerapHpp, computeCategoryReport, computeAnalytics, buildMenuMaps } from '@/lib/posReport/compute'

const AYAM = 'menu-ayam'
const SAPI = 'menu-sapi'
const menus = [
  { id: AYAM, name: 'Original Ayam Jumbo', hpp_override: 15000, channel_hpp: {}, is_package: false },
  { id: SAPI, name: 'Original Sapi Jumbo', hpp_override: 17000, channel_hpp: {}, is_package: false },
]
// HPP Ayam: 14.500 s/d 18 Sep, 13.900 mulai 19 Sep. Sapi tidak berubah.
const riwayat = [
  { menu_item_id: AYAM, kunci: 'hpp_override', nilai: 14500, berlaku_mulai: '2000-01-01' },
  { menu_item_id: AYAM, kunci: 'hpp_override', nilai: 13900, berlaku_mulai: '2026-09-19' },
  { menu_item_id: SAPI, kunci: 'hpp_override', nilai: 17000, berlaku_mulai: '2000-01-01' },
]
const outlets = [
  { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'outlet' },
  { id: 'o2', name: 'MITRA CIBINONG', type: 'mitra' },
]

let seq = 0
function order(p: {
  outlet: string; at: string; channel?: string | null; sales_source?: string | null
  total: number; items: [string, string, number, number][]; status?: string; payment?: string
}) {
  seq += 1
  return {
    id: `ord-${seq}`, order_number: seq, status: p.status ?? 'completed', payment_method: p.payment ?? 'cash',
    total_amount: p.total, discount_amount: 0, promo_subsidy: 0, created_at: p.at, outlet_id: p.outlet,
    channel: p.channel ?? null, sales_source: p.sales_source ?? 'pos_kasir', customer_name: 'Pelanggan',
    cashier_name: null, external_order_id: null, is_endorse: false,
    order_items: p.items.map(([menuId, name, qty, price], i) => ({
      id: `it-${seq}-${i}`, menu_item_id: menuId, menu_item_name: name, quantity: qty,
      unit_price: price, subtotal: qty * price, package_choices: null,
    })),
  } as any
}

const orders = [
  // 18 Sep 23:30 WIB = 16:30 UTC → masih periode A
  order({ outlet: 'o1', at: '2026-09-18T16:30:00Z', total: 50000, items: [[AYAM, 'Original Ayam Jumbo', 2, 25000]] }),
  // 19 Sep 00:30 WIB = 18 Sep 17:30 UTC → periode B
  order({ outlet: 'o1', at: '2026-09-18T17:30:00Z', total: 25000, items: [[AYAM, 'Original Ayam Jumbo', 1, 25000]] }),
  // GoFood dengan potongan (total < nilai menu), periode B, outlet mitra
  order({ outlet: 'o2', at: '2026-09-20T05:00:00Z', channel: 'gofood', sales_source: 'gofood', payment: 'gofood', total: 45000,
    items: [[AYAM, 'Original Ayam Jumbo', 1, 25000], [SAPI, 'Original Sapi Jumbo', 1, 28000]] }),
  // dibatalkan → tidak dihitung
  order({ outlet: 'o1', at: '2026-09-10T05:00:00Z', total: 25000, status: 'cancelled', items: [[AYAM, 'Original Ayam Jumbo', 1, 25000]] }),
]

const penerap = buildPenerapHpp(menus, riwayat)
const CUT = '2026-09-19'

describe('splitByCutoff', () => {
  it('memakai tanggal WIB, bukan UTC', () => {
    const { a, b } = splitByCutoff(orders.slice(0, 2), CUT)
    expect(a.map((o: any) => o.id)).toEqual([orders[0].id])
    expect(b.map((o: any) => o.id)).toEqual([orders[1].id])
  })
})

describe('buildChannelBreakdown', () => {
  const channels = buildChannelBreakdown(orders, outlets, penerap, CUT)
  const whole = computeCategoryReport(orders, ['all'], outlets, penerap, false)
  const wholeItems = whole.categories.flatMap((c) => c.bestSellers)
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

  it('jumlah semua channel & periode = laporan satu bulan penuh (tak ada angka bergeser)', () => {
    expect(sum(channels.map((c) => c.revenue))).toBeCloseTo(sum(wholeItems.map((i) => i.revenue)), 6)
    expect(sum(channels.map((c) => c.potongan))).toBeCloseTo(sum(wholeItems.map((i) => i.adminPlatform)), 6)
    expect(sum(channels.map((c) => c.hppA + c.hppB))).toBeCloseTo(sum(whole.categories.map((c) => c.totalHpp)), 6)
    expect(sum(channels.map((c) => c.labaKotor))).toBeCloseTo(sum(wholeItems.map((i) => i.grossProfit)), 6)
  })

  it('HPP periode A memakai angka lama, periode B angka baru', () => {
    const pos = channels.find((c) => c.key === 'pos_kasir')!
    const ayam = pos.items.find((i) => i.name === 'Original Ayam Jumbo')!
    expect(ayam.qtyA).toBe(2)
    expect(ayam.hppA).toBe(2 * 14500)
    expect(ayam.qtyB).toBe(1)
    expect(ayam.hppB).toBe(13900)
  })

  it('channel dipisah per platform dan aturan mitra (x1,1) tetap berlaku', () => {
    const gofood = channels.find((c) => c.key === 'gofood')!
    expect(gofood.hppA).toBe(0)
    expect(gofood.hppB).toBe(Math.round(13900 * 1.1) + Math.round(17000 * 1.1))
    expect(gofood.potongan).toBe(8000)
  })

  it('baris menu outlet mitra dipisah (HPP/porsi tidak tercampur)', () => {
    const gofood = channels.find((c) => c.key === 'gofood')!
    expect(gofood.items.map((i) => i.name).sort()).toEqual([
      `Original Ayam Jumbo${MITRA_SUFFIX}`,
      `Original Sapi Jumbo${MITRA_SUFFIX}`,
    ])
  })

  it('tanpa cutoff semua masuk periode A', () => {
    const noCut = buildChannelBreakdown(orders, outlets, penerap, null)
    expect(sum(noCut.map((c) => c.hppB))).toBe(0)
    expect(sum(noCut.map((c) => c.hppA))).toBeCloseTo(sum(channels.map((c) => c.hppA + c.hppB)), 6)
  })
})

describe('itemFlags', () => {
  it('menandai HPP kosong dan HPP yang tidak berubah', () => {
    expect(itemFlags({ name: 'x', qtyA: 1, hppA: 0, qtyB: 1, hppB: 0, revenue: 1, potongan: 0, labaKotor: 1 }, true))
      .toContain('HPP kosong')
    expect(itemFlags({ name: 'x', qtyA: 2, hppA: 34000, qtyB: 1, hppB: 17000, revenue: 1, potongan: 0, labaKotor: 1 }, true))
      .toEqual(['HPP tidak berubah'])
    expect(itemFlags({ name: 'x', qtyA: 2, hppA: 29000, qtyB: 1, hppB: 13900, revenue: 1, potongan: 0, labaKotor: 1 }, true))
      .toEqual([])
  })
})

describe('buildCashRows', () => {
  it('omzet tunai = kartu metode pembayaran Rangkuman Penjualan per outlet', () => {
    const shifts = [
      { id: 's1', outlet_id: 'o1', start_time: '2026-09-18T01:00:00Z', end_time: '2026-09-18T15:00:00Z', status: 'closed',
        starting_cash: 0, expected_ending_cash: 75000, actual_ending_cash: 70000, variance: -5000,
        expected_ending_petty_cash: 0, actual_ending_petty_cash: 0, petty_cash_variance: 0 },
      { id: 's2', outlet_id: 'o1', start_time: '2026-09-19T01:00:00Z', end_time: null, status: 'open',
        starting_cash: 0, expected_ending_cash: 0, actual_ending_cash: 0, variance: 0,
        expected_ending_petty_cash: 0, actual_ending_petty_cash: 0, petty_cash_variance: 0 },
    ] as any
    const maps = buildMenuMaps(menus)
    const ctx = { ...maps, penerapHpp: penerap, settlements: [], isSSOnlineSelected: false, outlets }
    const rows = buildCashRows(orders, shifts, [{ outlet_id: 'o1', amount: 70000 }], outlets, ctx)
    const empang = rows.find((r) => r.outletId === 'o1')!

    const expected = computeAnalytics({ ...ctx, orders: orders.filter((o: any) => o.outlet_id === 'o1'), shifts: [], selectedChannels: ['all'] })
    expect(empang.omzetTunai).toBe(expected.paymentBreakdown.cash.revenue)
    expect(empang.omzetTunai).toBe(75000)
    expect(empang.shiftCount).toBe(2)
    expect(empang.shiftBelumTutup).toBe(1)
    expect(empang.shiftFisik).toBe(70000)
    expect(empang.selisihKasir).toBe(-5000)
    expect(empang.setoranDiterima).toBe(70000)
    // outlet mitra tanpa order tunai tetap muncul (ada order GoFood)
    expect(rows.find((r) => r.outletId === 'o2')!.omzetTunai).toBe(0)
  })
})
