import { describe, it, expect } from 'vitest'
import {
  computePosReportKpi,
  computeNetRevenueVoidAware,
  computeOrderDeduction,
  computeOrderGross,
  computeItemShares,
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

  it('Food Apps pasca 19 Agu (harga utuh + promo_subsidy terisi): subsidi TIDAK dihitung dua kali', () => {
    // total_amount sudah harga utuh, promo_subsidy tetap diisi kasir.
    const o = {
      total_amount: 50_000,
      discount_amount: 0,
      promo_subsidy: 15_000,
      order_items: [{ subtotal: 50_000, quantity: 1, unit_price: 50_000 }],
    }
    expect(computeOrderDeduction(o)).toBe(0)
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
