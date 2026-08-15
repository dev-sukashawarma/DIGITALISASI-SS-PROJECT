import type { AppName, Role } from './types'

/** Sumber tunggal matriks akses role -> daftar app. Ref: docs/ROLE-JOBDESK.md */
export const ROLE_APP_ACCESS: Record<Role, AppName[]> = {
  admin: ['admin-dashboard', 'stok', 'distribusi', 'finance'],
  admin_hr: ['absensi', 'admin-dashboard'],
  owner: ['owner-dashboard', 'admin-dashboard', 'finance'],
  spv: ['absensi', 'stok', 'distribusi', 'pos-kasir', 'admin-dashboard', 'finance', 'manager'],
  regional_manager: ['manager', 'absensi', 'stok', 'distribusi', 'pos-kasir'],
  kitchen: ['stok', 'distribusi'],
  leader: ['pos-kasir', 'absensi', 'stok', 'distribusi', 'admin-dashboard'],
  crew: ['absensi', 'pos-kasir', 'stok', 'distribusi'],
  kiosk: ['pos-kasir'],
  mitra: ['admin-dashboard'],
  staff_pusat: ['absensi'],
  admin_finance: ['finance', 'stok'],
  area_manager: ['manager', 'absensi', 'stok', 'distribusi'],
  purchasing: ['admin-dashboard', 'finance', 'stok'],
  developer: ['admin-dashboard'],
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
