import type { CashKind, CashTxStatus } from './types'

export interface NetCashSummary {
  /** Total saldo semua lokasi berjenis 'bank'. */
  totalBank: number
  /** Total saldo semua lokasi berjenis 'cash' (mis. Kas Pusat). */
  totalCash: number
  /** Total keseluruhan (bank + cash). */
  total: number
}

/**
 * Ringkas saldo per-jenis lokasi (bank vs kas fisik pusat).
 * Lokasi bertipe outlet atau berstatus non-aktif (is_active: false) diabaikan.
 */
export function summarizeBalances(
  rows: Array<{ kind: CashKind; saldo: number; scope: string; is_active?: boolean }>
): NetCashSummary {
  let totalBank = 0
  let totalCash = 0
  for (const r of rows) {
    if (r.scope === 'outlet' || r.is_active === false) continue
    if (r.kind === 'bank') totalBank += r.saldo
    else totalCash += r.saldo
  }
  return { totalBank, totalCash, total: totalBank + totalCash }
}

/** Jumlah transaksi yang menunggu persetujuan checker. */
export function countPendingApproval(
  rows: Array<{ status: CashTxStatus }>
): number {
  return rows.filter((r) => r.status === 'pending_approval').length
}
