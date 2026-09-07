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
  /** Penjelasan singkat, ditampilkan di bawah label. */
  hint?: string
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
}

export function buildProfitWaterfall(input: WaterfallInput): WaterfallStep[] {
  const {
    grossRevenue, deductions, hpp, waste,
    opexMonthly, opexPettyCash, centralExpense, includeCentral,
  } = input

  const pct = (n: number) => (grossRevenue > 0 ? (n / grossRevenue) * 100 : 0)

  const netRevenue = grossRevenue - deductions
  const labaKotor = netRevenue - hpp
  const opex = opexMonthly + opexPettyCash + (includeCentral ? centralExpense : 0)
  const labaBersih = labaKotor - waste - opex

  const steps: WaterfallStep[] = [
    {
      key: 'omzet_kotor',
      label: 'Omzet Kotor Penjualan',
      hint: 'Nilai penjualan sebelum potongan apa pun',
      amount: grossRevenue,
      kind: 'base',
      pctOfGross: grossRevenue > 0 ? 100 : 0,
    },
    {
      key: 'potongan',
      label: 'Potongan Merchant & Platform',
      hint: 'Komisi ojek online, diskon merchant, biaya platform',
      amount: -deductions,
      kind: 'deduction',
      pctOfGross: pct(-deductions),
    },
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
    },
    {
      key: 'opex_petty_cash',
      label: 'Kas Kecil Operasional',
      hint: 'Pengeluaran harian outlet lewat petty cash',
      amount: -opexPettyCash,
      kind: 'deduction',
      pctOfGross: pct(-opexPettyCash),
    },
  ]

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
