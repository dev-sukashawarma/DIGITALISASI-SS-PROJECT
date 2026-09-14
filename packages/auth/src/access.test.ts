import { describe, it, expect } from 'vitest'
import { hasAppAccess, accessibleApps } from './access'

describe('access matrix', () => {
  it('developer memiliki akses ke stok, admin-dashboard, HR, monitoring', () => {
    expect(hasAppAccess('developer', 'stok')).toBe(true)
    expect(hasAppAccess('developer', 'admin-dashboard')).toBe(true)
    expect(hasAppAccess('developer', 'HR')).toBe(true)
    expect(hasAppAccess('developer', 'monitoring')).toBe(true)
    expect(accessibleApps('developer')).toContain('stok')
  })

  it('admin_hr memiliki akses ke absensi, admin-dashboard, HR, stok', () => {
    expect(hasAppAccess('admin_hr', 'stok')).toBe(true)
    expect(hasAppAccess('admin_hr', 'absensi')).toBe(true)
    expect(hasAppAccess('admin_hr', 'admin-dashboard')).toBe(true)
    expect(hasAppAccess('admin_hr', 'HR')).toBe(true)
    expect(accessibleApps('admin_hr')).toContain('stok')
  })
})
