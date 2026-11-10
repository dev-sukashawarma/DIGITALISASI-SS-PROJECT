import type { SalesSource, SalesSummaryRow } from '@/lib/types'
import { isTestOutlet } from '@/lib/outletFilters'
import { isInScope, mitraOutletIds, type OutletOwnershipInput } from '@/lib/outletOwnership'
import { calculateMitraBepStatus, resolveMitraPolicy } from '@/lib/mitraPolicy'
import { rentangClosingTepat } from '@/lib/closing/terapkanClosingOpex'

export interface PlatformSettlementLite {
  outlet_id: string
  platform: string | null
  tanggal: string
  commission?: number | null
  promo_merchant?: number | null
}

export interface MitraInvestmentPolicyInput {
  outlet_id: string
  nilai_investasi?: number | null
  tanggal_mulai?: string | null
  omzet_historis?: number | null
  transfer_historis?: number | null
  persentase_bagi_hasil?: number | null
  management_fee?: number | null
  isBep?: boolean
  transfers?: { bulan?: string | null; nominal?: number | null }[]
}

export function normalizeSettlementPlatform(src: string | null | undefined): string {
  const s = (src || '').toLowerCase()
  if (s.includes('gofood') || s.includes('gojek')) return 'gofood'
  if (s.includes('grab')) return 'grabfood'
  if (s.includes('shopee')) return 'shopeefood'
  if (s.includes('tiktok')) return 'tiktokgo'
  return s
}

/**
 * Memecah rentang tanggal `YYYY-MM-DD` menjadi potongan berurutan maksimal `maxDays` hari
 * (inklusif, tanpa tumpang tindih dan tanpa tanggal hilang) agar query view agregat
 * `sales_daily_scoped` tidak pernah menyentuh `statement_timeout` PostgreSQL pada rentang 1 bulan.
 */
export function splitDateRangeChunks(
  from: string,
  to: string,
  maxDays = 10,
): { from: string; to: string }[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return [{ from, to }]
  }
  const DAY_MS = 86_400_000
  const startMs = Date.parse(`${from}T00:00:00Z`)
  const endMs = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return [{ from, to }]
  }
  const stepDays = Math.max(1, Math.floor(maxDays))
  const chunks: { from: string; to: string }[] = []
  for (let cur = startMs; cur <= endMs; ) {
    const chunkEnd = Math.min(endMs, cur + (stepDays - 1) * DAY_MS)
    chunks.push({
      from: new Date(cur).toISOString().slice(0, 10),
      to: new Date(chunkEnd).toISOString().slice(0, 10),
    })
    cur = chunkEnd + DAY_MS
  }
  return chunks
}

/**
 * Menyelaraskan potongan promo merchant satu baris harian `sales_daily_scoped` dengan
 * `platform_settlements` & aturan Rangkuman Penjualan (`posReportKpi.ts`):
 * - GoFood, ShopeeFood, GrabFood: memakai `promo_merchant` dari settlement bila tersedia;
 *   fallback ke `total_deductions` kasir bila settlement tanggal tersebut belum diunggah.
 * - TikTok Go: voucher pada POS (`promo_subsidy`) adalah 100% subsidi platform TikTok
 *   (bukan beban merchant), sehingga `total_deductions` memakai `promo_merchant` settlement
 *   bila tersedia atau `0` bila belum ada settlement, sambil menjaga Omzet Kotor tetap utuh.
 */
export function reconcileRowPromoWithSettlement(
  plat: string,
  key: string,
  omzet: number,
  totalDed: number,
  settlementPromoMap: Map<string, number>,
): { omzet: number; total_deductions: number } {
  const safeOmzet = Number(omzet) || 0
  const safeDed = Number(totalDed) || 0

  if (plat === 'tiktokgo') {
    const settlementPromo = settlementPromoMap.has(key) ? (settlementPromoMap.get(key) || 0) : 0
    const rawGross = safeOmzet + safeDed
    return {
      omzet: Math.max(0, rawGross - settlementPromo),
      total_deductions: settlementPromo,
    }
  }

  if (
    settlementPromoMap.has(key) &&
    (plat === 'gofood' || plat === 'shopeefood' || plat === 'grabfood')
  ) {
    const settlementPromo = settlementPromoMap.get(key) || 0
    const rawGross = safeOmzet + safeDed
    return {
      omzet: Math.max(0, rawGross - settlementPromo),
      total_deductions: settlementPromo,
    }
  }

  return {
    omzet: safeOmzet,
    total_deductions: safeDed,
  }
}

/** Normalisasi baris per jam dari RPC (tahan terhadap alias lama `hourly_omzet` maupun baru `omzet`). */
export function normalizeRpcHourlyRow(h: any): { sales_hour: number; omzet: number; order_count: number } {
  return {
    sales_hour: Number(h?.sales_hour ?? 0),
    omzet: Number(h?.omzet ?? h?.hourly_omzet ?? 0) || 0,
    order_count: Number(h?.order_count ?? h?.hourly_order_count ?? 0) || 0,
  }
}

/** Normalisasi baris menu dari RPC (tahan terhadap alias lama `total_qty` maupun baru `qty`). */
export function normalizeRpcMenuRow(r: any): { menu_name: string; qty: number; revenue: number } {
  return {
    menu_name: String(r?.menu_name ?? ''),
    qty: Number(r?.qty ?? r?.total_qty ?? 0) || 0,
    revenue: Number(r?.revenue ?? 0) || 0,
  }
}

/**
 * Rekonsiliasi baris KPI penjualan POS/Food Apps dengan `platform_settlements`,
 * identik 1:1 dengan `useSalesDaily.ts` pada halaman Laba Rugi (`ProfitView`) dan
 * Rangkuman Penjualan (`posReportKpi.ts`):
 * - `platform_fee` diisi dari `commission` settlement resmi.
 * - GoFood, ShopeeFood, GrabFood, dan TikTok Go diselaraskan ke `promo_merchant` settlement
 *   (dengan TikTok Go default 0 untuk subsidi voucher platform) sambil menjaga Omzet Kotor utuh.
 */
export function reconcilePosKpiRowsWithSettlements(
  posRows: SalesSummaryRow[],
  settlements: PlatformSettlementLite[],
): SalesSummaryRow[] {
  const settlementCommissionMap = new Map<string, number>()
  const settlementPromoMap = new Map<string, number>()

  for (const s of settlements) {
    if (!s?.outlet_id || !s?.tanggal) continue
    const plat = normalizeSettlementPlatform(s.platform)
    const key = `${s.outlet_id}__${plat}__${s.tanggal}`
    settlementCommissionMap.set(key, (settlementCommissionMap.get(key) || 0) + (Number(s.commission) || 0))
    if (s.promo_merchant !== null && s.promo_merchant !== undefined) {
      settlementPromoMap.set(
        key,
        (settlementPromoMap.get(key) || 0) + Math.max(0, Number(s.promo_merchant) || 0),
      )
    }
  }

  return posRows
    .filter((r) => !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name))
    .map((r) => {
      const plat = normalizeSettlementPlatform(r.sales_source)
      const key = `${r.outlet_id}__${plat}__${r.sales_date}`
      const platformFee = settlementCommissionMap.get(key) || 0
      const reconciled = reconcileRowPromoWithSettlement(
        plat,
        key,
        Number(r.omzet) || 0,
        Number(r.total_deductions) || 0,
        settlementPromoMap,
      )

      return {
        ...r,
        sales_source: r.sales_source as SalesSource,
        omzet: reconciled.omzet,
        total_deductions: reconciled.total_deductions,
        platform_fee: platformFee,
      }
    })
}

/**
 * Menghitung beban Management Fee Mitra (3% dari Gross Sales untuk outlet belum BEP
 * mulai September 2026) saat halaman Ringkasan Bisnis difilter ke 1 outlet Mitra,
 * identik 1:1 dengan `ProfitView.tsx` (`managementFeeData` & `outletBreakdown.mgmtFee`).
 * Saat `outletId === 'all'`, bernilai 0 karena penerimaan pusat (+3%) dan beban mitra (-3%)
 * saling meniadakan dalam cakupan gabungan.
 */
export function computeSingleMitraManagementFee(params: {
  outletId: string
  periodFrom: string
  periodTo: string
  kpiRows: SalesSummaryRow[]
  outlets: OutletOwnershipInput[]
  investments: Record<string, MitraInvestmentPolicyInput>
}): number {
  const { outletId, periodFrom, periodTo, kpiRows, outlets, investments } = params
  if (!outletId || outletId === 'all' || outletId === 'ss-online' || outletId === 'PUSAT') {
    return 0
  }

  const mitraIds = mitraOutletIds(outlets, investments)
  if (!mitraIds.has(outletId)) {
    return 0
  }

  const abaikanTanggalMulai = rentangClosingTepat(periodFrom, periodTo)
  const cutoffDates = new Map<string, string>()
  if (!abaikanTanggalMulai) {
    for (const [id, inv] of Object.entries(investments)) {
      if (inv?.tanggal_mulai) cutoffDates.set(id, inv.tanggal_mulai)
    }
  }

  const outletSales = kpiRows.filter(
    (r) =>
      r.outlet_id === outletId &&
      !isTestOutlet(r.outlet_id) &&
      isInScope('mitra', outletId, mitraIds, r.sales_date, cutoffDates),
  )

  const gross = outletSales.reduce(
    (sum, r) => sum + (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0),
    0,
  )

  const inv = investments[outletId]
  const bepInfo = calculateMitraBepStatus(inv as any, outletId, periodFrom, inv?.isBep)
  const policy = resolveMitraPolicy({
    periodFrom,
    isBep: bepInfo.isBep,
    legacyProfitSharingPct: inv?.persentase_bagi_hasil ?? undefined,
    legacyManagementFee: inv?.management_fee ?? undefined,
  })

  return policy.managementFeePct > 0 ? Math.round((gross * policy.managementFeePct) / 100) : 0
}

/**
 * Menghitung Laba Bersih (Net) di halaman Ringkasan Bisnis (`KpiCards.tsx`)
 * sehingga identik 1:1 dengan `computeCompanyProfit` di halaman Laba Rugi Global
 * maupun Laba Bersih 1 outlet (Internal / Mitra).
 */
export function computeOwnerNetProfit(params: {
  netMasuk: number
  totalCogsOpex: number
  waste?: number
  marginMitra?: number
  pendapatanLain?: number
  mgmtFee?: number
}): number {
  const {
    netMasuk,
    totalCogsOpex,
    waste = 0,
    marginMitra = 0,
    pendapatanLain = 0,
    mgmtFee = 0,
  } = params
  return netMasuk - totalCogsOpex - waste + marginMitra + pendapatanLain - mgmtFee
}
