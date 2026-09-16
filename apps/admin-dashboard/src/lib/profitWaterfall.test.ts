import { describe, expect, it } from 'vitest'
import { buildProfitWaterfall } from './profitWaterfall'
import { computeProfit, computeCompanyProfit } from './profit'

const INPUT = {
  grossRevenue: 100_000_000,
  deductions: 8_000_000,
  hpp: 40_000_000,
  waste: 2_000_000,
  opexMonthly: 25_000_000,
  opexPettyCash: 5_000_000,
  centralExpense: 7_000_000,
  includeCentral: true,
}

describe('buildProfitWaterfall', () => {
  it('mendarat persis di laba bersih versi computeProfit + computeCompanyProfit', () => {
    const { labaBersih } = computeProfit(
      INPUT.grossRevenue,
      INPUT.deductions,
      INPUT.hpp,
      INPUT.opexMonthly + INPUT.opexPettyCash,
      INPUT.waste,
    )
    const { labaPerusahaan } = computeCompanyProfit(labaBersih, INPUT.centralExpense)

    const steps = buildProfitWaterfall(INPUT)
    const total = steps.find((s) => s.kind === 'total')
    expect(total?.amount).toBe(labaPerusahaan)
  })

  it('setiap subtotal sama dengan jumlah berjalan baris di atasnya', () => {
    const steps = buildProfitWaterfall(INPUT)
    let running = 0
    for (const step of steps) {
      if (step.kind === 'subtotal' || step.kind === 'total') {
        expect(step.amount).toBe(running)
      } else {
        running += step.amount
      }
    }
  })

  it('mengikuti definisi resmi: waste TIDAK mengurangi laba kotor', () => {
    const steps = buildProfitWaterfall(INPUT)
    const labaKotor = steps.find((s) => s.key === 'laba_kotor')
    const { labaKotor: expected } = computeProfit(
      INPUT.grossRevenue,
      INPUT.deductions,
      INPUT.hpp,
      0,
      INPUT.waste,
    )
    expect(labaKotor?.amount).toBe(expected)
  })

  it('menghilangkan baris biaya pusat saat tidak ikut dihitung', () => {
    const steps = buildProfitWaterfall({ ...INPUT, includeCentral: false })
    expect(steps.some((s) => s.key === 'biaya_pusat')).toBe(false)

    const { labaBersih } = computeProfit(
      INPUT.grossRevenue,
      INPUT.deductions,
      INPUT.hpp,
      INPUT.opexMonthly + INPUT.opexPettyCash,
      INPUT.waste,
    )
    expect(steps.find((s) => s.kind === 'total')?.amount).toBe(labaBersih)
  })

  it('pengurangan bertanda negatif, omzet dasar positif', () => {
    const steps = buildProfitWaterfall(INPUT)
    expect(steps.find((s) => s.key === 'omzet_kotor')?.amount).toBe(100_000_000)
    expect(steps.find((s) => s.key === 'potongan')?.amount).toBe(-8_000_000)
    expect(steps.find((s) => s.key === 'waste')?.amount).toBe(-2_000_000)
  })

  it('menghitung porsi tiap baris terhadap omzet kotor', () => {
    const steps = buildProfitWaterfall(INPUT)
    expect(steps.find((s) => s.key === 'omzet_kotor')?.pctOfGross).toBe(100)
    expect(steps.find((s) => s.key === 'hpp')?.pctOfGross).toBe(-40)
  })

  it('tidak membagi nol saat belum ada penjualan', () => {
    const steps = buildProfitWaterfall({
      grossRevenue: 0,
      deductions: 0,
      hpp: 0,
      waste: 0,
      opexMonthly: 1_000_000,
      opexPettyCash: 0,
      centralExpense: 0,
      includeCentral: false,
    })
    for (const step of steps) expect(Number.isFinite(step.pctOfGross)).toBe(true)
    expect(steps.find((s) => s.kind === 'total')?.amount).toBe(-1_000_000)
  })

  it('tetap utuh saat rugi (angka negatif)', () => {
    const steps = buildProfitWaterfall({ ...INPUT, grossRevenue: 10_000_000, includeCentral: true })
    const total = steps.find((s) => s.kind === 'total')
    expect(total?.amount).toBeLessThan(0)
  })
})

describe('rincian Beban Bulanan Outlet', () => {
  const RINCIAN = [
    { label: 'Gaji Crew Outlet', amount: -18_000_000 },
    { label: 'Biaya Sewa Outlet', amount: -5_000_000 },
    { label: 'PLN', amount: -2_000_000 },
  ]

  it('menempel pada baris beban bulanan, bukan baris lain', () => {
    const steps = buildProfitWaterfall({ ...INPUT, opexMonthly: 25_000_000, opexMonthlyBreakdown: RINCIAN })
    expect(steps.find((s) => s.key === 'opex_bulanan')?.breakdown).toEqual(RINCIAN)
    for (const s of steps.filter((s) => s.key !== 'opex_bulanan')) {
      expect(s.breakdown).toBeUndefined()
    }
  })

  it('jumlah rinciannya sama dengan baris induknya', () => {
    const steps = buildProfitWaterfall({ ...INPUT, opexMonthly: 25_000_000, opexMonthlyBreakdown: RINCIAN })
    const induk = steps.find((s) => s.key === 'opex_bulanan')!
    const jumlah = induk.breakdown!.reduce((s, r) => s + r.amount, 0)
    expect(jumlah).toBe(induk.amount)
  })

  it('tidak mengubah laba bersih sama sekali', () => {
    const tanpa = buildProfitWaterfall(INPUT)
    const dengan = buildProfitWaterfall({ ...INPUT, opexMonthlyBreakdown: RINCIAN })
    expect(dengan.find((s) => s.kind === 'total')?.amount).toBe(
      tanpa.find((s) => s.kind === 'total')?.amount,
    )
  })

  it('tak ada rincian saat daftarnya kosong atau tak diberikan', () => {
    expect(buildProfitWaterfall(INPUT).find((s) => s.key === 'opex_bulanan')?.breakdown).toBeUndefined()
    expect(
      buildProfitWaterfall({ ...INPUT, opexMonthlyBreakdown: [] }).find((s) => s.key === 'opex_bulanan')
        ?.breakdown,
    ).toBeUndefined()
  })
})

describe('management fee di waterfall', () => {
  it('menambahkan fee_manajemen_mitra dan menaikkan laba bersih saat ada managementFeeIncome', () => {
    const feeIncome = 3_000_000
    const steps = buildProfitWaterfall({ ...INPUT, managementFeeIncome: feeIncome })
    
    const feeStep = steps.find((s) => s.key === 'fee_manajemen_mitra')
    expect(feeStep).toBeDefined()
    expect(feeStep?.amount).toBe(feeIncome)

    const baseTotal = buildProfitWaterfall(INPUT).find((s) => s.kind === 'total')!.amount
    const withFeeTotal = steps.find((s) => s.kind === 'total')!.amount
    expect(withFeeTotal).toBe(baseTotal + feeIncome)

    // Running sum check
    let running = 0
    for (const step of steps) {
      if (step.kind === 'subtotal' || step.kind === 'total') {
        expect(step.amount).toBe(running)
      } else {
        running += step.amount
      }
    }
  })

  it('mengurangi fee_manajemen_pusat dan memotong laba bersih saat ada managementFeeExpense', () => {
    const feeExpense = 2_500_000
    const steps = buildProfitWaterfall({ ...INPUT, managementFeeExpense: feeExpense, includeCentral: false })
    
    const feeStep = steps.find((s) => s.key === 'fee_manajemen_pusat')
    expect(feeStep).toBeDefined()
    expect(feeStep?.amount).toBe(-feeExpense)

    const baseTotal = buildProfitWaterfall({ ...INPUT, includeCentral: false }).find((s) => s.kind === 'total')!.amount
    const withFeeTotal = steps.find((s) => s.kind === 'total')!.amount
    expect(withFeeTotal).toBe(baseTotal - feeExpense)

    // Running sum check
    let running = 0
    for (const step of steps) {
      if (step.kind === 'subtotal' || step.kind === 'total') {
        expect(step.amount).toBe(running)
      } else {
        running += step.amount
      }
    }
  })
})

describe('rincian channel omzet kotor dan potongan merchant', () => {
  const OMZET_CHANNELS = [
    { label: 'Kasir Offline (POS)', amount: 60_000_000 },
    { label: 'ShopeeFood', amount: 25_000_000 },
    { label: 'GoFood', amount: 15_000_000 },
  ]
  const POTONGAN_CHANNELS = [
    { label: 'ShopeeFood', amount: -5_000_000 },
    { label: 'GoFood', amount: -3_000_000 },
  ]

  it('menempelkan rincian channel pada omzet_kotor dan potongan saat diberikan', () => {
    const steps = buildProfitWaterfall({
      ...INPUT,
      grossRevenueBreakdown: OMZET_CHANNELS,
      deductionsBreakdown: POTONGAN_CHANNELS,
    })

    const omzetStep = steps.find((s) => s.key === 'omzet_kotor')
    expect(omzetStep?.breakdown).toEqual(OMZET_CHANNELS)
    expect(omzetStep?.breakdown?.reduce((s, r) => s + r.amount, 0)).toBe(INPUT.grossRevenue)

    const potonganStep = steps.find((s) => s.key === 'potongan')
    expect(potonganStep?.breakdown).toEqual(POTONGAN_CHANNELS)
    expect(potonganStep?.breakdown?.reduce((s, r) => s + r.amount, 0)).toBe(-INPUT.deductions)
  })

  it('tidak ada breakdown jika tidak disediakan atau array kosong', () => {
    const steps = buildProfitWaterfall({
      ...INPUT,
      grossRevenueBreakdown: [],
      deductionsBreakdown: [],
    })

    expect(steps.find((s) => s.key === 'omzet_kotor')?.breakdown).toBeUndefined()
    expect(steps.find((s) => s.key === 'potongan')?.breakdown).toBeUndefined()
  })
})
