import type { AppName, Role } from './types'

/** Semua app suite. Role `developer` (superuser teknis) mendapat seluruhnya. */
export const ALL_APPS: AppName[] = [
  'pos-kasir',
  'absensi',
  'inventori',
  'stok',
  'distribusi',
  'owner-dashboard',
  'admin-dashboard',
  'finance',
  'manager',
  'monitoring',
  'HR',
  'marcom',
]

/** Role superuser teknis: akses semua app & semua fitur. */
export const SUPERUSER_ROLES: readonly Role[] = ['developer']

export function isSuperuserRole(role: string | null | undefined): boolean {
  return !!role && (SUPERUSER_ROLES as readonly string[]).includes(role)
}

/** Sumber tunggal matriks akses role -> daftar app. Ref: docs/ROLE-JOBDESK.md */
export const ROLE_APP_ACCESS: Record<Role, AppName[]> = {
  admin: ['admin-dashboard', 'inventori', 'stok', 'distribusi', 'finance', 'HR', 'marcom'],
  admin_hr: ['absensi', 'admin-dashboard', 'HR', 'stok'],
  owner: ['owner-dashboard', 'inventori', 'stok', 'HR', 'marcom'],
  spv: ['absensi', 'stok', 'distribusi', 'pos-kasir', 'admin-dashboard', 'finance', 'manager'],
  regional_manager: ['manager', 'absensi', 'inventori', 'stok', 'distribusi', 'pos-kasir'],
  kitchen: ['stok', 'distribusi'],
  leader: ['pos-kasir', 'absensi', 'stok', 'distribusi', 'admin-dashboard', 'finance'],
  crew: ['absensi', 'pos-kasir', 'stok', 'distribusi'],
  kiosk: ['pos-kasir'],
  mitra: ['admin-dashboard'],
  staff_pusat: ['absensi', 'marcom'],
  admin_finance: ['finance', 'stok'],
  area_manager: ['manager', 'absensi', 'inventori', 'stok', 'distribusi', 'admin-dashboard', 'finance'],
  purchasing: ['admin-dashboard', 'finance', 'stok', 'distribusi'],
  developer: ALL_APPS,
  driver: ['absensi'],
}


export function hasAppAccess(role: Role, app: AppName, username?: string | null): boolean {
  if (username === 'adminkitchen' && app === 'absensi') {
    return true
  }
  return ROLE_APP_ACCESS[role]?.includes(app) ?? false
}

export function accessibleApps(role: Role, username?: string | null): AppName[] {
  const apps = [...(ROLE_APP_ACCESS[role] ?? [])]
  if (username === 'adminkitchen' && !apps.includes('absensi')) {
    apps.push('absensi')
  }
  return apps
}

/**
 * Normalisasi identitas login → email yang valid untuk Supabase Auth.
 * Outlet Staff tanpa email asli (mis. kasir) login pakai username; username
 * tanpa `@` dipetakan ke pseudo-email `<username>@outlet.local`. Lihat ADR-008.
 */
export function normalizeLoginIdentifier(identifier: string): string {
  const id = identifier.trim()
  return id.includes('@') ? id : `${id}@outlet.local`
}
