// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { LABA_KOTOR_INTERNAL_CLOSING_OKT_2026 as L, PENDAPATAN_MITRA_CLOSING_OKT_2026 as P, NET_PROFIT_INTERNAL_OKT_2026 } from './closingOktober2026'
import { penyesuaianLabaKotorClosing, pendapatanMitraClosingUntuk } from './closingBulanan'
import { MITRA_CLOSING_DATA_OKTOBER_2026 as M } from '@/app/actions/mitraPnlClosingDataOktober2026'
import { getMitraClosing, getMitraClosingMonth, isClosingBerlaku } from '@/app/actions/mitraPnlClosingData'

// Angka laporan final Oktober 2026 (dikonfirmasi owner 10 Nov 2026).
const OPEX_OUTLET_INTERNAL = 155_036_681 // C50:L50, sama dengan data live
const OPEX_HQ = 155_389_617 // B73, sama dengan data live

describe('closing Laba Rugi Internal Oktober 2026', () => {
  it('total laba kotor = jumlah per outlet', () => {
    const jumlah = (k: 'omzet' | 'potongan' | 'komisiTiktokKedua' | 'hpp' | 'waste') =>
      Object.values(L.outlets).reduce((s, o) => s + o[k], 0)
    for (const k of ['omzet', 'potongan', 'komisiTiktokKedua', 'hpp', 'waste'] as const) {
      expect(L.total[k]).toBeCloseTo(jumlah(k), 2)
    }
    expect(L.total.komisiTiktokKedua).toBe(6_769_516)
  })

  it('Net Profit Internal sama dengan laporan (B77 = 2.561.619)', () => {
    const t = L.total
    const labaKotorOutlet = t.omzet - t.potongan - t.komisiTiktokKedua - t.hpp - t.waste
    const pendapatanMitra = pendapatanMitraClosingUntuk('2026-10-01', '2026-10-31')!
    const net = labaKotorOutlet - OPEX_OUTLET_INTERNAL + pendapatanMitra.feeManajemen + pendapatanMitra.marginHpp - OPEX_HQ
    expect(net).toBeCloseTo(NET_PROFIT_INTERNAL_OKT_2026, 2)
    expect(Math.round(net)).toBe(2_561_619)
  })

  it('pendapatan pusat dari mitra = baris 55 (Z55)', () => {
    const p = pendapatanMitraClosingUntuk('2026-10-01', '2026-10-31')!
    expect(p.feeManajemen + p.marginHpp).toBeCloseTo(111_996_789.8, 1)
    expect(Object.keys(P.outlets)).toHaveLength(13)
  })

  it('penyesuaian hanya untuk rentang tepat 1–31 Oktober, dan menolkan pendapatan lain-lain', () => {
    const live = { omzet: 100, potongan: 10, hpp: 50, waste: 1 }
    const p = penyesuaianLabaKotorClosing('2026-10-01', '2026-10-31', live)!
    expect(p.label).toBe('Oktober 2026')
    expect(p.pendapatanLain).toBe(0)
    expect(p.omzet).toBe(L.total.omzet - 100)
    expect(penyesuaianLabaKotorClosing('2026-10-01', '2026-10-30', live)).toBeNull()
    expect(pendapatanMitraClosingUntuk('2026-10-02', '2026-10-31')).toBeNull()
  })

  it('September tetap seperti sebelumnya (pendapatan lain-lain tidak ditimpa)', () => {
    const p = penyesuaianLabaKotorClosing('2026-09-01', '2026-09-30', { omzet: 0, potongan: 0, hpp: 0, waste: 0 })!
    expect(p.label).toBe('September 2026')
    expect(p.pendapatanLain).toBeNull()
    expect(p.komisiTiktokKedua).toBe(5_654_680)
  })
})

describe('closing mitra Oktober 2026', () => {
  it('13 outlet, total bagi hasil mitra = laporan (Z52)', () => {
    expect(Object.keys(M)).toHaveLength(13)
    const total = Object.values(M).reduce((s, o) => s + o.totals.mitraShare, 0)
    expect(total).toBeCloseTo(121_526_376.5, 1)
  })

  it('setiap outlet konsisten: laba = pendapatan bersih − HPP − waste − OPEX − fee, rincian OPEX = total', () => {
    for (const o of Object.values(M)) {
      const t = o.totals
      expect(t.grossRevenue - t.totalDeductions).toBeCloseTo(t.netRevenue, 2)
      expect(t.netRevenue - t.totalCogs - t.totalWaste - t.totalOpex - t.managementFeeAmount).toBeCloseTo(t.netProfit, 2)
      expect((o.opexLines ?? []).reduce((s, l) => s + l.amount, 0)).toBeCloseTo(t.totalOpex, 2)
    }
  })

  it('angka per outlet mengikuti laporan closing (fee, rincian OPEX, persen bagi hasil)', () => {
    for (const id of ['550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440018',
      '550e8400-e29b-41d4-a716-446655440019', '5a4df577-5237-476e-b54c-9eb642a5a516']) {
      expect(M[id].totals.managementFeeAmount).toBe(0)
    }
    for (const id of ['550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440018']) {
      expect(M[id].opexLines?.some(l => l.label === 'Biaya Sewa Outlet')).toBe(false)
    }
    expect(M['550e8400-e29b-41d4-a716-446655440014'].totals.profitSharingPct).toBe(50)
    expect(M['48b980da-5a42-4a9b-a952-86ab5db6666a'].totals.netProfit).toBeCloseTo(4_129_174.6, 1)
  })

  it('terdaftar sebagai bulan closing penuh', () => {
    const okt = getMitraClosingMonth('2026-10-01', '2026-10-31')!
    expect(okt.terapkanPenuh).toBe(true)
    expect(getMitraClosing('550e8400-e29b-41d4-a716-446655440017', '2026-10-01', '2026-10-31')?.totals.netProfit)
      .toBe(M['550e8400-e29b-41d4-a716-446655440017'].totals.netProfit)
    // Outlet tanpa penjualan (mis. Karawaci) tidak menghalangi closing.
    expect(isClosingBerlaku(okt, [...Object.keys(M), 'a85330a1-c150-4389-9a94-c23b66aaed7c'], id => id !== 'a85330a1-c150-4389-9a94-c23b66aaed7c')).toBe(true)
  })
})
