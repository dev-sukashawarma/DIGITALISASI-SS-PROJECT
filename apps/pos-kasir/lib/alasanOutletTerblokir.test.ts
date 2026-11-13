import { describe, expect, it } from 'vitest'
import { alasanOutletTerblokir } from './alasanOutletTerblokir'

describe('alasanOutletTerblokir', () => {
  it('outlet berstatus Persiapan: pesan belum dibuka', () => {
    expect(alasanOutletTerblokir({ is_active: false, status: 'pending', inactive_reason: null })).toBe(
      'Outlet ini belum dibuka (status Persiapan). Kasir aktif setelah Go-Live.',
    )
  })

  it('outlet nonaktif: memakai alasan dari admin bila ada', () => {
    expect(alasanOutletTerblokir({ is_active: false, status: 'inactive', inactive_reason: 'Renovasi' })).toBe('Renovasi')
  })

  it('outlet nonaktif tanpa alasan: pesan bawaan', () => {
    expect(alasanOutletTerblokir({ is_active: false, status: 'inactive', inactive_reason: null })).toBe(
      'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.',
    )
  })

  it('outlet aktif: tidak terblokir', () => {
    expect(alasanOutletTerblokir({ is_active: true, status: 'active' })).toBeNull()
    expect(alasanOutletTerblokir(null)).toBeNull()
  })
})
