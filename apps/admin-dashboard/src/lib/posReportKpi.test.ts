import { describe, it, expect } from 'vitest'
import {
  computePosReportKpi,
  computeNetRevenueVoidAware,
  computeOrderDeduction,
  computeOrderGross,
  computeItemShares,
  computeOrderPlatformSubsidy,
  buildGofoodSettlementPromoMap,
  isGoFoodOrder,
} from './posReportKpi'

// Satu acuan per order untuk kartu KPI DAN semua ekspor (PDF/CSV/Excel):
//   Potongan = nilai menu - total_amount (tak pernah negatif)
//   Gross    = total_amount + Potongan
describe('computeOrderDeduction / computeOrderGross', () => {
  it('order POS: potongan = nilai menu - total_amount', () => {
    const o = {
      total_amount: 45_000,
      discount_amount: 5_000,
      promo_subsidy: 0,
      order_items: [{ subtotal: 30_000, quantity: 1, unit_price: 30_000 }, { subtotal: 20_000, quantity: 2, unit_price: 10_000 }],
    }
    expect(computeOrderDeduction(o)).toBe(5_000)
    expect(computeOrderGross(o)).toBe(50_000)
  })

  it('Food Apps pasca 19 Agu (harga utuh + promo_subsidy terisi): potongan masuk ke deduction, gross tetap utuh', () => {
    // total_amount sudah harga utuh, promo_subsidy diisi kasir.
    const o = {
      channel: 'grabfood',
      total_amount: 50_000,
      discount_amount: 0,
      promo_subsidy: 15_000,
      order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
    }
    expect(computeOrderDeduction(o)).toBe(15_000)
    expect(computeOrderGross(o)).toBe(50_000)
  })

  it('total_amount lebih besar dari nilai menu (kode unik QRIS): potongan 0, gross = total_amount', () => {
    const o = { total_amount: 50_123, order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }] }
    expect(computeOrderDeduction(o)).toBe(0)
    expect(computeOrderGross(o)).toBe(50_123)
  })

  it('subtotal kosong jatuh ke quantity x unit_price', () => {
    const o = { total_amount: 18_000, order_items: [{ subtotal: 0, quantity: 2, unit_price: 10_000 }] }
    expect(computeOrderDeduction(o)).toBe(2_000)
  })

  it('order tanpa item: potongan = discount_amount + promo_subsidy', () => {
    const o = { total_amount: 90_000, discount_amount: 7_000, promo_subsidy: 3_000, order_items: [] }
    expect(computeOrderDeduction(o)).toBe(10_000)
    expect(computeOrderGross(o)).toBe(100_000)
  })

  it('baris sintetis SS Online memakai discount_amount, bukan selisih item', () => {
    const o = {
      outlet_id: 'ss-online',
      total_amount: 80_000,
      discount_amount: 20_000,
      order_items: [{ subtotal: 130_000, quantity: 1, unit_price: 130_000 }],
    }
    expect(computeOrderDeduction(o)).toBe(20_000)
    expect(computeOrderGross(o)).toBe(100_000)
  })

  it('mode SS Online terpilih: semua order memakai discount_amount', () => {
    const o = {
      outlet_id: 'uuid-marketplace',
      total_amount: 80_000,
      discount_amount: 4_000,
      order_items: [{ subtotal: 130_000, quantity: 1, unit_price: 130_000 }],
    }
    expect(computeOrderDeduction(o, { ssOnlineMode: true })).toBe(4_000)
  })

  // ─── CARD BIRU FOOD APPS REKONSILIASI (PRIORITY 1 GOFOOD) ───
  it('GoFood dengan settlement: Card Biru dioverride promo_merchant settlement, bukan promo_subsidy kasir', () => {
    // Kasir input promo_subsidy 30.000 (total promo konsumen yang memuat subsidi Gojek)
    // Settlement GoBiz menyatakan promo yang ditanggung resto sebenarnya hanya 10.000
    const o = {
      channel: 'gofood',
      total_amount: 50_000,
      promo_subsidy: 30_000,
      settlement_promo_merchant: 10_000,
      order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
    }
    // Card Biru (Potongan Merchant) harus 10.000 (bukan 30.000)
    expect(computeOrderDeduction(o)).toBe(10_000)
    expect(computeOrderGross(o)).toBe(50_000)
  })

  it('GoFood tanpa settlement (belum diupload): Card Biru fallback aman ke promo_subsidy kasir', () => {
    const o = {
      channel: 'gofood',
      total_amount: 50_000,
      promo_subsidy: 30_000,
      order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
    }
    expect(computeOrderDeduction(o)).toBe(30_000)
    expect(computeOrderGross(o)).toBe(50_000)
  })

  it('GoFood override via options.getGofoodSettlementPromo', () => {
    const o = {
      id: 'ord-123',
      channel: 'gofood',
      total_amount: 60_000,
      promo_subsidy: 25_000,
      order_items: [{ subtotal: 60_000, quantity: 1, unit_price: 60_000 }],
    }
    const opts = {
      getGofoodSettlementPromo: (ord: any) => ord.id === 'ord-123' ? 8_000 : null,
    }
    expect(computeOrderDeduction(o, opts)).toBe(8_000)
  })

  it('GrabFood & ShopeeFood: TETAP pakai promo_subsidy kasir (sudah akurat, tidak dioverride)', () => {
    const grab = {
      channel: 'grabfood',
      total_amount: 40_000,
      promo_subsidy: 12_000,
      order_items: [{ subtotal: 40_000, quantity: 1, unit_price: 40_000 }],
    }
    const shopee = {
      channel: 'shopeefood',
      total_amount: 45_000,
      promo_subsidy: 14_000,
      order_items: [{ subtotal: 45_000, quantity: 1, unit_price: 45_000 }],
    }
    expect(computeOrderDeduction(grab)).toBe(12_000)
    expect(computeOrderDeduction(shopee)).toBe(14_000)
  })
})

describe('computeOrderPlatformSubsidy', () => {
  it('GoFood dengan settlement: selisih kasir vs settlement masuk Subsidi Platform (Gojek)', () => {
    const o = {
      channel: 'gofood',
      total_amount: 50_000,
      promo_subsidy: 30_000,
      settlement_promo_merchant: 10_000,
      order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
    }
    // Selisih = 30.000 - 10.000 = 20.000 (subsidi Gojek, bukan beban resto)
    expect(computeOrderPlatformSubsidy(o)).toBe(20_000)
  })

  it('GoFood tanpa settlement: subsidi platform bernilai 0 (belum ada pemisahan)', () => {
    const o = {
      channel: 'gofood',
      total_amount: 50_000,
      promo_subsidy: 30_000,
      order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
    }
    expect(computeOrderPlatformSubsidy(o)).toBe(0)
  })

  it('GrabFood & ShopeeFood: subsidi platform 0 (input kasir murni diskon toko)', () => {
    const grab = { channel: 'grabfood', total_amount: 50_000, promo_subsidy: 15_000, order_items: [] }
    const shopee = { channel: 'shopeefood', total_amount: 50_000, promo_subsidy: 10_000, order_items: [] }
    expect(computeOrderPlatformSubsidy(grab)).toBe(0)
    expect(computeOrderPlatformSubsidy(shopee)).toBe(0)
  })

  it('TikTok Go: seluruh promo yang diinput kasir dipisahkan sebagai subsidi platform', () => {
    const tt = { channel: 'tiktokgo', total_amount: 34_000, promo_subsidy: 34_000, order_items: [] }
    expect(computeOrderPlatformSubsidy(tt)).toBe(34_000)
    expect(computeOrderDeduction(tt)).toBe(0)
  })
})

describe('buildGofoodSettlementPromoMap', () => {
  it('mengalokasikan total promo_merchant settlement harian ke order GoFood secara proporsional', () => {
    const orders = [
      {
        id: 'ord-1',
        outlet_id: 'out-cibubur',
        created_at: '2026-10-01T11:00:00+07:00',
        channel: 'gofood',
        total_amount: 50_000,
        promo_subsidy: 20_000, // 2/3 dari total kasir
        order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
      },
      {
        id: 'ord-2',
        outlet_id: 'out-cibubur',
        created_at: '2026-10-01T14:30:00+07:00',
        channel: 'gofood',
        total_amount: 50_000,
        promo_subsidy: 10_000, // 1/3 dari total kasir
        order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
      },
      {
        id: 'ord-3',
        outlet_id: 'out-cibubur',
        created_at: '2026-10-01T18:00:00+07:00',
        channel: 'grabfood', // GrabFood tidak boleh diubah settlement GoFood
        total_amount: 40_000,
        promo_subsidy: 15_000,
        order_items: [{ subtotal: 40_000, quantity: 1, unit_price: 40_000 }],
      },
    ]

    const settlements = [
      {
        platform: 'gofood',
        outlet_id: 'out-cibubur',
        tanggal: '2026-10-01',
        promo_merchant: 12_000, // Dari GoBiz: resto hanya menanggung 12.000 dari total 30.000 kasir
      },
    ]

    const map = buildGofoodSettlementPromoMap(orders, settlements)

    // ord-1 dapat 20/30 * 12.000 = 8.000
    expect(map.get('ord-1')).toBe(8_000)
    // ord-2 dapat 10/30 * 12.000 = 4.000
    expect(map.get('ord-2')).toBe(4_000)
    // Total teralokasi = 8.000 + 4.000 = 12.000 (persis sama dengan settlement)
    expect(map.get('ord-1')! + map.get('ord-2')!).toBe(12_000)
    // ord-3 (GrabFood) tidak masuk map
    expect(map.has('ord-3')).toBe(false)
  })

  it('GoFood order tunggal pada hari itu mendapat 100% promo_merchant settlement', () => {
    const orders = [
      {
        id: 'ord-single',
        outlet_id: 'out-depok',
        created_at: '2026-10-02T12:00:00+07:00',
        channel: 'gofood',
        total_amount: 100_000,
        promo_subsidy: 40_000,
        order_items: [{ subtotal: 100_000, quantity: 1, unit_price: 100_000 }],
      },
    ]
    const settlements = [
      { platform: 'gofood', outlet_id: 'out-depok', tanggal: '2026-10-02', promo_merchant: 15_000 },
    ]
    const map = buildGofoodSettlementPromoMap(orders, settlements)
    expect(map.get('ord-single')).toBe(15_000)
  })

  it('jika kasir promo_subsidy = 0, alokasi dilakukan berdasarkan omzet order', () => {
    const orders = [
      {
        id: 'ord-a',
        outlet_id: 'out-depok',
        created_at: '2026-10-03T12:00:00+07:00',
        channel: 'gofood',
        total_amount: 60_000,
        promo_subsidy: 0,
        order_items: [{ subtotal: 60_000, quantity: 1, unit_price: 60_000 }],
      },
      {
        id: 'ord-b',
        outlet_id: 'out-depok',
        created_at: '2026-10-03T13:00:00+07:00',
        channel: 'gofood',
        total_amount: 40_000,
        promo_subsidy: 0,
        order_items: [{ subtotal: 40_000, quantity: 1, unit_price: 40_000 }],
      },
    ]
    const settlements = [
      { platform: 'gofood', outlet_id: 'out-depok', tanggal: '2026-10-03', promo_merchant: 10_000 },
    ]
    const map = buildGofoodSettlementPromoMap(orders, settlements)
    // 60k : 40k -> 6k : 4k
    expect(map.get('ord-a')).toBe(6_000)
    expect(map.get('ord-b')).toBe(4_000)
  })
})

describe('isGoFoodOrder', () => {
  it('mengenali semua format identifier GoFood', () => {
    expect(isGoFoodOrder({ channel: 'gofood' })).toBe(true)
    expect(isGoFoodOrder({ channel: 'gojek' })).toBe(true)
    expect(isGoFoodOrder({ channel: 'go_food' })).toBe(true)
    expect(isGoFoodOrder({ sales_source: 'gofood' })).toBe(true)
    expect(isGoFoodOrder({ channel: '1284ac2a-e753-4380-9f32-59219a322459' })).toBe(true)
    expect(isGoFoodOrder({ channel: 'grabfood' })).toBe(false)
    expect(isGoFoodOrder({ channel: 'shopeefood' })).toBe(false)
    expect(isGoFoodOrder({ channel: 'pos_kasir' })).toBe(false)
  })
})

describe('computeItemShares', () => {
  it('bobot sesuai nilai item dan selalu berjumlah 1', () => {
    const shares = computeItemShares([{ subtotal: 30_000 }, { subtotal: 10_000 }])
    expect(shares).toEqual([0.75, 0.25])
  })

  it('semua subtotal 0 (item gratis) dibagi rata menurut quantity', () => {
    const shares = computeItemShares([{ subtotal: 0, quantity: 3 }, { subtotal: 0, quantity: 1 }])
    expect(shares).toEqual([0.75, 0.25])
  })

  it('tanpa nilai dan tanpa quantity dibagi sama rata', () => {
    expect(computeItemShares([{}, {}])).toEqual([0.5, 0.5])
  })

  it('daftar kosong menghasilkan array kosong', () => {
    expect(computeItemShares([])).toEqual([])
  })

  it('gross order teralokasi utuh ke item (tak ada rupiah hilang)', () => {
    const o = {
      total_amount: 45_000,
      order_items: [{ subtotal: 30_000, quantity: 1 }, { subtotal: 20_000, quantity: 2 }, { subtotal: 0, quantity: 1 }],
    }
    const gross = computeOrderGross(o)
    const allocated = computeItemShares(o.order_items).reduce((s, w) => s + w * gross, 0)
    expect(allocated).toBeCloseTo(gross, 6)
  })
})

// Aturan bisnis (owner, 2026-07-31):
//   Gross Revenue = omzet SEBELUM dipotong apa pun
//   Admin Platform = promo + diskon
//   Total COGS     = HPP per item
//   Gross Profit   = Gross Revenue - (Total COGS + Admin Platform)
describe('computePosReportKpi', () => {
  it('menambahkan potongan balik untuk dapat gross sebenarnya', () => {
    // total_amount di DB sudah net, jadi gross = net + potongan
    const kpi = computePosReportKpi(1_445_461_752, 28_034_694, 505_246_942)
    expect(kpi.grossRevenue).toBe(1_473_496_446)
  })

  it('Gross Profit = Gross Revenue - (COGS + Admin Platform)', () => {
    const kpi = computePosReportKpi(1_445_461_752, 28_034_694, 505_246_942)
    expect(kpi.grossProfit).toBe(940_214_810)
  })

  it('Gross Profit tidak berubah dibanding perhitungan lama (net - HPP)', () => {
    // Bukti tak ada double-subtract: potongan ditambah di gross lalu dikurangi
    // lagi di profit, jadi saling hapus. Angka laba tetap sama seperti sebelum
    // kartu Gross Revenue dibetulkan.
    const net = 1_445_461_752
    const ded = 28_034_694
    const hpp = 505_246_942
    expect(computePosReportKpi(net, ded, hpp).grossProfit).toBe(net - hpp)
  })

  it('tanpa potongan, gross sama dengan net', () => {
    const kpi = computePosReportKpi(1_000_000, 0, 400_000)
    expect(kpi.grossRevenue).toBe(1_000_000)
    expect(kpi.grossProfit).toBe(600_000)
  })
})

// Order void tidak pernah menjadi pendapatan. Sesuai aturan laporan saat ini,
// hanya order `completed` yang dihitung; cancelled tidak dikurangkan kedua kali.
describe('computeNetRevenueVoidAware', () => {
  it('mengabaikan total_amount order cancelled', () => {
    const orders = [
      { status: 'completed', total_amount: 4_015_000 },
      { status: 'cancelled', total_amount: 94_000 },
    ]
    expect(computeNetRevenueVoidAware(orders)).toBe(4_015_000)
  })

  it('mengabaikan status selain completed/cancelled', () => {
    const orders = [
      { status: 'completed', total_amount: 100_000 },
      { status: 'pending', total_amount: 999_999 },
    ]
    expect(computeNetRevenueVoidAware(orders)).toBe(100_000)
  })

  it('tanpa order cancelled, hasilnya sama seperti sum completed biasa', () => {
    const orders = [
      { status: 'completed', total_amount: 50_000 },
      { status: 'completed', total_amount: 30_000 },
    ]
    expect(computeNetRevenueVoidAware(orders)).toBe(80_000)
  })

  it('array kosong menghasilkan 0', () => {
    expect(computeNetRevenueVoidAware([])).toBe(0)
  })
})
