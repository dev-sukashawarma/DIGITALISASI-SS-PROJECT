export type PeriodType = 'harian' | 'mingguan' | 'bulanan'

export interface BudgetStatus {
  outletId: string
  nominal: number
  periodType: PeriodType | null
  periodStart: string | null
  periodEnd: string | null
  terpakai: number
  sisa: number
  hasConfig: boolean
}

// Role yang boleh mengatur plafon budget outlet. Hanya owner (keputusan
// produk: owner yang menentukan nominal & periode per outlet — lihat
// docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md §9).
const BUDGET_MANAGER_ROLES = ['owner'] as const

export function canManageOutletBudget(role: string | null | undefined): boolean {
  return !!role && (BUDGET_MANAGER_ROLES as readonly string[]).includes(role)
}

export type BudgetBadgeVariant = 'hidden' | 'green' | 'orange' | 'red'

/**
 * Warna badge budget. `projectedAdd` = estimasi nilai keranjang/permintaan
 * yang belum disetujui, dijumlahkan ke `terpakai` untuk proyeksi "kalau ini
 * juga disetujui". Tidak pernah dipakai untuk blokir submit/approve — murni
 * visual (lihat spec §7, §8: keputusan tetap di approver).
 */
export function budgetBadgeVariant(
  status: Pick<BudgetStatus, 'hasConfig' | 'nominal' | 'terpakai'>,
  projectedAdd: number = 0
): BudgetBadgeVariant {
  if (!status.hasConfig) return 'hidden'
  if (status.nominal <= 0) return 'red'
  const projectedPct = ((status.terpakai + projectedAdd) / status.nominal) * 100
  if (projectedPct > 100) return 'red'
  if (projectedPct >= 80) return 'orange'
  return 'green'
}
