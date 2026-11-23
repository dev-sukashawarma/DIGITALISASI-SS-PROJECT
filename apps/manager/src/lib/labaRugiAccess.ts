/**
 * Kontrol akses khusus untuk Tab Laba Rugi di Dashboard Manager.
 *
 * Hanya akun Indra Adam Sami (Regional Manager, rm@ss.com) serta peran
 * superuser/pemilik (developer, owner, admin) yang diizinkan mengakses tab ini.
 */
export const ADAM_INDRA_SAMI_ID = '1a7cd03c-c878-402d-9e55-1ed49830e00a'
export const ADAM_INDRA_SAMI_EMAIL = 'rm@ss.com'

export interface LabaRugiStaffLike {
  id?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
}

export function canAccessLabaRugi(
  staff?: LabaRugiStaffLike | null,
  fallbackEmail?: string | null,
): boolean {
  if (!staff) return false
  if (staff.status && staff.status !== 'active') return false

  const role = (staff.role || '').toLowerCase().trim()
  if (role === 'developer' || role === 'owner' || role === 'admin') {
    return true
  }

  if (staff.id === ADAM_INDRA_SAMI_ID) {
    return true
  }

  const email = (staff.email || fallbackEmail || '').toLowerCase().trim()
  if (email === ADAM_INDRA_SAMI_EMAIL) {
    return true
  }

  return false
}
