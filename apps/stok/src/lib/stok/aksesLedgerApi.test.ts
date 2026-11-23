import { describe, it, expect } from 'vitest'
import { bolehInvalidasiSemuaOutlet, statusHttpGalatAkses } from './aksesLedgerApi'

describe('bolehInvalidasiSemuaOutlet', () => {
  it('role pusat (akses semua outlet) boleh mengosongkan cache semua outlet', () => {
    for (const role of ['admin', 'owner', 'kitchen', 'purchasing', 'developer', 'admin_finance', 'spv', 'regional_manager']) {
      expect(bolehInvalidasiSemuaOutlet(role)).toBe(true)
    }
  })

  it('role ber-scope outlet tidak boleh', () => {
    for (const role of ['crew', 'leader', 'korlap', 'area_manager', 'kasir', 'mitra', null, undefined, '']) {
      expect(bolehInvalidasiSemuaOutlet(role)).toBe(false)
    }
  })
})

describe('statusHttpGalatAkses', () => {
  it('galat database → 500, selain itu (forbidden / staff tidak aktif) → 403', () => {
    expect(statusHttpGalatAkses(new Error('DB error: timeout'))).toBe(500)
    expect(statusHttpGalatAkses(new Error('Forbidden: outlet di luar scope akses Anda'))).toBe(403)
    expect(statusHttpGalatAkses(new Error('Staff tidak aktif atau tidak ditemukan'))).toBe(403)
    expect(statusHttpGalatAkses('aneh')).toBe(403)
  })
})
