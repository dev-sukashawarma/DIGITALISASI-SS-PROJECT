import type { AppName, Role } from './types'

/** Sumber tunggal matriks akses role -> daftar app. Ref: docs/ROLE-JOBDESK.md */
export const ROLE_APP_ACCESS: Record<Role, AppName[]> = {
  admin: ['pos-kasir', 'absensi', 'stok', 'distribusi', 'owner-dashboard', 'admin-dashboard'],
  admin_hr: ['absensi', 'admin-dashboard'],
  owner: ['owner-dashboard', 'admin-dashboard'],
  spv: ['absensi', 'stok', 'distribusi'],
  kitchen: ['stok', 'distribusi'],
  leader: ['pos-kasir', 'absensi', 'stok', 'distribusi'],
  crew: ['absensi', 'pos-kasir', 'stok', 'distribusi'],
  kiosk: ['pos-kasir'],
  mitra: ['admin-dashboard'],
}

export function hasAppAccess(role: Role, app: AppName): boolean {
  return ROLE_APP_ACCESS[role]?.includes(app) ?? false
}

export function accessibleApps(role: Role): AppName[] {
  return ROLE_APP_ACCESS[role] ?? []
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
