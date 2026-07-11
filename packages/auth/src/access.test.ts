import { describe, it, expect } from 'vitest'
import { ROLE_APP_ACCESS, hasAppAccess, accessibleApps } from './access'

describe('ROLE_APP_ACCESS', () => {


  it('crew punya absensi, pos-kasir, stok & distribusi', () => {
    expect([...ROLE_APP_ACCESS.crew].sort()).toEqual(['absensi', 'distribusi', 'pos-kasir', 'stok'])
  })

  it('admin semua app termasuk admin-dashboard & finance', () => {
    expect(ROLE_APP_ACCESS.admin.length).toBe(7)
    expect(ROLE_APP_ACCESS.admin).toContain('admin-dashboard')
    expect(ROLE_APP_ACCESS.admin).toContain('finance')
  })

  it('finance hanya utk admin_finance, owner, admin', () => {
    const withFinance = (Object.keys(ROLE_APP_ACCESS) as Array<keyof typeof ROLE_APP_ACCESS>)
      .filter(r => ROLE_APP_ACCESS[r].includes('finance'))
      .sort()
    expect(withFinance).toEqual(['admin', 'admin_finance', 'korlap', 'owner'])
  })

  it('admin_finance hanya punya finance', () => {
    expect(ROLE_APP_ACCESS.admin_finance).toEqual(['finance'])
  })

  it('hanya admin, admin_hr, dan owner yang punya admin-dashboard', () => {
    const roles: Array<keyof typeof ROLE_APP_ACCESS> = ['spv', 'kitchen', 'leader', 'crew', 'kiosk']
    roles.forEach(role => {
      expect(ROLE_APP_ACCESS[role]).not.toContain('admin-dashboard')
    })
  })

  it('owner punya owner-dashboard, admin-dashboard & finance', () => {
    expect([...ROLE_APP_ACCESS.owner].sort()).toEqual(['admin-dashboard', 'finance', 'owner-dashboard'])
  })

  it('spv punya pos-kasir', () => {
    expect(ROLE_APP_ACCESS.spv).toContain('pos-kasir')
  })

  it('kitchen memiliki akses stok dan distribusi', () => {
    expect([...ROLE_APP_ACCESS.kitchen].sort()).toEqual(['distribusi', 'stok'])
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
    expect(accessibleApps('owner').sort()).toEqual(['admin-dashboard', 'finance', 'owner-dashboard'])
  })
})
