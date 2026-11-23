import { describe, it, expect } from 'vitest'
import { isRouteAllowed } from './access-control'

describe('access-control Tab Laba Rugi Marcom', () => {
  it('mengizinkan Melani mengakses /dashboard/laba-rugi, internal, dan mitra', () => {
    expect(isRouteAllowed('melani@ss.com', 'MARCOM', '/dashboard/laba-rugi')).toBe(true)
    expect(isRouteAllowed('melani@ss.com', 'MARCOM', '/dashboard/laba-rugi/internal')).toBe(true)
    expect(isRouteAllowed('melani@ss.com', 'MARCOM', '/dashboard/laba-rugi/mitra')).toBe(true)
  })

  it('tetap memblokir rute non-Melani untuk Melani', () => {
    expect(isRouteAllowed('melani@ss.com', 'MARCOM', '/dashboard/budget')).toBe(false)
    expect(isRouteAllowed('melani@ss.com', 'MARCOM', '/dashboard/users')).toBe(false)
  })

  it('memblokir Putri Hambali dan akun MARCOM umum dari /dashboard/laba-rugi', () => {
    expect(isRouteAllowed('putri.hambali@ss.com', 'MARCOM', '/dashboard/laba-rugi')).toBe(false)
    expect(isRouteAllowed('putri.hambali@ss.com', 'MARCOM', '/dashboard/laba-rugi/internal')).toBe(false)
    expect(isRouteAllowed('staff.marcom@ss.com', 'MARCOM', '/dashboard/laba-rugi')).toBe(false)
  })

  it('mengizinkan ADMIN dan developer mengakses /dashboard/laba-rugi', () => {
    expect(isRouteAllowed('owner@ss.com', 'ADMIN', '/dashboard/laba-rugi')).toBe(true)
    expect(isRouteAllowed('dev@ss.com', 'developer', '/dashboard/laba-rugi/mitra')).toBe(true)
  })
})
