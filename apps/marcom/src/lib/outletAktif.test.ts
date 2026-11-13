import { describe, expect, it } from 'vitest'
import { aktifDiMarcom } from './outletAktif'

describe('aktifDiMarcom', () => {
  it('outlet berstatus Persiapan dianggap aktif di Marcom (biaya opening dicatat sebelum Go-Live)', () => {
    expect(aktifDiMarcom({ is_active: false, status: 'pending' })).toBe(true)
  })
  it('outlet aktif aktif, outlet nonaktif tidak', () => {
    expect(aktifDiMarcom({ is_active: true, status: 'active' })).toBe(true)
    expect(aktifDiMarcom({ is_active: false, status: 'inactive' })).toBe(false)
  })
  it('tanpa nilai is_active dianggap aktif (perilaku lama)', () => {
    expect(aktifDiMarcom({})).toBe(true)
  })
})
