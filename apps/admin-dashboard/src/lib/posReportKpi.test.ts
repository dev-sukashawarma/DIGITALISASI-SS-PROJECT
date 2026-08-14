import { describe, it, expect } from 'vitest'
import { computePosReportKpi, computeNetRevenueVoidAware } from './posReportKpi'

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
