import { describe, it, expect } from 'vitest'
import { ROLE_APP_ACCESS, hasAppAccess, accessibleApps } from './access'

describe('ROLE_APP_ACCESS', () => {
  it('kasir hanya pos-kasir & absensi', () => {
    expect([...ROLE_APP_ACCESS.kasir].sort()).toEqual(['absensi', 'pos-kasir'])
  })

  it('crew punya absensi, pos-kasir, stok & distribusi', () => {
    expect([...ROLE_APP_ACCESS.crew].sort()).toEqual(['absensi', 'distribusi', 'pos-kasir', 'stok'])
  })

  it('admin semua 6 app termasuk admin-dashboard', () => {
    expect(ROLE_APP_ACCESS.admin.length).toBe(6)
    expect(ROLE_APP_ACCESS.admin).toContain('admin-dashboard')
  })

  it('hanya admin, admin_hr, dan owner yang punya admin-dashboard', () => {
    const roles: Array<keyof typeof ROLE_APP_ACCESS> = ['spv', 'kitchen', 'leader', 'kasir', 'crew', 'kiosk']
    roles.forEach(role => {
      expect(ROLE_APP_ACCESS[role]).not.toContain('admin-dashboard')
    })
  })

  it('owner punya owner-dashboard & admin-dashboard', () => {
    expect([...ROLE_APP_ACCESS.owner].sort()).toEqual(['admin-dashboard', 'owner-dashboard'])
  })

  it('spv tidak punya pos-kasir', () => {
    expect(ROLE_APP_ACCESS.spv).not.toContain('pos-kasir')
  })

  it('kitchen memiliki akses sama seperti spv', () => {
    expect([...ROLE_APP_ACCESS.kitchen].sort()).toEqual(['absensi', 'distribusi', 'stok'])
    expect(ROLE_APP_ACCESS.kitchen).toEqual(ROLE_APP_ACCESS.spv)
  })
})

describe('hasAppAccess', () => {
  it('leader boleh stok', () => {
    expect(hasAppAccess('leader', 'stok')).toBe(true)
  })
  it('crew boleh pos-kasir', () => {
    expect(hasAppAccess('crew', 'pos-kasir')).toBe(true)
  })
})

describe('accessibleApps', () => {
  it('mengembalikan daftar app utk role', () => {
    expect(accessibleApps('owner').sort()).toEqual(['admin-dashboard', 'owner-dashboard'])
  })
})
