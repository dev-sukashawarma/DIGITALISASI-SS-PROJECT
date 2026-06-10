import type { StokLevel } from '@/types/stok'

export function stokStatus(saldo: number, reorderPoint: number): StokLevel {
  if (reorderPoint <= 0) return 'unknown'
  if (saldo >= reorderPoint) return 'aman'
  if (saldo >= reorderPoint / 2) return 'menipis'
  return 'kritis'
}

const OVERDUE_DAYS = 2
export function isOpnameOverdue(lastOpnameDate: string | null, now: Date = new Date()): boolean {
  if (!lastOpnameDate) return true
  const last = new Date(lastOpnameDate + 'T00:00:00Z').getTime()
  const days = (now.getTime() - last) / 86_400_000
  return days > OVERDUE_DAYS
}
