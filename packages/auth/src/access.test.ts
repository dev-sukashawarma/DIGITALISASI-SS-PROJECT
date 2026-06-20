import { describe, it, expect } from 'vitest'
import { ROLE_APP_ACCESS, hasAppAccess, accessibleApps } from './access'

describe('ROLE_APP_ACCESS', () => {
  it('kasir hanya pos-kasir & absensi', () => {
    expect([...ROLE_APP_ACCESS.kasir].sort()).toEqual(['absensi', 'pos-kasir'])
  })

  it('crew hanya absensi', () => {
    expect([...ROLE_APP_ACCESS.crew]).toEqual(['absensi'])
  })

  it('admin semua 6 app termasuk admin-dashboard', () => {
    expect(ROLE_APP_ACCESS.admin.length).toBe(6)
    expect(ROLE_APP_ACCESS.admin).toContain('admin-dashboard')
  })

  it('hanya admin yang punya admin-dashboard', () => {
    const roles: Array<keyof typeof ROLE_APP_ACCESS> = ['owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk']
    roles.forEach(role => {
      expect(ROLE_APP_ACCESS[role]).not.toContain('admin-dashboard')
    })
  })

  it('owner hanya owner-dashboard', () => {
    expect([...ROLE_APP_ACCESS.owner]).toEqual(['owner-dashboard'])
  })

  it('spv tidak punya pos-kasir', () => {
    expect(ROLE_APP_ACCESS.spv).not.toContain('pos-kasir')
  })
})

describe('hasAppAccess', () => {
  it('leader boleh stok', () => {
    expect(hasAppAccess('leader', 'stok')).toBe(true)
  })
  it('crew tidak boleh pos-kasir', () => {
    expect(hasAppAccess('crew', 'pos-kasir')).toBe(false)
  })
})

describe('accessibleApps', () => {
  it('mengembalikan daftar app utk role', () => {
    expect(accessibleApps('owner')).toEqual(['owner-dashboard'])
  })
})
