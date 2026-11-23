import {
  getLabaRugiSalesDailyAction,
  getExpensesAction,
  getLabaRugiHppAction,
  getLabaRugiWasteAction,
  getLabaRugiPendapatanLainAction,
  getAllPlatformSettlementSummaries,
  getHRPayrollSummaryAction,
  getMitraInvestmentsAction,
  getProrataAuxiliaryDataAction,
} from '@/app/actions/labaRugi'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/laba-rugi/outletFilters'
import { mapExpenseRow } from '@/lib/laba-rugi/expenseRow'
import { buatSaringanKasKecil } from '@/lib/laba-rugi/kasKecilTeraudit'
import { calculateProratedExpenses, getJakartaCurrentMonthInfo } from '@/lib/laba-rugi/opexProrata'
import { susunBarisGajiKantor, gabungGajiKantor } from '@/lib/laba-rugi/gajiKantorPusat'
import { barisPayrollDariHr, gantiPayrollDenganHr } from '@/lib/laba-rugi/opexDariHr'
import { terapkanClosingOpex } from '@/lib/laba-rugi/closing/terapkanClosingOpex'
import { computeCompanyProfit } from '@/lib/laba-rugi/profit'
import { applyHoOpexManagementFeeOffset, computeMitraManagementFees } from '@/lib/laba-rugi/managementFee'
import { isInScope, mitraOutletIds, type ProfitScope } from '@/lib/laba-rugi/outletOwnership'
import type { ExpenseRow } from '@/components/laba-rugi/hooks'
import type { OutletExportItem, ConsolidatedSummaryData } from './profitExportService'

export interface ProfitExportDataResult {
  outletBreakdown: OutletExportItem[]
  summaryData: ConsolidatedSummaryData
  salesRows: any[]
  expenseRows: ExpenseRow[]
  tiktokSettlements: Record<string, any>
  platformSettlements?: Record<string, any>
}

/**
 * Mengambil data finansial laba rugi lengkap untuk periode bebas di latar belakang
 * tanpa mengubah filter tampilan dashboard aktif.
 */
export async function fetchProfitExportData({
  from,
  to,
  scope,
  outlets,
  mitraInvestments,
  onProgress,
}: {
  from: string
  to: string
  scope: ProfitScope
  outlets: { id: string; name: string; type?: string; is_active?: boolean }[]
  mitraInvestments: Record<string, any>
  onProgress?: (message: string) => void
}): Promise<ProfitExportDataResult> {
  onProgress?.('Mengambil data omzet penjualan...')
  const allSalesRows = await getLabaRugiSalesDailyAction({
    from,
    to,
    outletId: 'all',
    source: 'all',
  })
  const salesRows = scope === 'mitra'
    ? allSalesRows.filter((r: any) => r.outlet_id !== 'ss-online')
    : allSalesRows

  // 2. Ambil Pengeluaran (expenses & petty cash)
  onProgress?.('Mengambil data beban operasional...')
  const expRes = await getExpensesAction({
    from,
    to,
    outletId: 'all',
    source: 'all',
  })
  if (expRes && 'success' in expRes && !expRes.success) {
    throw new Error(expRes.error || 'Gagal memuat data pengeluaran dari server')
  }

  const rawExpenses = expRes.expenses ?? []
  const rawPettyCash = expRes.pettyCashExpenses ?? []

  const monthlyRows = (rawExpenses ?? [])
    .filter((row: any) => !row.outlet_id || (!isTestOutlet(row.outlet_id) && !isTestOutlet(row.outlets?.name)))
    .map(mapExpenseRow)

  const pettyCashRows = (rawPettyCash ?? [])
    .filter((row: any) => !isTestOutlet(row.outlet_id) && !isTestOutlet(row.outlets?.name))
    .map((row: any) => {
      let cat = row.category
      if (cat === 'bb') cat = 'bahan_baku'
      else if (cat === 'outlet' || cat === 'operasional') cat = 'pengeluaran_outlet'
      else if (cat === 'utilities') cat = 'utilitas'

      return {
        id: row.id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : null),
        category: cat,
        scope: 'outlet' as const,
        amount: Number(row.amount) || 0,
        description: row.description ?? '',
        expense_date: row.expense_date,
        period_month: (row.expense_date || '').slice(0, 7) + '-01',
        receipt_url: row.receipt_url,
        source: 'petty_cash' as const,
        type: 'expense',
        recipient_name: null,
        division: null,
        raw_description: row.description,
        raw_category: row.category,
      } as ExpenseRow
    })

  const filteredPettyCashRows = pettyCashRows.filter(buatSaringanKasKecil(monthlyRows))
  const combinedRawExpenses = [...monthlyRows, ...filteredPettyCashRows] as ExpenseRow[]

  onProgress?.('Menghitung prorata beban tetap, gaji HR & bonus crew...')
  let auxData: any = {
    payrollRecords: [],
    staffFinancials: [],
    crewBonusRecords: [],
    lastMonthExpenses: [],
  }
  try {
    auxData = await getProrataAuxiliaryDataAction({ from, to })
  } catch (err) {
    console.warn('Gagal memuat prorata auxiliary data di profitExportFetcher:', err)
  }

  const prorataResult = calculateProratedExpenses({
    filter: { from, to, outletId: 'all', source: 'all' },
    rawExpenses: combinedRawExpenses,
    payrollRecords: auxData.payrollRecords,
    staffFinancials: auxData.staffFinancials,
    crewBonusRecords: auxData.crewBonusRecords,
    lastMonthExpenses: auxData.lastMonthExpenses,
    outlets,
    managerAssignments: auxData.managerAssignments,
    operationalOutletIds: auxData.operationalOutletIds,
  })
  // Gaji staf kantor pusat (HR) sebagai biaya pusat — sama dengan layar Laba Rugi.
  // Baris pusat disaring per scope di bawah (tidak ikut di scope mitra).
  // Gaji & bonus outlet dari ringkasan payroll HR (sumber Buku Kas) — sama dengan layar.
  let hrRingkasan: Awaited<ReturnType<typeof getHRPayrollSummaryAction>> | null = null
  try {
    hrRingkasan = await getHRPayrollSummaryAction({ from, to, outletId: 'ALL_OUTLETS' })
  } catch (err) {
    console.warn('Gagal memuat ringkasan payroll HR di profitExportFetcher:', err)
  }
  const barisEngineDanHr = gantiPayrollDenganHr(prorataResult.rows, barisPayrollDariHr({ hr: hrRingkasan, from, to }))
  const expenseRowsData = gabungGajiKantor(barisEngineDanHr, susunBarisGajiKantor({
    from,
    to,
    officePayrollRecords: auxData.officePayrollRecords || [],
    officeStaffMonthlyTotal: auxData.officeStaffMonthlyTotal || 0,
    currentMonthFirstDay: getJakartaCurrentMonthInfo().firstDay,
  }))
  // Closing OPEX September 2026 — sama dengan layar Laba Rugi.
  const expenseRows = terapkanClosingOpex(expenseRowsData, { from, to, outletId: 'all' }).rows

  // 3. Ambil HPP
  onProgress?.('Mengambil data HPP bahan baku...')
  const hppRows = await getLabaRugiHppAction({
    from,
    to,
    outletId: 'all',
    source: 'all',
  })

  // 4. Ambil Waste (bahan rusak)
  onProgress?.('Mengambil data bahan rusak (waste)...')
  const wasteRows = await getLabaRugiWasteAction({ from, to, outletId: 'all', source: 'all' })

  // 5. Ambil Rekonsiliasi Settlement Platform (GoFood, ShopeeFood, TikTok Go)
  onProgress?.('Mengambil data rekonsiliasi settlement platform...')
  const settlementRes = await getAllPlatformSettlementSummaries(from, to)
  const tiktokSettlements = settlementRes.success && settlementRes.data ? settlementRes.data.tiktokSummaries : {}
  const platformSettlements = settlementRes.success && settlementRes.data ? settlementRes.data.byOutletPlatform : {}

  // Baris penjualan sudah direkonsiliasi per (outlet_id, platform, tanggal) di atas (1:1 dengan useSalesDaily.ts)
  const reconciledSalesRows = salesRows

  // 6. Evaluasi Scope & Kemitraan
  onProgress?.('Menganalisis & menghitung angka laba rugi...')
  let activeInvestments = mitraInvestments
  if (!activeInvestments || Object.keys(activeInvestments).length === 0) {
    try {
      activeInvestments = await getMitraInvestmentsAction()
    } catch (e) {
      console.warn('Gagal memuat fallback mitraInvestments di profitExportFetcher:', e)
    }
  }

  const cleanOutlets = outlets.filter(o => !isTestOutlet(o))
  const allOutlets = cleanOutlets.some(o => o.id === 'ss-online')
    ? cleanOutlets
    : [{ id: 'ss-online', name: 'SS ONLINE', type: 'online' } as any, ...cleanOutlets]
  const mitraIds = mitraOutletIds(allOutlets, activeInvestments)
  const cutoffDates = new Map<string, string>()
  for (const [id, inv] of Object.entries(activeInvestments)) {
    if (inv?.tanggal_mulai) {
      cutoffDates.set(id, inv.tanggal_mulai)
    }
  }

  const inScope = (outletId: string | null | undefined, dateStr?: string | null) => {
    const targetDate = dateStr ?? to ?? from
    return isInScope(scope, outletId, mitraIds, targetDate, cutoffDates)
  }

  const scopedSalesRows = reconciledSalesRows.filter((r: any) => inScope(r.outlet_id, r.sales_date))
  const scopedHppRows = hppRows.filter((r: any) => inScope(r.outlet_id, (r as any).date || (r as any).order_date))
  const scopedWasteRows = wasteRows.filter((r: any) => inScope(r.outlet_id, (r as any).date || (r as any).created_at))
  const scopedExpenseRows = expenseRows.filter((r: ExpenseRow) =>
    r.scope === 'pusat' ? scope !== 'mitra' : inScope(r.outlet_id, r.expense_date || (r as any).date),
  )

  // Perhitungan Management Fee Kemitraan
  const managementFeeData = computeMitraManagementFees({
    salesRows: reconciledSalesRows,
    outlets: allOutlets,
    investments: activeInvestments as Record<string, any>,
    periodFrom: from,
    periodTo: to,
  })

  const perOutletFee = managementFeeData.perOutletFee

  // Margin Pasokan Bahan Baku Mitra
  const mitraHppTotals = hppRows
    .filter((r: any) => mitraIds.has(r.outlet_id) && !isTestOutlet(r.outlet_id))
    .reduce(
      (acc: { hpp: number; base: number; markup: number }, r: any) => ({
        hpp: acc.hpp + (Number(r.hpp) || 0),
        base: acc.base + (Number(r.baseHpp) || 0),
        markup: acc.markup + (Number(r.markup) || 0),
      }),
      { hpp: 0, base: 0, markup: 0 },
    )

  // managementFeeReceived dihitung setelah hoFeeOffset di bawah
  const managementFeeExpense = (scope === 'mitra' || scope === 'all') ? managementFeeData.totalMitraFee : 0
  const mitraHppMarginReceived = (scope === 'all' || scope === 'internal') ? mitraHppTotals.markup : 0

  const actualGrossSales = scopedSalesRows.reduce((sum: number, r: any) => sum + (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0), 0)
  const totalDeductions = scopedSalesRows.reduce((sum: number, r: any) => sum + (Number(r.total_deductions) || 0) + (Number(r.platform_fee) || 0), 0)

  const pengeluaranOutlet = scopedExpenseRows.filter((r: ExpenseRow) => r.scope === 'outlet').reduce((sum: number, r: ExpenseRow) => sum + r.amount, 0)
  const totalJointExpense = scopedExpenseRows
    .filter((r: ExpenseRow) => r.scope === 'outlet' && !isTestOutlet(r.outlet_id) && ((r as any).category === 'joint_expense' || (r as any).category === 'joint_expanse'))
    .reduce((sum: number, r: ExpenseRow) => sum + r.amount, 0)
  const pengeluaranPusatRaw = scopedExpenseRows.filter((r: ExpenseRow) => r.scope === 'pusat').reduce((sum: number, r: ExpenseRow) => sum + r.amount, 0)
  const hoFeeOffset = applyHoOpexManagementFeeOffset(
    scope !== 'mitra' ? pengeluaranPusatRaw : 0,
    scope !== 'mitra' ? managementFeeData.totalFeeForHoOpex : 0,
  )
  const pengeluaranPusat = scope !== 'mitra' ? hoFeeOffset.netHoOpex : pengeluaranPusatRaw
  const managementFeeReceived = (scope === 'all' || scope === 'internal')
    ? managementFeeData.totalFeeLegacyRevenue + hoFeeOffset.surplusToRevenue
    : 0
  const totalHpp = scopedHppRows.reduce((sum: number, r: any) => sum + r.hpp, 0)
  const totalWaste = scopedWasteRows.reduce((sum: number, r: any) => sum + r.nilai_waste, 0)

  const netRevenue = actualGrossSales - totalDeductions + managementFeeReceived + mitraHppMarginReceived - managementFeeExpense
  const labaKotor = netRevenue - totalHpp
  const marginKotor = actualGrossSales > 0 ? (labaKotor / actualGrossSales) * 100 : 0
  const labaBersih = labaKotor - pengeluaranOutlet - totalWaste
  // Income Lainnya Kas Office: pendapatan pusat, tidak ikut scope mitra.
  const pendapatanLain = scope !== 'mitra' ? await getLabaRugiPendapatanLainAction({ from, to }) : 0
  const labaPerusahaan = computeCompanyProfit(labaBersih, pengeluaranPusat, pendapatanLain).labaPerusahaan
  const displayLaba = labaPerusahaan
  const costBase = actualGrossSales > 0 ? actualGrossSales : (netRevenue > 0 ? netRevenue : 0)
  const displayMargin = costBase > 0 ? (displayLaba / costBase) * 100 : 0
  const adaAntarKantong = managementFeeReceived > 0 || mitraHppMarginReceived > 0 || managementFeeExpense > 0
  const includeCentral = scope !== 'mitra'

  const summaryData: ConsolidatedSummaryData = {
    actualGrossSales,
    totalDeductions,
    netRevenue,
    totalHpp,
    labaKotor,
    marginKotor,
    pengeluaranOutlet,
    totalWaste,
    pengeluaranPusat,
    pengeluaranPusatRaw,
    potonganFeeManajemenPusat: hoFeeOffset.appliedDeduction,
    pendapatanLain,
    managementFeeReceived,
    mitraHppMarginReceived,
    managementFeeExpense,
    displayLaba,
    displayMargin,
    adaAntarKantong,
    includeCentral,
    totalJointExpense,
  }

  // Bangun breakdown outlet
  const map = new Map<string, { name: string; omzet: number; deductions: number; expense: number; hpp: number; waste: number; cogsChannels?: any }>()
  allOutlets.filter(o => !isTestOutlet(o) && inScope(o.id)).forEach(o => {
    map.set(o.id, { name: o.name, omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 })
  })

  scopedSalesRows.forEach((s: any) => {
    const cur = map.get(s.outlet_id) ?? {
      name: s.outlet_name || (s.outlet_id === 'ss-online' ? 'SS ONLINE' : 'Outlet Tidak Dikenal'),
      omzet: 0,
      deductions: 0,
      expense: 0,
      hpp: 0,
      waste: 0,
    }
    cur.omzet += (Number(s.omzet) || 0) + (Number(s.total_deductions) || 0)
    cur.deductions += (Number(s.total_deductions) || 0) + (Number(s.platform_fee) || 0)
    map.set(s.outlet_id, cur)
  })

  scopedExpenseRows.forEach((e: ExpenseRow) => {
    if (e.scope !== 'outlet' || !e.outlet_id) return
    const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
    cur.expense += e.amount
    map.set(e.outlet_id, cur)
  })

  scopedHppRows.forEach((h: any) => {
    const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
    cur.hpp += h.hpp
    if (h.channels) {
      const curChannels = cur.cogsChannels ?? { outlet: 0, food_apps: 0, tiktok_go: 0, website: 0 }
      curChannels.outlet += h.channels.outlet || 0
      curChannels.food_apps += h.channels.food_apps || 0
      curChannels.tiktok_go += h.channels.tiktok_go || 0
      curChannels.website += h.channels.website || 0
      cur.cogsChannels = curChannels
    }
    map.set(h.outlet_id, cur)
  })

  scopedWasteRows.forEach((w: any) => {
    const cur = map.get(w.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
    cur.waste += w.nilai_waste
    map.set(w.outlet_id, cur)
  })

  const outletBreakdown: OutletExportItem[] = [...map.entries()]
    .map(([id, val]) => {
      const grossRev = val.omzet
      const netRev = val.omzet - val.deductions
      const labaKotorOutlet = grossRev - val.hpp - val.deductions
      const feeInfo = perOutletFee.get(id)
      const isOutletMitraScope = scope === 'internal'
        ? false
        : (scope === 'mitra' ? true : mitraIds.has(id))
      const mgmtFee = isOutletMitraScope ? (feeInfo?.fee ?? 0) : 0
      const mgmtFeePct = isOutletMitraScope ? (feeInfo?.pct ?? 0) : 0
      const isBep = Boolean(feeInfo?.isBep)
      const net = labaKotorOutlet - val.expense - val.waste - mgmtFee
      const margin = grossRev > 0 ? (net / grossRev) * 100 : 0
      const totalCost = val.deductions + val.hpp + val.waste + val.expense + mgmtFee
      return {
        id,
        name: val.name,
        omzet: grossRev,
        deductions: val.deductions,
        netRev,
        expense: val.expense,
        hpp: val.hpp,
        cogsChannels: val.cogsChannels,
        waste: val.waste,
        mgmtFee,
        mgmtFeePct,
        isBep,
        isMitra: isOutletMitraScope,
        labaKotor: labaKotorOutlet,
        net,
        margin,
        totalCost,
      }
    })
    .filter(item => item.omzet > 0 || item.expense > 0 || item.hpp > 0 || item.waste > 0)
    .sort((a, b) => b.net - a.net)

  return {
    outletBreakdown,
    summaryData,
    salesRows: scopedSalesRows,
    expenseRows: scopedExpenseRows,
    tiktokSettlements,
    platformSettlements,
  }
}
