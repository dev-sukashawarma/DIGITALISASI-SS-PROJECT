import { describe, it, expect } from 'vitest'
import { alasanDitolak, cocokPeriode, poSebelumKasBersih } from './tagihanVendor'

describe('tagihanVendor', () => {
  it('PO sebelum 1 Nov 2026 = lama', () => {
    expect(poSebelumKasBersih('2026-10-31')).toBe(true)
    expect(poSebelumKasBersih('2026-10-31T23:00:00')).toBe(true)
    expect(poSebelumKasBersih('2026-11-01')).toBe(false)
    expect(poSebelumKasBersih(null)).toBe(false)
  })

  it('mengambil alasan penolakan dari catatan transaksi', () => {
    expect(alasanDitolak('catatan purchasing · [Ditolak: nominal tidak sesuai invoice]')).toBe('nominal tidak sesuai invoice')
    expect(alasanDitolak('[Ditolak: salah vendor]')).toBe('salah vendor')
    expect(alasanDitolak('biasa saja')).toBeNull()
    expect(alasanDitolak(null)).toBeNull()
  })

  it('filter periode', () => {
    expect(cocokPeriode('2026-09-07', 'lama')).toBe(true)
    expect(cocokPeriode('2026-09-07', 'baru')).toBe(false)
    expect(cocokPeriode('2026-11-07', 'baru')).toBe(true)
    expect(cocokPeriode('2026-11-07', 'semua')).toBe(true)
  })
})
