import { describe, it, expect } from 'vitest'
import { hasAppAccess, accessibleApps, ALL_APPS, isSuperuserRole } from './access'

describe('access matrix', () => {
  it('developer memiliki akses ke stok, admin-dashboard, HR, monitoring, finance', () => {
    expect(hasAppAccess('developer', 'stok')).toBe(true)
    expect(hasAppAccess('developer', 'admin-dashboard')).toBe(true)
    expect(hasAppAccess('developer', 'HR')).toBe(true)
    expect(hasAppAccess('developer', 'monitoring')).toBe(true)
    expect(hasAppAccess('developer', 'finance')).toBe(true)
    expect(accessibleApps('developer')).toContain('stok')
    expect(accessibleApps('developer')).toContain('finance')
  })

  it('developer memiliki akses ke SEMUA app', () => {
    for (const app of ALL_APPS) expect(hasAppAccess('developer', app)).toBe(true)
    expect([...accessibleApps('developer')].sort()).toEqual([...ALL_APPS].sort())
    expect(isSuperuserRole('developer')).toBe(true)
    expect(isSuperuserRole('owner')).toBe(false)
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

describe('Kantor Pusat: staf pusat & crew dibatasi', () => {
  const kantorPusat = { outlet_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', outlets: { name: 'KANTOR PUSAT' } }
  const outletBiasa = { outlet_id: '550e8400-e29b-41d4-a716-446655440001', outlets: { name: 'SUKA SHAWARMA BNR' } }
  const gudangPusat = { outlet_id: 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90', outlets: { name: 'GUDANG PUSAT (HQ)' } }

  it('staff_pusat di Kantor Pusat hanya absensi dan marcom', () => {
    expect(accessibleApps('staff_pusat', null, kantorPusat).sort()).toEqual(['absensi', 'marcom'])
    expect(hasAppAccess('staff_pusat', 'marcom', null, kantorPusat)).toBe(true)
  })

  it('crew di Kantor Pusat hanya absensi — tanpa kasir, stok, distribusi', () => {
    expect(accessibleApps('crew', null, kantorPusat)).toEqual(['absensi'])
    expect(hasAppAccess('crew', 'pos-kasir', null, kantorPusat)).toBe(false)
    expect(hasAppAccess('crew', 'stok', null, kantorPusat)).toBe(false)
    expect(hasAppAccess('crew', 'absensi', null, { outlet_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' })).toBe(true)
  })

  it('crew di outlet biasa dan Gudang Pusat tetap memakai matriks biasa', () => {
    expect(hasAppAccess('crew', 'pos-kasir', null, outletBiasa)).toBe(true)
    expect(hasAppAccess('crew', 'stok', null, gudangPusat)).toBe(true)
  })

  it('role lain di Kantor Pusat tidak dibatasi', () => {
    for (const app of ALL_APPS) expect(hasAppAccess('developer', app, null, kantorPusat)).toBe(true)
    expect(hasAppAccess('admin_hr', 'HR', null, kantorPusat)).toBe(true)
    expect(hasAppAccess('admin_finance', 'finance', null, kantorPusat)).toBe(true)
    expect(hasAppAccess('purchasing', 'stok', null, kantorPusat)).toBe(true)
  })

  it('pemanggil tanpa lokasi tetap memakai matriks biasa', () => {
    expect(hasAppAccess('crew', 'pos-kasir')).toBe(true)
    expect(accessibleApps('staff_pusat')).toEqual(['absensi', 'marcom'])
  })
})
