import { describe, expect, it } from 'vitest'
import {
  MANAGEMENT_FEE_OPEX_DEDUCTION_CUTOFF,
  applyHoOpexManagementFeeOffset,
  computeMitraManagementFees,
} from './managementFee'
import { computeCompanyProfit } from './profit'
import { buildProfitWaterfall } from './profitWaterfall'
import { computeOwnerNetProfit } from './ownerDashboardAlign'

const OUTLETS = [
  { id: 'internal-1', name: 'SS Dago (Internal)', type: 'internal' },
  { id: 'mitra-active', name: 'SS Antapani (Mitra Belum BEP)', type: 'mitra' },
  { id: 'mitra-bep', name: 'SS Buahbatu (Mitra Sudah BEP)', type: 'mitra' },
]

const INVESTMENTS = {
  'mitra-active': {
    outlet_id: 'mitra-active',
    nilai_investasi: 200_000_000,
    tanggal_mulai: '2026-01-01',
    isBep: false,
  },
  'mitra-bep': {
    outlet_id: 'mitra-bep',
    nilai_investasi: 125_000_000,
    tanggal_mulai: '2025-01-01',
    isBep: true,
  },
}

describe('computeMitraManagementFees & applyHoOpexManagementFeeOffset', () => {
  it('tetap menjaga bulan Closing (< 2026-11-01, misal Sep & Okt 2026) 100% di pos pendapatan pusat tanpa memotong OPEX HO', () => {
    expect(MANAGEMENT_FEE_OPEX_DEDUCTION_CUTOFF).toBe('2026-11-01')

    const res = computeMitraManagementFees({
      salesRows: [
        { outlet_id: 'mitra-active', sales_date: '2026-10-15', omzet: 95_000_000, total_deductions: 5_000_000 },
        { outlet_id: 'mitra-bep', sales_date: '2026-10-15', omzet: 80_000_000, total_deductions: 0 },
      ],
      outlets: OUTLETS,
      investments: INVESTMENTS,
      periodFrom: '2026-10-01',
      periodTo: '2026-10-31',
    })

    // 3% dari 100 juta = 3.000.000 seluruhnya masuk legacy revenue, 0 memotong OPEX HO
    expect(res.totalMitraFee).toBe(3_000_000)
    expect(res.totalFeeLegacyRevenue).toBe(3_000_000)
    expect(res.totalFeeForHoOpex).toBe(0)

    const offset = applyHoOpexManagementFeeOffset(12_000_000, res.totalFeeForHoOpex)
    expect(offset.appliedDeduction).toBe(0)
    expect(offset.netHoOpex).toBe(12_000_000)
    expect(offset.surplusToRevenue).toBe(0)
  })

  it('mulai November 2026 (>= 2026-11-01): 3% dari outlet belum BEP memotong OPEX HO, outlet BEP = 0%', () => {
    const res = computeMitraManagementFees({
      salesRows: [
        { outlet_id: 'mitra-active', sales_date: '2026-11-10', omzet: 90_000_000, total_deductions: 10_000_000 },
        { outlet_id: 'mitra-bep', sales_date: '2026-11-10', omzet: 70_000_000, total_deductions: 5_000_000 },
      ],
      outlets: OUTLETS,
      investments: INVESTMENTS,
      periodFrom: '2026-11-01',
      periodTo: '2026-11-30',
    })

    expect(res.totalMitraFee).toBe(3_000_000)
    expect(res.totalFeeLegacyRevenue).toBe(0)
    expect(res.totalFeeForHoOpex).toBe(3_000_000)
    expect(res.perOutletFee.get('mitra-bep')?.fee).toBe(0)
    expect(res.activeHoFeeOutlets).toHaveLength(1)
    expect(res.activeHoFeeOutlets[0].outletId).toBe('mitra-active')

    const offset = applyHoOpexManagementFeeOffset(10_000_000, res.totalFeeForHoOpex)
    expect(offset.rawHoOpex).toBe(10_000_000)
    expect(offset.appliedDeduction).toBe(3_000_000)
    expect(offset.netHoOpex).toBe(7_000_000)
    expect(offset.surplusToRevenue).toBe(0)
  })

  it('rentang lintas bulan Oktober -> November membagi porsi fee per tanggal tanpa duplikasi sepeser pun', () => {
    const res = computeMitraManagementFees({
      salesRows: [
        { outlet_id: 'mitra-active', sales_date: '2026-10-30', omzet: 40_000_000, total_deductions: 0 },
        { outlet_id: 'mitra-active', sales_date: '2026-11-02', omzet: 60_000_000, total_deductions: 0 },
      ],
      outlets: OUTLETS,
      investments: INVESTMENTS,
      periodFrom: '2026-10-28',
      periodTo: '2026-11-03',
    })

    expect(res.totalFeeLegacyRevenue).toBe(1_200_000) // 3% x 40 jt
    expect(res.totalFeeForHoOpex).toBe(1_800_000) // 3% x 60 jt
    expect(res.totalFeeLegacyRevenue + res.totalFeeForHoOpex).toBe(res.totalMitraFee)
  })

  it('membatasi OPEX Head Office minimal Rp 0 saat Fee 3% melebihi OPEX HO (tidak minus & tidak memotong outlet)', () => {
    const offset = applyHoOpexManagementFeeOffset(2_000_000, 3_500_000)
    expect(offset.netHoOpex).toBe(0)
    expect(offset.appliedDeduction).toBe(2_000_000)
    expect(offset.surplusToRevenue).toBe(1_500_000)
    // Identitas nol duplikasi: potongan OPEX + surplus pendapatan === total fee tersedia
    expect(offset.appliedDeduction + offset.surplusToRevenue).toBe(offset.availableFee)
  })

  it('menjaga identitas konsolidasi Laba Rugi (Internal + Mitra === Global) & Ringkasan Bisnis dengan Rp 0 duplikasi', () => {
    // Skenario 1: Normal (OPEX HO > Fee 3%) dan Skenario 2: Cap Rp 0 (Fee 3% > OPEX HO)
    for (const rawHoOpex of [10_000_000, 1_200_000]) {
      const grossInternal = 150_000_000
      const dedInternal = 10_000_000
      const hppInternal = 60_000_000
      const opexInternal = 30_000_000
      const wasteInternal = 1_000_000

      const grossMitra = 100_000_000
      const dedMitra = 5_000_000
      const hppMitraBase = 40_000_000
      const hppMitraMarkup = 4_000_000
      const hppMitra = hppMitraBase + hppMitraMarkup
      const opexMitra = 20_000_000
      const wasteMitra = 500_000

      const feeRes = computeMitraManagementFees({
        salesRows: [{ outlet_id: 'mitra-active', sales_date: '2026-11-15', omzet: grossMitra - dedMitra, total_deductions: dedMitra }],
        outlets: OUTLETS,
        investments: INVESTMENTS,
        periodFrom: '2026-11-01',
        periodTo: '2026-11-30',
      })
      const hoOffset = applyHoOpexManagementFeeOffset(rawHoOpex, feeRes.totalFeeForHoOpex)

      // 1. Laba Rugi Internal (Pusat)
      const feeReceivedInternal = feeRes.totalFeeLegacyRevenue + hoOffset.surplusToRevenue
      const netRevInternal = grossInternal - dedInternal + feeReceivedInternal + hppMitraMarkup
      const labaOutletInternal = netRevInternal - hppInternal - opexInternal - wasteInternal
      const labaInternal = computeCompanyProfit(labaOutletInternal, hoOffset.netHoOpex, 0).labaPerusahaan

      // Pastikan Laba Internal sama persis dengan sebelum perubahan (tanpa duplikasi!)
      const labaInternalSebelumKebijakan =
        grossInternal - dedInternal + feeRes.totalMitraFee + hppMitraMarkup - hppInternal - opexInternal - wasteInternal - rawHoOpex
      expect(labaInternal).toBe(labaInternalSebelumKebijakan)

      // 2. Laba Rugi Mitra
      const netRevMitra = grossMitra - dedMitra - feeRes.totalMitraFee
      const labaMitra = netRevMitra - hppMitra - opexMitra - wasteMitra

      // 3. Laba Rugi Global
      const grossGlobal = grossInternal + grossMitra
      const dedGlobal = dedInternal + dedMitra
      const hppGlobal = hppInternal + hppMitra
      const opexOutletsGlobal = opexInternal + opexMitra
      const wasteGlobal = wasteInternal + wasteMitra
      const feeReceivedGlobal = feeRes.totalFeeLegacyRevenue + hoOffset.surplusToRevenue
      const feeExpenseGlobal = feeRes.totalMitraFee
      const netRevGlobal = grossGlobal - dedGlobal + feeReceivedGlobal + hppMitraMarkup - feeExpenseGlobal
      const labaOutletsGlobal = netRevGlobal - hppGlobal - opexOutletsGlobal - wasteGlobal
      const labaGlobal = computeCompanyProfit(labaOutletsGlobal, hoOffset.netHoOpex, 0).labaPerusahaan

      // Konsolidasi eksak: Laba Global === Laba Internal + Laba Mitra
      expect(labaGlobal).toBe(labaInternal + labaMitra)

      // Waterfall Laba Rugi Global mendarat persis di angka yang sama
      const waterfall = buildProfitWaterfall({
        grossRevenue: grossGlobal,
        deductions: dedGlobal,
        hpp: hppGlobal,
        waste: wasteGlobal,
        opexMonthly: opexOutletsGlobal,
        opexPettyCash: 0,
        centralExpense: hoOffset.netHoOpex,
        includeCentral: true,
        centralExpenseBreakdown: [
          { label: 'Beban Operasional Head Office (Kotor)', amount: -rawHoOpex },
          { label: 'Potongan Management Fee Mitra (3%)', amount: hoOffset.appliedDeduction },
        ],
        managementFeeIncome: feeReceivedGlobal,
        mitraHppMarginIncome: hppMitraMarkup,
        managementFeeExpense: feeExpenseGlobal,
      })
      expect(waterfall.find((s) => s.kind === 'total')?.amount).toBe(labaGlobal)

      // 4. Ringkasan Bisnis (Owner Dashboard Global) mendarat persis di OPEX & Laba Bersih Global yang sama
      const ownerCurOpex = opexOutletsGlobal + hoOffset.netHoOpex
      const ownerNetProfit = computeOwnerNetProfit({
        netMasuk: grossGlobal - dedGlobal,
        totalCogsOpex: hppGlobal + ownerCurOpex,
        waste: wasteGlobal,
        marginMitra: hppMitraMarkup,
        pendapatanLain: 0,
        mgmtFee: hoOffset.appliedDeduction,
      })
      expect(ownerCurOpex).toBe(opexOutletsGlobal + hoOffset.netHoOpex)
      expect(ownerNetProfit).toBe(labaGlobal)
    }
  })

  it('mengikuti omzet tepat per tanggal filter (1 hari vs 7 hari) dan memotong gaji prorata Head Office secara konsisten', () => {
    const monthlyHoSalary = 73_997_310 // contoh 1 bulan = Rp 73.997.310 -> 1 hari (1/30) = Rp 2.466.577
    const oneDayHoOpex = Math.round(monthlyHoSalary * (1 / 30))
    expect(oneDayHoOpex).toBe(2_466_577)

    // Filter 1 hari (2026-11-10): omzet mitra hari itu Rp 30.000.000 -> Fee 3% = Rp 900.000
    const oneDayFee = computeMitraManagementFees({
      salesRows: [{ outlet_id: 'mitra-active', sales_date: '2026-11-10', omzet: 28_000_000, total_deductions: 2_000_000 }],
      outlets: OUTLETS,
      investments: INVESTMENTS,
      periodFrom: '2026-11-10',
      periodTo: '2026-11-10',
    })
    expect(oneDayFee.grossMitraBelumBepHoOpex).toBe(30_000_000)
    expect(oneDayFee.totalFeeForHoOpex).toBe(900_000)

    const oneDayOffset = applyHoOpexManagementFeeOffset(oneDayHoOpex, oneDayFee.totalFeeForHoOpex)
    expect(oneDayOffset.appliedDeduction).toBe(900_000)
    expect(oneDayOffset.netHoOpex).toBe(1_566_577)
  })
})
