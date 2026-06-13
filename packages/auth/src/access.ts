import type { AppName, Role } from './types'

/** Sumber tunggal matriks akses role -> daftar app. Ref: docs/ROLE-JOBDESK.md */
export const ROLE_APP_ACCESS: Record<Role, AppName[]> = {
  admin: ['pos-kasir', 'absensi', 'stok', 'distribusi', 'owner-dashboard'],
  owner: ['owner-dashboard'],
  spv: ['absensi', 'stok', 'distribusi'],
  kepala_outlet: ['pos-kasir', 'absensi', 'stok', 'distribusi'],
  kasir: ['pos-kasir', 'absensi'],
  crew: ['absensi'],
  kiosk: ['pos-kasir'],
}

export function hasAppAccess(role: Role, app: AppName): boolean {
  return ROLE_APP_ACCESS[role]?.includes(app) ?? false
}

export function accessibleApps(role: Role): AppName[] {
  return ROLE_APP_ACCESS[role] ?? []
}
