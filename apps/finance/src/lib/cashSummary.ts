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
 * Ringkas saldo per-jenis lokasi. 'cash' = uang tunai fisik yang masih
 * mengendap (belum masuk bank); dipisah agar terlihat jelas di dashboard.
 */
export function summarizeBalances(
  rows: Array<{ kind: CashKind; saldo: number; scope: string }>
): NetCashSummary {
  let totalBank = 0
  let totalCash = 0
  for (const r of rows) {
    if (r.scope === 'outlet') continue
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
