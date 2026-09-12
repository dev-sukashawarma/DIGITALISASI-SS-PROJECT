export const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'

export interface StaffFilterCandidate {
  id?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  email?: string | null
  outlet_id?: string | null
  outlets?: { id?: string | null; name?: string | null; slug?: string | null } | null
}

/**
 * Mendeteksi apakah staf adalah akun developer, devai bot, atau akun testing dummy
 * agar disembunyikan dari dashboard HR tanpa menghapus data dari database.
 */
export function isTestOrDevStaff(s?: StaffFilterCandidate | null): boolean {
  if (!s) return false

  // 1. Role checks
  const role = (s.role || '').toLowerCase()
  if (role === 'developer') return true
  if (role === 'kiosk') return true

  // 2. Test Outlet checks
  if (s.outlet_id === TEST_OUTLET_ID) return true
  if (s.outlets?.name) {
    const outName = s.outlets.name.toLowerCase()
    if (outName.includes('outlet tes') || outName.includes('outlet test')) return true
  }

  const name = (s.name || '').trim().toLowerCase()
  const username = (s.username || '').trim().toLowerCase()
  const email = (s.email || '').trim().toLowerCase()

  // 3. Dev AI bot accounts (devai_*)
  if (name.startsWith('devai') || username.startsWith('devai') || email.startsWith('devai')) return true
  if (username.startsWith('dev_') || email.startsWith('dev_')) return true

  // 4. Developer / Admin Dev / Specific dev names
  if (username === 'admindev' || name === 'admin dev' || name.includes('developer')) return true

  // 5. Explicit dummy / test usernames
  const testUsernames = [
    'tes',
    'tes_bnr',
    'tes_outlet',
    'kasir_tes',
    'empang_tes',
    'rendy_tes',
    'pusat_tes',
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

  // 6. Test names pattern
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
    name === 'rendy_tes' ||
    name === 'superadmin 2' ||
    name === 'admin 2'
  ) {
    return true
  }

  // 7. Test prefix/pattern checks
  if (
    username.startsWith('test_') ||
    username.startsWith('tes_') ||
    username.endsWith('_test') ||
    username.endsWith('_tes')
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
