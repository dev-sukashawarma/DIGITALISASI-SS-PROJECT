import { describe, expect, it } from 'vitest'
import { jarakJejakKm, masihAdaJejak } from './jejak'

describe('jarakJejakKm', () => {
  it('kosong atau satu titik = 0', () => {
    expect(jarakJejakKm([])).toBe(0)
    expect(jarakJejakKm([{ lat: -6.6, lng: 106.8, direkam_at: '' }])).toBe(0)
  })
  it('dua ruas 0,01° lintang ≈ 2,22 km', () => {
    const km = jarakJejakKm([
      { lat: -6.6, lng: 106.8, direkam_at: '' },
      { lat: -6.61, lng: 106.8, direkam_at: '' },
      { lat: -6.62, lng: 106.8, direkam_at: '' },
    ])
    expect(km).toBeGreaterThan(2.2)
    expect(km).toBeLessThan(2.25)
  })
})

describe('masihAdaJejak', () => {
  const now = new Date('2026-10-27T03:00:00Z')
  it('jejak tersimpan 60 hari', () => {
    expect(masihAdaJejak('2026-08-29T03:00:00Z', now)).toBe(true) // 59 hari
    expect(masihAdaJejak('2026-08-27T03:00:00Z', now)).toBe(false) // 61 hari
  })
})
