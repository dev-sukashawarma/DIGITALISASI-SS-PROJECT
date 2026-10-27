'use server'

import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { hitungRingkasanPayrollHr } from '@/lib/server/ringkasanPayrollHr'
import type { HRPayrollSummary } from '@/lib/server/ringkasanPayrollHr'

/**
 * Ringkasan payroll HR untuk Buku Kas & Laba Rugi. Mengembalikan gaji tiap
 * karyawan, jadi hanya untuk peran keuangan — 'use server' = endpoint POST yang
 * bisa dipanggil siapa pun yang punya sesi, tanpa lewat halamannya.
 */
export async function getHRPayrollSummaryAction(filter: {
  from: string
  to: string
  outletId: string
}): Promise<HRPayrollSummary> {
  await requireRole(PERAN_KEUANGAN)
  return hitungRingkasanPayrollHr(filter)
}
