import { describe, it, expect } from 'vitest'
import { bolehUbahData, bolehUbahHarga } from './akses'

describe('akses master bahan (cermin _peran_master)', () => {
  it('data: hanya ADMIN & OWNER', () => {
    expect(bolehUbahData('ADMIN')).toBe(true)
    expect(bolehUbahData('OWNER')).toBe(true)
    for (const r of ['PURCHASING', 'ADMIN_HR', 'MITRA', 'LEADER', 'AREA_MANAGER', '', null, undefined]) {
      expect(bolehUbahData(r)).toBe(false)
    }
  })
  it('harga: ADMIN, OWNER, PURCHASING', () => {
    expect(bolehUbahHarga('ADMIN')).toBe(true)
    expect(bolehUbahHarga('OWNER')).toBe(true)
    expect(bolehUbahHarga('PURCHASING')).toBe(true)
    for (const r of ['ADMIN_HR', 'MITRA', 'LEADER', 'AREA_MANAGER', 'admin', null]) {
      expect(bolehUbahHarga(r)).toBe(false)
    }
  })
})
