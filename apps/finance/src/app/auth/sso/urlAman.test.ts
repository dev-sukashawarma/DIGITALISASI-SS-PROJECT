import { describe, it, expect } from 'vitest'
import { safeInternalPath, searchTanpaToken } from './urlAman'

const ORIGIN = 'https://finance.sukashawarma.com'

describe('safeInternalPath (Finance SSO)', () => {
  it('menerima /approval dan path internal sah', () => {
    expect(safeInternalPath('/approval', ORIGIN)).toBe('/approval')
    expect(safeInternalPath('/approval?tab=menunggu', ORIGIN)).toBe('/approval?tab=menunggu')
  })

  it('jatuh ke /approval bila kosong atau mencoba open-redirect', () => {
    expect(safeInternalPath(null, ORIGIN)).toBe('/approval')
    expect(safeInternalPath('', ORIGIN)).toBe('/approval')
    expect(safeInternalPath('https://evil.com', ORIGIN)).toBe('/approval')
    expect(safeInternalPath('//evil.com', ORIGIN)).toBe('/approval')
    expect(safeInternalPath('/\\evil.com', ORIGIN)).toBe('/approval')
  })
})

describe('searchTanpaToken (Finance SSO)', () => {
  it('menghapus token_hash dan access/refresh token dari query string namun menjaga next', () => {
    expect(searchTanpaToken('?token_hash=rahasia&next=%2Fapproval')).toBe('?next=%2Fapproval')
    expect(searchTanpaToken('?access_token=a&refresh_token=b&next=%2Fapproval')).toBe('?next=%2Fapproval')
    expect(searchTanpaToken('?tokenHash=rahasia')).toBe('')
  })
})
