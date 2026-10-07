import { describe, it, expect } from 'vitest'
import { tanggalWib, menitWib, batasWib, tambahHari, daftarTanggal } from './waktu'

describe('waktu WIB', () => {
  it('tanggalWib memakai +07:00, bukan zona server', () => {
    expect(tanggalWib(new Date('2026-10-07T16:59:00Z'))).toBe('2026-10-07')
    expect(tanggalWib(new Date('2026-10-07T17:00:00Z'))).toBe('2026-10-08')
  })
  it('menitWib', () => {
    expect(menitWib('2026-10-07T06:15:00Z')).toBe(13 * 60 + 15)
    expect(menitWib('2026-10-07T13:15:00+07:00')).toBe(13 * 60 + 15)
  })
  it('batasWib = tanggal + jam WIB + menit tambahan', () => {
    expect(batasWib('2026-10-07', '13:00', 15).toISOString()).toBe('2026-10-07T06:15:00.000Z')
    expect(batasWib('2026-10-07', '23:50:00', 15).toISOString()).toBe('2026-10-07T17:05:00.000Z')
  })
  it('tambahHari & daftarTanggal lintas bulan', () => {
    expect(tambahHari('2026-09-30', 1)).toBe('2026-10-01')
    expect(daftarTanggal('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(daftarTanggal('2026-10-02', '2026-10-01')).toEqual([])
  })
})
