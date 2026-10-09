import { computeSalesExportRows, kategoriEkspor } from './eksporPenjualan'
import { buildMenuMaps, buildPenerapHpp, computeAnalytics } from './compute'

const menuItems = [
  { id: 'm1', name: 'Original Ayam Jumbo', hpp_override: 15000, channel_hpp: null, is_package: false, package_items: [] },
]
const penerapHpp = buildPenerapHpp(menuItems, [])
const { menuItemByNameMap, menuItemByIdMap } = buildMenuMaps(menuItems)
const outlets = [{ id: 'o1', type: 'internal', name: 'SUKA SHAWARMA EMPANG' }]

const item = (qty: number, price: number) => ({
  id: `i${qty}${price}`, menu_item_id: 'm1', menu_item_name: 'Original Ayam Jumbo',
  quantity: qty, unit_price: price, subtotal: qty * price,
})

const orders: any[] = [
  // Kasir: diskon 5.000 → total_amount sudah net.
  { id: 'a', order_number: 1, status: 'completed', payment_method: 'cash', total_amount: 45000, discount_amount: 5000, promo_subsidy: 0,
    created_at: '2026-09-10T03:00:00Z', outlet_id: 'o1', channel: null, sales_source: 'pos_kasir', order_items: [item(2, 25000)] },
  // ShopeeFood: total_amount = harga utuh, promo merchant 10.000 di promo_subsidy.
  { id: 'b', order_number: 2, status: 'completed', payment_method: 'qris', total_amount: 50000, discount_amount: 0, promo_subsidy: 10000,
    created_at: '2026-09-10T18:30:00Z', outlet_id: 'o1', channel: 'shopeefood', sales_source: 'pos', order_items: [item(2, 25000)] },
  // Batal: tidak ikut.
  { id: 'c', order_number: 3, status: 'cancelled', payment_method: 'cash', total_amount: 25000, discount_amount: 0, promo_subsidy: 0,
    created_at: '2026-09-10T05:00:00Z', outlet_id: 'o1', channel: null, sales_source: 'pos_kasir', order_items: [item(1, 25000)] },
]

describe('computeSalesExportRows', () => {
  const rows = computeSalesExportRows(orders, ['all'], outlets, penerapHpp, false, [])
  const sum = (k: 'revenue' | 'adminPlatform' | 'hppTotal') => rows.reduce((s, r) => s + r[k], 0)

  it('Grand Total revenue, potongan & HPP = kartu KPI (promo Food Apps tidak dobel)', () => {
    const a = computeAnalytics({
      orders, shifts: [], selectedChannels: ['all'], menuItemByNameMap, menuItemByIdMap,
      penerapHpp, settlements: [], isSSOnlineSelected: false, outlets,
    })
    expect(a.grossRevenue).toBe(100000) // 50.000 kasir + 50.000 ShopeeFood, bukan 110.000
    expect(sum('revenue')).toBeCloseTo(a.grossRevenue, 6)
    expect(sum('adminPlatform')).toBeCloseTo(a.totalDeductions, 6)
    expect(sum('hppTotal')).toBeCloseTo(a.totalHPP, 6)
  })

  it('tanggal memakai WIB dan nama outlet diringkas', () => {
    // 18:30Z tanggal 10 = 01:30 WIB tanggal 11
    expect(rows.map(r => r.date).sort()).toEqual(['2026-09-10', '2026-09-11'])
    expect(rows.every(r => r.outletName === 'EMPANG')).toBe(true)
  })

  it('kategori channel', () => {
    expect(kategoriEkspor(orders[0])).toBe('POS KASIR (Internal)')
    expect(kategoriEkspor(orders[1])).toBe('Food Apps (GoFood/Grab/Shopee/dll)')
  })
})
