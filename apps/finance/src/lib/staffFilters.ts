export const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'
export const KANTOR_PUSAT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

export interface StaffFilterCandidate {
  id?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  account_category?: string | null
  email?: string | null
  outlet_id?: string | null
  outlets?: { id?: string | null; name?: string | null; slug?: string | null } | null
}

/**
 * Mendeteksi apakah staf adalah akun devai bot, kiosk, mitra owner, atau akun testing dummy
 * agar disembunyikan dari perhitungan penggajian karyawan aktif.
 */
export function isTestOrDevStaff(s?: StaffFilterCandidate | null): boolean {
  if (!s) return false

  // 0. Explicit account_category check (Database driven)
  if (s.account_category && s.account_category !== 'employee') {
    return true
  }

  // 1. Role checks (non-operational employee roles)
  const role = (s.role || '').toLowerCase()
  if (role === 'developer' || role === 'kiosk' || role === 'mitra' || role === 'owner') {
    return true
  }

  // 2. Test Outlet checks
  if (s.outlet_id === TEST_OUTLET_ID) return true
  if (s.outlets?.name) {
    const outName = s.outlets.name.toLowerCase()
    if (outName.includes('outlet tes') || outName.includes('outlet test')) return true
  }

  const name = (s.name || '').trim().toLowerCase()
  const username = (s.username || '').trim().toLowerCase()
  const email = (s.email || '').trim().toLowerCase()

  // 3. Mitra & Owner patterns
  if (
    username.startsWith('mitra_') ||
    name.startsWith('mitra ') ||
    username.includes('mitra') ||
    username.startsWith('owner') ||
    name.startsWith('owner') ||
    username === 'ownerss' ||
    username === 'owner'
  ) {
    return true
  }

  // 4. Super Admin & Admin dummy patterns
  if (
    username.startsWith('superadmin') ||
    name.startsWith('super admin') ||
    name.startsWith('superadmin') ||
    username === 'admin2' ||
    name === 'admin 2' ||
    username === 'admindev' ||
    name === 'admin dev'
  ) {
    return true
  }

  // 5. Generic department shared accounts
  if (
    username === 'finance' ||
    name === 'tim finance' ||
    username === 'admin_finance' ||
    name === 'admin finance' ||
    username === 'purchasing' ||
    name === 'tim purchasing' ||
    username === 'staff_pusat' ||
    name === 'staff pusat'
  ) {
    return true
  }

  // 6. Kiosk patterns
  if (username.includes('kiosk') || name.includes('kiosk')) {
    return true
  }

  // 7. Dev AI bot accounts (devai_*)
  if (name.startsWith('devai') || username.startsWith('devai') || email.startsWith('devai')) return true
  if (username.startsWith('dev_') || email.startsWith('dev_')) return true

  // 7. Explicit dummy / test usernames
  const testUsernames = [
    'tes',
    'tes_bnr',
    'tes_outlet',
    'kasir_tes',
    'empang_tes',
    'rendy_tes',
    'pusat_tes',
    'pusat_tesss',
    'owner_test',
    'leader_test',
    'kitchentest',
    'testcicurug',
    'testempang',
    'test_outlet',
    'leader_baru',
    'korlap1',
  ]
  if (testUsernames.includes(username)) return true

  // 8. Test names pattern
  if (
    name === 'test finance' ||
    name === 'test cicurug' ||
    name === 'test empang' ||
    name === 'test kitchen crew' ||
    name === 'kitchen test' ||
    name === 'leader tes' ||
    name === 'leader suka shawarma' ||
    name === 'leader baru' ||
    name === 'kasir paledang' ||
    name === 'tes' ||
    name === 'tes_bnr' ||
    name === 'tes_outlet' ||
    name === 'kasir_tes' ||
    name === 'empang_tes' ||
    name === 'pusat_tes' ||
    name === 'pusat_tesss' ||
    name === 'rendy_tes' ||
    name === 'superadmin 2' ||
    name === 'admin 2'
  ) {
    return true
  }

  // 9. Test prefix/pattern checks
  if (
    username.startsWith('test') ||
    username.startsWith('tes') ||
    username.endsWith('_test') ||
    username.endsWith('_tes') ||
    username.includes('_tes_') ||
    username.includes('_test_') ||
    name.includes('test') ||
    name.startsWith('tes ') ||
    name.endsWith(' tes') ||
    name === 'tes'
  ) {
    return true
  }

  if (
    email.startsWith('test') ||
    email.startsWith('tes_') ||
    email.includes('testfinance') ||
    email.includes('leader.tes')
  ) {
    return true
  }

  return false
}
