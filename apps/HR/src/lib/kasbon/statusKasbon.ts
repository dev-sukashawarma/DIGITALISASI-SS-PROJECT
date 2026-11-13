import type { CashAdvanceStatus } from '@/lib/types'

/**
 * Status kasbon untuk tampilan. Di DB, `status_hr` = persetujuan HR dan `status` = siklus uang
 * (menunggu_cair → active → paid_off). Pengajuan baru berstatus 'active' karena default,
 * jadi `status_hr` diperiksa lebih dulu.
 * Disalin identik ke apps/admin-dashboard/src/lib/kasbon/statusKasbon.ts.
 */
export function statusEfektifKasbon(row: {
  status: string | null
  status_hr?: string | null
  ditolak_finance_at?: string | null
}): CashAdvanceStatus {
  if (row.status_hr === 'rejected' || row.status === 'rejected') return 'rejected'
  if (!row.status_hr || row.status_hr === 'pending') return 'pending'
  if (row.status === 'paid_off') return 'paid_off'
  if (row.status === 'menunggu_cair') return 'menunggu_cair'
  if (row.status === 'active') return 'active'
  return 'pending'
}

const LABEL: Record<CashAdvanceStatus, string> = {
  pending: 'Menunggu Persetujuan',
  menunggu_cair: 'Menunggu pencairan',
  active: 'Aktif',
  paid_off: 'Lunas',
  rejected: 'Ditolak',
}

export function labelStatusKasbon(s: CashAdvanceStatus, ditolakFinance: boolean): string {
  if (s === 'rejected' && ditolakFinance) return 'Ditolak (Finance)'
  return LABEL[s]
}

/** Cicilan/potongan hanya untuk kasbon yang uangnya sudah dicairkan finance. */
export function bolehCatatCicilan(s: CashAdvanceStatus): boolean {
  return s === 'active'
}
