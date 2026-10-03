import { describe, it, expect } from 'vitest'
import { adalahTipeOutlet, labelNonOutlet } from './outletType'

describe('adalahTipeOutlet', () => {
  it('hanya internal dan mitra yang tipe outlet', () => {
    expect(adalahTipeOutlet('internal')).toBe(true)
    expect(adalahTipeOutlet('mitra')).toBe(true)
  })

  it('menolak nilai lama, salah ketik, dan lokasi non-outlet', () => {
    for (const t of ['outlet', 'MITRA ', 'Mitra', 'gudang', 'test', '', null, undefined]) {
      expect(adalahTipeOutlet(t)).toBe(false)
    }
  })
})

describe('labelNonOutlet', () => {
  it('memberi label lokasi non-outlet', () => {
    expect(labelNonOutlet('gudang')).toBe('Gudang')
    expect(labelNonOutlet('marketplace')).toBe('Marketplace')
  })

  it('tipe tak dikenal tampil apa adanya', () => {
    expect(labelNonOutlet('lainnya')).toBe('lainnya')
    expect(labelNonOutlet(null)).toBe('Tanpa tipe')
  })
})
