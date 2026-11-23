import { describe, it, expect } from 'vitest'
import { safeInternalPath, searchTanpaToken } from './urlAman'

const ORIGIN = 'https://stok.sukashawarma.com'

describe('safeInternalPath', () => {
  it('path internal biasa lolos', () => {
    expect(safeInternalPath('/stok/opname?x=1', ORIGIN)).toBe('/stok/opname?x=1')
  })
  it('kosong / bukan path → /dashboard', () => {
    expect(safeInternalPath(null, ORIGIN)).toBe('/dashboard')
    expect(safeInternalPath('', ORIGIN)).toBe('/dashboard')
    expect(safeInternalPath('https://evil.com', ORIGIN)).toBe('/dashboard')
    expect(safeInternalPath('javascript:alert(1)', ORIGIN)).toBe('/dashboard')
  })
  it('open redirect lewat // atau backslash ditolak', () => {
    expect(safeInternalPath('//evil.com', ORIGIN)).toBe('/dashboard')
    expect(safeInternalPath('/\\evil.com', ORIGIN)).toBe('/dashboard')
    expect(safeInternalPath('/\\/evil.com', ORIGIN)).toBe('/dashboard')
    expect(safeInternalPath('/stok\\..\\x', ORIGIN)).toBe('/dashboard')
    expect(safeInternalPath('/\t/evil.com', ORIGIN)).toBe('/dashboard')
  })
})

describe('searchTanpaToken', () => {
  it('membuang semua parameter token, mempertahankan next', () => {
    expect(searchTanpaToken('?access_token=a&refresh_token=b&next=%2Fdashboard')).toBe('?next=%2Fdashboard')
    expect(searchTanpaToken('?accessToken=a&refreshToken=b')).toBe('')
  })
  it('tanpa query tetap kosong', () => {
    expect(searchTanpaToken('')).toBe('')
  })
})
