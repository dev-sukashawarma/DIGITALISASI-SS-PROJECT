import { buildMenuMaps, buildPenerapHpp, computeAnalytics } from '@/lib/posReport/compute'
import { type Angka, computeExportReport, klasifikasiChannel, labelMetodeBayar } from '@/lib/posReport/ekspor'

const AYAM = 'menu-ayam'
const SAPI = 'menu-sapi'
const menus = [
  { id: AYAM, name: 'Original Ayam Jumbo', hpp_override: 15000, channel_hpp: {}, is_package: false },
  { id: SAPI, name: 'Original Sapi Jumbo', hpp_override: 17000, channel_hpp: {}, is_package: false },
]
const riwayat = [
  { menu_item_id: AYAM, kunci: 'hpp_override', nilai: 14500, berlaku_mulai: '2000-01-01' },
  { menu_item_id: AYAM, kunci: 'hpp_override', nilai: 13900, berlaku_mulai: '2026-09-19' },
  { menu_item_id: SAPI, kunci: 'hpp_override', nilai: 17000, berlaku_mulai: '2000-01-01' },
]
const outlets = [
  { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal' },
  { id: 'o2', name: 'MITRA CIBINONG', type: 'mitra' },
]

let seq = 0
function order(p: {
  outlet: string; at: string; channel?: string | null; sales_source?: string | null
  total: number; items: [string, string, number, number][]; status?: string; payment?: string
  promo?: number; discount?: number
}) {
  seq += 1
  return {
    id: `ord-${seq}`, order_number: seq, status: p.status ?? 'completed', payment_method: p.payment ?? 'cash',
    total_amount: p.total, discount_amount: p.discount ?? 0, promo_subsidy: p.promo ?? 0, created_at: p.at, outlet_id: p.outlet,
    channel: p.channel ?? null, sales_source: p.sales_source ?? 'pos_kasir', customer_name: 'Pelanggan',
    cashier_name: null, external_order_id: null, is_endorse: false,
    order_items: p.items.map(([menuId, name, qty, price], i) => ({
      id: `it-${seq}-${i}`, menu_item_id: menuId, menu_item_name: name, quantity: qty,
      unit_price: price, subtotal: qty * price, package_choices: null,
    })),
  } as any
}

function buatOrders() {
  return [
    // 18 Sep 23:30 WIB → HPP Ayam lama (14.500)
    order({ outlet: 'o1', at: '2026-09-18T16:30:00Z', total: 45000, discount: 5000, items: [[AYAM, 'Original Ayam Jumbo', 2, 25000]] }),
    // 19 Sep 00:30 WIB → HPP Ayam baru (13.900)
    order({ outlet: 'o1', at: '2026-09-18T17:30:00Z', total: 25000, payment: 'qris', items: [[AYAM, 'Original Ayam Jumbo', 1, 25000]] }),
    // GoFood outlet mitra (HPP ×1,1) dengan promo merchant
    order({ outlet: 'o2', at: '2026-09-20T05:00:00Z', channel: 'gofood', sales_source: 'gofood', payment: 'gofood', total: 53000, promo: 8000,
      items: [[AYAM, 'Original Ayam Jumbo', 1, 25000], [SAPI, 'Original Sapi Jumbo', 1, 28000]] }),
    order({ outlet: 'o2', at: '2026-09-21T05:00:00Z', channel: 'grabfood', sales_source: 'grabfood', payment: 'grabfood', total: 28000,
      items: [[SAPI, 'Original Sapi Jumbo', 1, 28000]] }),
    // Order tanpa rincian item tetap masuk omzet
    order({ outlet: 'o1', at: '2026-09-21T06:00:00Z', total: 30000, items: [] }),
    // Dibatalkan → hanya dihitung sebagai batal
    order({ outlet: 'o1', at: '2026-09-10T05:00:00Z', total: 25000, status: 'cancelled', items: [[AYAM, 'Original Ayam Jumbo', 1, 25000]] }),
  ]
}

function hitung(channels: string[]) {
  const orders = buatOrders()
  const penerapHpp = buildPenerapHpp(menus, riwayat)
  const { menuItemByNameMap, menuItemByIdMap } = buildMenuMaps(menus)
  // Urutan sama dengan server: kartu KPI dihitung dulu, ekspor sesudahnya.
  const analytics = computeAnalytics({
    orders, shifts: [], selectedChannels: channels, menuItemByNameMap, menuItemByIdMap,
    penerapHpp, settlements: [], isSSOnlineSelected: false, outlets,
  })
  const ekspor = computeExportReport({
    orders, selectedChannels: channels, outlets, penerapHpp, isSSOnlineSelected: false,
    periode: { from: '2026-09-01', to: '2026-09-30' },
  })
  return { analytics, ekspor }
}

const sum = (xs: readonly any[], f: (x: any) => number) => xs.reduce((s, x) => s + f(x), 0)

describe('computeExportReport', () => {
  it('total ekspor = angka kartu KPI di layar', () => {
    const { analytics, ekspor } = hitung(['all'])
    const itemTerjual = analytics.categoryData.reduce((s: number, c: any) => s + c.value, 0)
    expect(ekspor.total.gross).toBeCloseTo(analytics.grossRevenue, 2)
    expect(ekspor.total.cogs).toBeCloseTo(analytics.totalHPP, 2)
    expect(ekspor.total.potongan).toBeCloseTo(analytics.totalDeductions, 2)
    expect(ekspor.total.gp).toBeCloseTo(analytics.grossProfit, 2)
    expect(ekspor.total.qty).toBe(itemTerjual)
    expect(ekspor.total.trx).toBe(analytics.completedOrders.length)
    expect(ekspor.total.batal).toBe(analytics.cancelledCount)
    expect(ekspor.total.subsidi).toBeCloseTo(analytics.totalPlatformSubsidy, 2)
  })

  it('setiap rincian (outlet, channel, item, harian, menu) berjumlah sama dengan total', () => {
    const { ekspor } = hitung(['all'])
    for (const rows of [ekspor.outlets, ekspor.channels, ekspor.outletChannels, ekspor.harian, ekspor.harianOutlet] as Angka[][]) {
      expect(sum(rows, r => r.trx)).toBe(ekspor.total.trx)
      expect(sum(rows, r => r.gross)).toBeCloseTo(ekspor.total.gross, 1)
      expect(sum(rows, r => r.cogs)).toBeCloseTo(ekspor.total.cogs, 1)
      expect(sum(rows, r => r.potongan)).toBeCloseTo(ekspor.total.potongan, 1)
      expect(sum(rows, r => r.gp)).toBeCloseTo(ekspor.total.gp, 1)
      expect(sum(rows, r => r.qty)).toBe(ekspor.total.qty)
    }
    for (const rows of [ekspor.items, ekspor.menu] as Omit<Angka, 'trx'>[][]) {
      expect(sum(rows, r => r.gross)).toBeCloseTo(ekspor.total.gross, 1)
      expect(sum(rows, r => r.cogs)).toBeCloseTo(ekspor.total.cogs, 1)
      expect(sum(rows, r => r.qty)).toBe(ekspor.total.qty)
    }
    expect(sum(ekspor.pembayaran, r => r.trx)).toBe(ekspor.total.trx)
  })

  it('kolom outlet terisi nama & tipe, batal dihitung per outlet', () => {
    const { ekspor } = hitung(['all'])
    const empang = ekspor.outlets.find(o => o.id === 'o1')!
    const cibinong = ekspor.outlets.find(o => o.id === 'o2')!
    expect(empang).toMatchObject({ nama: 'SUKA SHAWARMA EMPANG', tipe: 'Internal', trx: 3, batal: 1 })
    expect(cibinong).toMatchObject({ nama: 'MITRA CIBINONG', tipe: 'Mitra', trx: 2, batal: 0 })
    expect(ekspor.items.every(i => i.outlet && i.channel && i.menu)).toBe(true)
  })

  it('HPP mengikuti tanggal order dan markup mitra', () => {
    const { ekspor } = hitung(['all'])
    const ayamEmpang = ekspor.items.find(i => i.outletId === 'o1' && i.menu === 'Original Ayam Jumbo')!
    expect(ayamEmpang.cogs).toBe(2 * 14500 + 13900)
    const sapiGofood = ekspor.items.find(i => i.outletId === 'o2' && i.channel === 'GoFood' && i.menu === 'Original Sapi Jumbo')!
    expect(sapiGofood.cogs).toBe(Math.round(17000 * 1.1))
  })

  it('Food Apps dipecah per platform, order tanpa item tetap tercatat', () => {
    const { ekspor } = hitung(['all'])
    expect(ekspor.channels.map(c => c.nama).sort()).toEqual(['GoFood', 'GrabFood', 'POS Kasir'])
    const tanpaItem = ekspor.items.find(i => i.menu === '(Pesanan tanpa rincian item)')!
    expect(tanpaItem).toMatchObject({ qty: 0, gross: 30000 })
  })

  it('filter channel ikut diterapkan', () => {
    const { analytics, ekspor } = hitung(['food_apps'])
    expect(ekspor.channels.map(c => c.nama).sort()).toEqual(['GoFood', 'GrabFood'])
    expect(ekspor.total.gross).toBeCloseTo(analytics.grossRevenue, 2)
    expect(ekspor.outlets.map(o => o.id)).toEqual(['o2'])
  })

  it('label metode bayar & channel', () => {
    expect(labelMetodeBayar('cash')).toBe('Tunai')
    expect(labelMetodeBayar(null)).toBe('Lainnya')
    expect(labelMetodeBayar('f3305089-b9e4-4b92-95da-14bf6e7fb6d5')).toBe('TikTok Seller')
    expect(klasifikasiChannel(order({ outlet: 'o1', at: '2026-09-01T00:00:00Z', total: 1, items: [] })).channel).toBe('POS Kasir')
  })
})
