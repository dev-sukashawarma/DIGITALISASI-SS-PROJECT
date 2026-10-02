import type { CashKind, CashTxStatus } from './types'
import { isTestOutlet, isExcludedOutlet } from './outletFilters'

export interface NetCashSummary {
  /** Total saldo semua lokasi berjenis 'bank' (Pusat). */
  totalBank: number
  /** Total saldo kas fisik pusat. */
  totalCashPusat: number
  /** Total saldo kas & bank di kantor pusat (bank + kas fisik pusat). */
  totalPusat: number
  /** Total saldo kas kecil di outlet / cabang operasional aktif. */
  totalOutletCash: number
  /** Total seluruh likuiditas perusahaan (Pusat + Outlet). */
  totalLiquidity: number
  /** Alias backward-compatibility: total kas pusat (bank + kas fisik pusat). */
  total: number
  /** Alias backward-compatibility: total kas fisik pusat. */
  totalCash: number
}

/**
 * Ringkas saldo per-jenis lokasi:
 * - Kas & Bank Pusat (Bank BCA + Kas Fisik Pusat)
 * - Kas Operasional Outlet (Petty Cash Cabang, mengecualikan outlet test)
 */
export function summarizeBalances(
  rows: Array<{ kind: CashKind; saldo: number; scope: string; is_active?: boolean; label?: string }>
): NetCashSummary {
  let totalBank = 0
  let totalCashPusat = 0
  let totalOutletCash = 0

  for (const r of rows) {
    if (r.is_active === false) continue
    if (r.label && (isTestOutlet(r.label) || isExcludedOutlet(r.label))) continue

    if (r.scope === 'outlet') {
      totalOutletCash += (r.saldo || 0)
    } else {
      if (r.kind === 'bank') totalBank += (r.saldo || 0)
      else totalCashPusat += (r.saldo || 0)
    }
  }

  const totalPusat = totalBank + totalCashPusat
  const totalLiquidity = totalPusat + totalOutletCash

  return {
    totalBank,
    totalCashPusat,
    totalPusat,
    totalOutletCash,
    totalLiquidity,
    total: totalPusat,
    totalCash: totalCashPusat,
  }
}

/** Jumlah transaksi yang menunggu persetujuan checker. */
export function countPendingApproval(
  rows: Array<{ status: CashTxStatus }>
): number {
  return rows.filter((r) => r.status === 'pending_approval').length
}
