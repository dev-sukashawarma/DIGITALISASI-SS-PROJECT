/**
 * Rincian pembentuk Laba Bersih, langkah demi langkah.
 *
 * Urutannya mengikuti `computeProfit`/`computeCompanyProfit` PERSIS — termasuk
 * kenyataan bahwa waste TIDAK mengurangi laba kotor melainkan dipotong di
 * tahap laba bersih. Kalau rumus di profit.ts berubah, test di sini merah
 * lebih dulu ketimbang rincian dan angka besarnya diam-diam berbeda.
 */

export type WaterfallKind = 'base' | 'deduction' | 'subtotal' | 'total'

export interface WaterfallStep {
  key: string
  label: string
  /** Bertanda: pengurangan negatif, omzet dasar positif. Subtotal = nilai berjalan. */
  amount: number
  kind: WaterfallKind
  /** Porsi terhadap omzet kotor, dalam persen. 0 bila belum ada penjualan. */
  pctOfGross: number
  /** Label kustom untuk persentase jika basisnya bukan omzet kotor saat ini (misal 3% Gross Mitra). */
  pctLabel?: string
  /** Penjelasan singkat, ditampilkan di bawah label. */
  hint?: string
  /**
   * Rincian pembentuk baris ini, bila ada. Murni informatif — jumlahnya wajib
   * sama dengan `amount` dan tidak pernah ikut dihitung ulang ke dalam rantai.
   */
  breakdown?: WaterfallDetail[]
}

export interface WaterfallDetail {
  label: string
  /** Bertanda sama dengan baris induknya (pengurangan = negatif). */
  amount: number
}

export interface WaterfallInput {
  grossRevenue: number
  deductions: number
  hpp: number
  waste: number
  opexMonthly: number
  opexPettyCash: number
  centralExpense: number
  /** Biaya kantor pusat hanya ikut pada tampilan gabungan seluruh outlet. */
  includeCentral: boolean
  /** Rincian per kategori untuk baris beban bulanan outlet. */
  opexMonthlyBreakdown?: WaterfallDetail[]
  /** Pendapatan management fee dari mitra (khusus scope internal). */
  managementFeeIncome?: number
  /** Potongan management fee pusat (khusus scope mitra). */
  managementFeeExpense?: number
  /** Rincian omzet kotor per channel penjualan. */
  grossRevenueBreakdown?: WaterfallDetail[]
  /** Rincian potongan merchant per channel penjualan. */
  deductionsBreakdown?: WaterfallDetail[]
}

export function buildProfitWaterfall(input: WaterfallInput): WaterfallStep[] {
  const {
    grossRevenue, deductions, hpp, waste,
    opexMonthly, opexPettyCash, centralExpense, includeCentral,
    opexMonthlyBreakdown,
    managementFeeIncome = 0,
    managementFeeExpense = 0,
    grossRevenueBreakdown,
    deductionsBreakdown,
  } = input

  const pct = (n: number) => (grossRevenue > 0 ? (n / grossRevenue) * 100 : 0)

  const netRevenue = grossRevenue - deductions + managementFeeIncome
  const labaKotor = netRevenue - hpp
  const opex = opexMonthly + opexPettyCash + (includeCentral ? centralExpense : 0)
  const labaBersih = labaKotor - waste - opex - managementFeeExpense

  const steps: WaterfallStep[] = [
    {
      key: 'omzet_kotor',
      label: 'Omzet Kotor Penjualan',
      hint: 'Nilai penjualan sebelum potongan apa pun',
      amount: grossRevenue,
      kind: 'base',
      pctOfGross: grossRevenue > 0 ? 100 : 0,
      breakdown: grossRevenueBreakdown?.length ? grossRevenueBreakdown : undefined,
    },
    {
      key: 'potongan',
      label: 'Potongan / Diskon Merchant',
      hint: 'Diskon langsung toko & biaya platform',
      amount: -deductions,
      kind: 'deduction',
      pctOfGross: pct(-deductions),
      breakdown: deductionsBreakdown?.length ? deductionsBreakdown : undefined,
    },
    ...(managementFeeIncome > 0 ? [{
      key: 'fee_manajemen_mitra',
      label: 'Pendapatan Management Fee Mitra (3%)',
      hint: `Fee pengelolaan 3% dari omzet kotor kemitraan (setara ${pct(managementFeeIncome).toFixed(1)}% terhadap omzet internal)`,
      amount: managementFeeIncome,
      kind: 'base' as const,
      pctOfGross: pct(managementFeeIncome),
      pctLabel: '3% Gross Mitra',
    }] : []),
    {
      key: 'pendapatan_bersih',
      label: 'Pendapatan Bersih',
      amount: netRevenue,
      kind: 'subtotal',
      pctOfGross: pct(netRevenue),
    },
    {
      key: 'hpp',
      label: 'Beban Pokok (HPP Resep)',
      hint: 'Modal bahan baku menurut resep menu yang terjual',
      amount: -hpp,
      kind: 'deduction',
      pctOfGross: pct(-hpp),
    },
    {
      key: 'laba_kotor',
      label: 'Laba Kotor',
      amount: labaKotor,
      kind: 'subtotal',
      pctOfGross: pct(labaKotor),
    },
    {
      key: 'waste',
      label: 'Kerugian Waste',
      hint: 'Bahan rusak/basi — di luar HPP resep, memotong laba bersih',
      amount: -waste,
      kind: 'deduction',
      pctOfGross: pct(-waste),
    },
    {
      key: 'opex_bulanan',
      label: 'Beban Bulanan Outlet',
      hint: 'Gaji, listrik, air, internet, sewa',
      amount: -opexMonthly,
      kind: 'deduction',
      pctOfGross: pct(-opexMonthly),
      breakdown: opexMonthlyBreakdown?.length ? opexMonthlyBreakdown : undefined,
    },
    {
      key: 'opex_petty_cash',
      label: 'Pengeluaran Petty Cash',
      hint: 'Pengeluaran harian outlet lewat petty cash',
      amount: -opexPettyCash,
      kind: 'deduction',
      pctOfGross: pct(-opexPettyCash),
    },
  ]

  if (managementFeeExpense > 0) {
    steps.push({
      key: 'fee_manajemen_pusat',
      label: 'Management Fee Pusat (3%)',
      hint: 'Fee 3% dari omzet kotor disetor ke kantor pusat',
      amount: -managementFeeExpense,
      kind: 'deduction',
      pctOfGross: pct(-managementFeeExpense),
    })
  }

  if (includeCentral) {
    steps.push({
      key: 'biaya_pusat',
      label: 'Beban Kantor Pusat',
      hint: 'Biaya manajemen, tidak dibebankan ke satu outlet',
      amount: -centralExpense,
      kind: 'deduction',
      pctOfGross: pct(-centralExpense),
    })
  }

  steps.push({
    key: 'laba_bersih',
    label: 'Laba Bersih',
    amount: labaBersih,
    kind: 'total',
    pctOfGross: pct(labaBersih),
  })

  return steps
}
