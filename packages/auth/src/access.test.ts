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

  it('purchasing memiliki akses ke admin-dashboard, finance, stok, distribusi', () => {
    expect(hasAppAccess('purchasing', 'admin-dashboard')).toBe(true)
    expect(hasAppAccess('purchasing', 'finance')).toBe(true)
    expect(hasAppAccess('purchasing', 'stok')).toBe(true)
    expect(hasAppAccess('purchasing', 'distribusi')).toBe(true)
    expect(accessibleApps('purchasing')).toContain('admin-dashboard')
    expect(accessibleApps('purchasing')).toContain('finance')
    expect(accessibleApps('purchasing')).toContain('stok')
    expect(accessibleApps('purchasing')).toContain('distribusi')
  })

  it('leader memiliki akses ke pos-kasir, absensi, stok, distribusi, admin-dashboard, finance', () => {
    expect(hasAppAccess('leader', 'pos-kasir')).toBe(true)
    expect(hasAppAccess('leader', 'absensi')).toBe(true)
    expect(hasAppAccess('leader', 'stok')).toBe(true)
    expect(hasAppAccess('leader', 'distribusi')).toBe(true)
    expect(hasAppAccess('leader', 'admin-dashboard')).toBe(true)
    expect(hasAppAccess('leader', 'finance')).toBe(true)
  })

  it('area_manager memiliki akses ke manager, absensi, inventori, stok, distribusi, admin-dashboard, finance', () => {
    expect(hasAppAccess('area_manager', 'admin-dashboard')).toBe(true)
    expect(hasAppAccess('area_manager', 'finance')).toBe(true)
    expect(hasAppAccess('area_manager', 'manager')).toBe(true)
  })

  it('driver hanya memiliki akses ke absensi', () => {
    expect(hasAppAccess('driver', 'absensi')).toBe(true)
    expect(hasAppAccess('driver', 'pos-kasir')).toBe(false)
    expect(hasAppAccess('driver', 'stok')).toBe(false)
    expect(hasAppAccess('driver', 'distribusi')).toBe(false)
    expect(hasAppAccess('driver', 'admin-dashboard')).toBe(false)
    expect(hasAppAccess('driver', 'finance')).toBe(false)
    expect(accessibleApps('driver')).toEqual(['absensi'])
  })
})
