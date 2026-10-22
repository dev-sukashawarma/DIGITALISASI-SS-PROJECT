import { describe, expect, it } from 'vitest'
import {
  classifyOrderReceipt,
  computeRekapStrukBase,
  filterRekapStrukOrders,
  isOfflineOrWebsiteOrder,
  toSkipKindFilter,
} from './rekapStruk'
import type { OrderRow } from './compute'

function makeOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: overrides.id ?? 'ord-1',
    order_number: overrides.order_number ?? 10,
    status: overrides.status ?? 'completed',
    payment_method: overrides.payment_method ?? 'qris',
    total_amount: overrides.total_amount ?? 50000,
    created_at: overrides.created_at ?? '2026-10-21T15:00:00.000Z',
    outlet_id: overrides.outlet_id ?? 'out-1',
    channel: overrides.channel ?? 'pos_kasir',
    sales_source: overrides.sales_source ?? 'pos',
    customer_name: overrides.customer_name ?? 'Pelanggan Walk-In',
    cashier_name: overrides.cashier_name ?? 'HENDRIYAWAN',
    customer_receipt_print_count: overrides.customer_receipt_print_count ?? 0,
    kitchen_receipt_print_count: overrides.kitchen_receipt_print_count ?? 0,
    customer_receipt_skipped: overrides.customer_receipt_skipped ?? false,
    kitchen_receipt_skipped: overrides.kitchen_receipt_skipped ?? false,
    order_items: overrides.order_items ?? [
      {
        id: 'oi-1',
        menu_item_name: 'Original Sapi Sedang',
        quantity: 2,
        unit_price: 25000,
        subtotal: 50000,
      },
    ],
  }
}

describe('rekapStruk — klasifikasi & agregasi kepatuhan cetak struk', () => {
  it('mengklasifikasikan status cetak struk per order secara akurat', () => {
    const bothSkipped = classifyOrderReceipt({
      customer_receipt_print_count: 0,
      kitchen_receipt_print_count: 0,
      customer_receipt_skipped: true,
      kitchen_receipt_skipped: true,
    })
    expect(bothSkipped).toEqual({
      isTracked: true,
      isNotPrinted: true,
      isLatePrinted: false,
      isPrintedNormal: false,
      customerSkipped: true,
      kitchenSkipped: true,
      bothSkipped: true,
    })

    const customerOnlySkipped = classifyOrderReceipt({
      customer_receipt_print_count: 0,
      kitchen_receipt_print_count: 1,
      customer_receipt_skipped: true,
      kitchen_receipt_skipped: false,
    })
    expect(customerOnlySkipped.isNotPrinted).toBe(true)
    expect(customerOnlySkipped.customerSkipped).toBe(true)
    expect(customerOnlySkipped.kitchenSkipped).toBe(false)
    expect(customerOnlySkipped.bothSkipped).toBe(false)
  })

  it('mengabaikan order Food Apps (GoFood, GrabFood, ShopeeFood, TikTok Go) dan hanya menghitung Order Offline & Website', () => {
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'out-1', channel: 'pos_kasir', sales_source: 'pos' })).toBe(true)
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'out-1', channel: 'website', sales_source: 'online' })).toBe(true)
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'out-1', channel: 'gofood', sales_source: 'pos' })).toBe(false)
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'out-1', channel: 'grabfood', sales_source: 'pos' })).toBe(false)
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'out-1', channel: 'shopeefood', sales_source: 'pos' })).toBe(false)
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'out-1', channel: 'tiktokgo', sales_source: 'pos' })).toBe(false)
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'out-1', channel: 'food_apps', sales_source: 'pos' })).toBe(false)
    expect(isOfflineOrWebsiteOrder({ outlet_id: 'ss-online', channel: 'tiktok_shop', sales_source: 'tiktok_shop' })).toBe(false)

    // Food Apps dengan customer_receipt_skipped = true tidak boleh terdeteksi sebagai tidak cetak struk
    const foodAppClassified = classifyOrderReceipt({
      outlet_id: 'out-1',
      channel: 'gofood',
      sales_source: 'pos',
      customer_receipt_skipped: true,
      kitchen_receipt_skipped: true,
    })
    expect(foodAppClassified.isNotPrinted).toBe(false)
  })

  it('menghitung rekap kasir, AM, dicetak, tidak dicetak, dan % struk dicetak khusus Offline & Website', () => {
    const outlets = [
      { id: 'out-1', name: 'Cabang Tebet', type: 'outlet', amName: 'Budi Santoso' },
      { id: 'out-2', name: 'Cabang Kemang', type: 'mitra', amName: 'Andi Wijaya' },
    ]

    const orders: OrderRow[] = [
      // Cabang Tebet - Kasir RAKA: 3 Offline + 1 Website = 4 transaksi valid (1 dicetak, 3 tidak dicetak)
      makeOrder({
        id: '1',
        outlet_id: 'out-1',
        channel: 'pos_kasir',
        sales_source: 'pos',
        cashier_name: 'MOHAMAD RAKA',
        total_amount: 54000,
        customer_receipt_skipped: true,
        kitchen_receipt_skipped: true,
      }),
      makeOrder({
        id: '2',
        outlet_id: 'out-1',
        channel: 'website',
        sales_source: 'online',
        cashier_name: 'MOHAMAD RAKA',
        total_amount: 42000,
        customer_receipt_skipped: true,
        kitchen_receipt_print_count: 1,
      }),
      makeOrder({
        id: '3',
        outlet_id: 'out-1',
        channel: 'pos_kasir',
        sales_source: 'pos',
        cashier_name: 'MOHAMAD RAKA',
        total_amount: 48000,
        customer_receipt_print_count: 1,
        kitchen_receipt_skipped: true,
      }),
      makeOrder({
        id: '4',
        outlet_id: 'out-1',
        channel: 'pos_kasir',
        sales_source: 'pos',
        cashier_name: 'MOHAMAD RAKA',
        total_amount: 30000,
        customer_receipt_print_count: 1,
        kitchen_receipt_print_count: 1,
      }),
      // Order Food Apps (GoFood, GrabFood, ShopeeFood, TikTok Go) yang dilewati struknya HARUS DIABAIKAN!
      makeOrder({
        id: 'fa-1',
        outlet_id: 'out-1',
        channel: 'gofood',
        sales_source: 'GoFood',
        cashier_name: 'MOHAMAD RAKA',
        total_amount: 95000,
        customer_receipt_skipped: true,
        kitchen_receipt_skipped: true,
      }),
      makeOrder({
        id: 'fa-2',
        outlet_id: 'out-1',
        channel: 'shopeefood',
        sales_source: 'ShopeeFood',
        cashier_name: 'KASIR KHUSUS FOODAPPS',
        total_amount: 80000,
        customer_receipt_skipped: true,
        kitchen_receipt_skipped: true,
      }),
      // Cabang Kemang - Kasir DAMAR: 2 transaksi Offline (1 dicetak, 1 tidak dicetak)
      makeOrder({
        id: '5',
        outlet_id: 'out-2',
        channel: 'pos_kasir',
        sales_source: 'pos',
        cashier_name: 'DAMAR HADI',
        total_amount: 108000,
        customer_receipt_skipped: true,
        kitchen_receipt_skipped: true,
      }),
      makeOrder({
        id: '6',
        outlet_id: 'out-2',
        channel: 'pos_kasir',
        sales_source: 'pos',
        cashier_name: 'DAMAR HADI',
        total_amount: 60000,
        customer_receipt_print_count: 1,
        kitchen_receipt_print_count: 1,
      }),
    ]

    const res = computeRekapStrukBase({
      orders,
      outlets,
      selectedChannels: ['all'],
    })

    // Hanya 6 order (Offline + Website) yang dihitung; 2 order Food Apps diabaikan
    expect(res.summary.totalOrders).toBe(6)
    expect(res.summary.printedOrders).toBe(2)
    expect(res.summary.notPrintedOrders).toBe(4)
    expect(res.summary.printedRate).toBe(33.3)
    expect(res.summary.notPrintedRate).toBe(66.7)
    expect(res.availableAreaManagers).toEqual(['Andi Wijaya', 'Budi Santoso'])
    expect(res.cashierRecap.map((c) => c.cashierName)).not.toContain('KASIR KHUSUS FOODAPPS')

    // Rekap Kasir
    expect(res.cashierRecap[0].cashierName).toBe('MOHAMAD RAKA')
    expect(res.cashierRecap[0].outletName).toBe('Cabang Tebet')
    expect(res.cashierRecap[0].amName).toBe('Budi Santoso')
    expect(res.cashierRecap[0].totalOrders).toBe(4)
    expect(res.cashierRecap[0].printedOrders).toBe(1)
    expect(res.cashierRecap[0].notPrintedOrders).toBe(3)
    expect(res.cashierRecap[0].printedRate).toBe(25)
    expect(res.cashierRecap[0].notPrintedRate).toBe(75)

    expect(res.cashierRecap[1].cashierName).toBe('DAMAR HADI')
    expect(res.cashierRecap[1].amName).toBe('Andi Wijaya')
    expect(res.cashierRecap[1].totalOrders).toBe(2)
    expect(res.cashierRecap[1].printedOrders).toBe(1)
    expect(res.cashierRecap[1].notPrintedOrders).toBe(1)
    expect(res.cashierRecap[1].printedRate).toBe(50)

    // Filter order berdasarkan AM & kasir
    const filteredByAm = filterRekapStrukOrders({
      completedOrders: res.completedOrders,
      skipKindFilter: toSkipKindFilter('all_not_printed'),
      outletFilter: 'all',
      amFilter: 'Budi Santoso',
      cashierFilter: 'all',
      paymentMethod: 'all',
      searchQuery: '',
    })
    expect(filteredByAm.rows).toHaveLength(3)
    expect(filteredByAm.totalAmount).toBe(54000 + 42000 + 48000)
  })
})
