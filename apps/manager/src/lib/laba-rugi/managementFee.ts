import { isTestOutlet } from './outletFilters'
import { isInScope, mitraOutletIds, type OutletOwnershipInput } from './outletOwnership'
import { calculateMitraBepStatus, resolveMitraPolicy } from './mitraPolicy'
import { rentangClosingTepat } from './closing/terapkanClosingOpex'

/**
 * Tanggal efektif kebijakan pemotongan OPEX Head Office menggunakan Management Fee 3%.
 * Periode sebelum 2026-11-01 (termasuk bulan Closing September & Oktober 2026)
 * tetap memakai penyajian sebelumnya tanpa mengurangi OPEX Head Office.
 */
export const MANAGEMENT_FEE_OPEX_DEDUCTION_CUTOFF = '2026-11-01'

export interface SalesRowForManagementFee {
  outlet_id: string
  sales_date?: string | null
  date?: string | null
  omzet?: number | string | null
  total_deductions?: number | string | null
}

export interface MitraOutletFeeItem {
  outletId: string
  outletName: string
  gross: number
  /** Total Management Fee 3% pada periode ini (gabungan legacy + pengurang OPEX HO). */
  fee: number
  /** Omzet kotor dari tanggal >= 2026-11-01 pada outlet belum BEP. */
  grossForHoOpex: number
  /** Porsi Management Fee 3% dari tanggal >= 2026-11-01 yang dipakai mengurangi OPEX Head Office. */
  feeForHoOpex: number
  /** Porsi Management Fee 3% dari tanggal < 2026-11-01 yang tetap dicatat di pendapatan pusat. */
  feeLegacyRevenue: number
  pct: number
  isBep: boolean
  profitSharingPct: number
}

export interface MitraManagementFeeSummary {
  /** Total seluruh Management Fee 3% mitra (feeLegacyRevenue + feeForHoOpex). */
  totalMitraFee: number
  /** Total Management Fee 3% (tanggal >= 2026-11-01) yang dialokasikan untuk mengurangi OPEX Head Office. */
  totalFeeForHoOpex: number
  /** Total Management Fee 3% (tanggal < 2026-11-01) yang tetap di pos Pendapatan Pusat. */
  totalFeeLegacyRevenue: number
  grossMitraBelumBep: number
  grossMitraBelumBepHoOpex: number
  jumlahOutletBelumBep: number
  perOutletFee: Map<string, MitraOutletFeeItem>
  /** Daftar outlet mitra yang menyumbang potongan Fee 3% ke OPEX HO, diurutkan terbesar. */
  activeHoFeeOutlets: MitraOutletFeeItem[]
}

export interface HoOpexFeeOffsetResult {
  /** Beban kotor Head Office sebelum dikurangi Fee Manajemen 3%. */
  rawHoOpex: number
  /** Total Fee Manajemen 3% tersedia dari outlet mitra belum BEP (>= Nov 2026). */
  availableFee: number
  /** Nominal Fee 3% yang efektif memotong OPEX Head Office (maksimal sebesar rawHoOpex, tidak memotong outlet). */
  appliedDeduction: number
  /** Beban bersih Head Office setelah dipotong Fee 3% (dibatasi minimal Rp 0, tidak pernah minus). */
  netHoOpex: number
  /**
   * Sisa lebih Fee 3% apabila pada rentang tertentu availableFee > rawHoOpex.
   * Dicatat sebagai surplus pendapatan pusat di Laba Rugi agar tidak ada rupiah hilang maupun duplikasi.
   */
  surplusToRevenue: number
}

/**
 * Menghitung Management Fee 3% seluruh outlet kemitraan secara terpusat (1:1 antara
 * Buku Kas OPEX, Analisis Pengeluaran, Laba Rugi, Ekspor, dan Ringkasan Bisnis).
 */
export function computeMitraManagementFees(params: {
  salesRows: SalesRowForManagementFee[]
  outlets: OutletOwnershipInput[]
  investments: Record<string, any>
  periodFrom: string
  periodTo: string
}): MitraManagementFeeSummary {
  const { salesRows, outlets, investments, periodFrom, periodTo } = params

  const mitraIds = mitraOutletIds(outlets, investments)
  const abaikanTanggalMulai = rentangClosingTepat(periodFrom, periodTo)
  const cutoffDates = new Map<string, string>()
  if (!abaikanTanggalMulai) {
    for (const [id, inv] of Object.entries(investments || {})) {
      if (inv?.tanggal_mulai) {
        cutoffDates.set(id, inv.tanggal_mulai)
      }
    }
  }

  const nameById = new Map<string, string>()
  for (const o of outlets || []) {
    if (o?.id && o?.name) nameById.set(o.id, o.name)
  }

  let totalMitraFee = 0
  let totalFeeForHoOpex = 0
  let totalFeeLegacyRevenue = 0
  let grossMitraBelumBep = 0
  let grossMitraBelumBepHoOpex = 0
  const perOutletFee = new Map<string, MitraOutletFeeItem>()

  const allMitraOids = new Set([...Object.keys(investments || {}), ...Array.from(mitraIds)])
  for (const oid of allMitraOids) {
    const inv = investments?.[oid]
    const outletSales = (salesRows || []).filter((r) => {
      const d = r.sales_date || r.date
      return (
        r.outlet_id === oid &&
        !isTestOutlet(r.outlet_id) &&
        isInScope('mitra', oid, mitraIds, d, cutoffDates)
      )
    })

    let gross = 0
    let grossBeforeCutoff = 0
    let grossAfterCutoff = 0
    for (const r of outletSales) {
      const g = (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0)
      const d = (r.sales_date || r.date || periodFrom || '').slice(0, 10)
      gross += g
      if (d >= MANAGEMENT_FEE_OPEX_DEDUCTION_CUTOFF) {
        grossAfterCutoff += g
      } else {
        grossBeforeCutoff += g
      }
    }

    const bepInfo = calculateMitraBepStatus(inv, oid, periodFrom, inv?.isBep)
    const policy = resolveMitraPolicy({
      periodFrom,
      isBep: bepInfo.isBep,
      legacyProfitSharingPct: inv?.persentase_bagi_hasil,
      legacyManagementFee: inv?.management_fee,
    })

    // Jika rentang lintas Oktober -> November (periodFrom < 2026-11-01 <= periodTo),
    // cek status BEP & policy khusus untuk porsi November ke atas menggunakan batas 2026-11-01.
    const postCutoffPeriodFrom =
      periodFrom >= MANAGEMENT_FEE_OPEX_DEDUCTION_CUTOFF
        ? periodFrom
        : MANAGEMENT_FEE_OPEX_DEDUCTION_CUTOFF
    const bepInfoPost =
      postCutoffPeriodFrom === periodFrom
        ? bepInfo
        : calculateMitraBepStatus(inv, oid, postCutoffPeriodFrom, inv?.isBep)
    const policyPost =
      postCutoffPeriodFrom === periodFrom
        ? policy
        : resolveMitraPolicy({
            periodFrom: postCutoffPeriodFrom,
            isBep: bepInfoPost.isBep,
            legacyProfitSharingPct: inv?.persentase_bagi_hasil,
            legacyManagementFee: inv?.management_fee,
          })

    let feeLegacyRevenue = 0
    let feeForHoOpex = 0

    if (grossBeforeCutoff > 0 && grossAfterCutoff === 0) {
      feeLegacyRevenue = policy.managementFeePct > 0 ? Math.round((gross * policy.managementFeePct) / 100) : 0
    } else if (grossAfterCutoff > 0 && grossBeforeCutoff === 0) {
      feeForHoOpex = policyPost.managementFeePct > 0 ? Math.round((gross * policyPost.managementFeePct) / 100) : 0
    } else if (gross > 0) {
      feeLegacyRevenue =
        policy.managementFeePct > 0 ? Math.round((grossBeforeCutoff * policy.managementFeePct) / 100) : 0
      feeForHoOpex =
        policyPost.managementFeePct > 0 ? Math.round((grossAfterCutoff * policyPost.managementFeePct) / 100) : 0
    }

    const fee = feeLegacyRevenue + feeForHoOpex
    const effectivePolicy = grossAfterCutoff > 0 ? policyPost : policy
    const effectiveBep = grossAfterCutoff > 0 ? bepInfoPost.isBep : bepInfo.isBep

    if (policy.managementFeePct > 0 && grossBeforeCutoff > 0) {
      grossMitraBelumBep += grossBeforeCutoff
    }
    if (policyPost.managementFeePct > 0 && grossAfterCutoff > 0) {
      grossMitraBelumBep += grossAfterCutoff
      grossMitraBelumBepHoOpex += grossAfterCutoff
    }

    const outletName = nameById.get(oid) || inv?.outlet_name || inv?.nama_outlet || 'Outlet Mitra'
    const item: MitraOutletFeeItem = {
      outletId: oid,
      outletName,
      gross,
      fee,
      grossForHoOpex: policyPost.managementFeePct > 0 ? grossAfterCutoff : 0,
      feeForHoOpex,
      feeLegacyRevenue,
      pct: effectivePolicy.managementFeePct,
      isBep: effectiveBep,
      profitSharingPct: effectivePolicy.profitSharingPct,
    }
    perOutletFee.set(oid, item)
    totalMitraFee += fee
    totalFeeForHoOpex += feeForHoOpex
    totalFeeLegacyRevenue += feeLegacyRevenue
  }

  let jumlahOutletBelumBep = 0
  perOutletFee.forEach((v) => {
    if (v.pct > 0) jumlahOutletBelumBep++
  })

  const activeHoFeeOutlets = Array.from(perOutletFee.values())
    .filter((v) => v.feeForHoOpex > 0)
    .sort((a, b) => b.feeForHoOpex - a.feeForHoOpex)

  return {
    totalMitraFee,
    totalFeeForHoOpex,
    totalFeeLegacyRevenue,
    grossMitraBelumBep,
    grossMitraBelumBepHoOpex,
    jumlahOutletBelumBep,
    perOutletFee,
    activeHoFeeOutlets,
  }
}

/**
 * Mengurangi beban kotor Head Office dengan Management Fee 3% (>= Nov 2026):
 * - Hanya mengurangi porsi beban Head Office (tidak pernah memotong OPEX outlet cabang).
 * - Beban bersih Head Office dibatasi minimal Rp 0 (tidak pernah minus).
 * - Bila pada suatu rentang pendek Fee 3% > Beban Kotor HO, selisihnya masuk ke `surplusToRevenue`
 *   sehingga `appliedDeduction + surplusToRevenue === availableFee` (Rp 0 hilang & Rp 0 duplikasi).
 */
export function applyHoOpexManagementFeeOffset(
  rawHoOpex: number,
  feeForHoOpex: number,
): HoOpexFeeOffsetResult {
  const safeRaw = Math.max(0, Number(rawHoOpex) || 0)
  const safeFee = Math.max(0, Number(feeForHoOpex) || 0)
  const appliedDeduction = Math.min(safeRaw, safeFee)
  const netHoOpex = rawHoOpex < 0 ? rawHoOpex : Math.max(0, safeRaw - appliedDeduction)
  const surplusToRevenue = safeFee - appliedDeduction

  return {
    rawHoOpex: Number(rawHoOpex) || 0,
    availableFee: safeFee,
    appliedDeduction,
    netHoOpex,
    surplusToRevenue,
  }
}
