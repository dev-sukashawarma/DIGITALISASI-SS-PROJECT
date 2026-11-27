import { isTestOrDevStaff } from '../staffFilters'
import { isTestOutlet } from '../outletFilters'
import type { PendingKasbonItem } from '../../components/modules/KasbonGuardModal'

export interface RawPendingKasbonRow extends Omit<PendingKasbonItem, 'outlet_staff'> {
  status?: string | null
  status_hr?: string | null
  outlet_staff?: {
    id?: string | null
    name: string
    username?: string | null
    role: string
    account_category?: string | null
    email?: string | null
    outlet_id?: string | null
    outlets?: { id?: string | null; name: string; slug?: string | null } | null
  } | null
}

/**
 * Menyaring pengajuan kasbon pending untuk Guard Finalisasi Payroll agar konsisten
 * dengan daftar & ringkasan Modul Kasbon (`hr_kasbon_daftar` / `hr_perizinan_ringkasan`):
 * mengecualikan akun tes/dev/non-karyawan, outlet tes, baris tanpa staf, dan kasbon lunas.
 */
export function filterPendingKasbonsForGuard<T extends RawPendingKasbonRow>(rows: T[]): T[] {
  return rows.filter((row) => {
    if (!row.staff_id || !row.outlet_staff) return false
    if (row.status === 'paid_off' || row.status === 'rejected') return false
    if (row.status_hr && row.status_hr !== 'pending') return false
    if (isTestOrDevStaff(row.outlet_staff)) return false
    if (isTestOutlet(row.outlet_staff.outlets)) return false
    return true
  })
}
