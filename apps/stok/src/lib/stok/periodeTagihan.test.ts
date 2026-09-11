import { describe, it, expect } from 'vitest'
import { periodeTagihan, daftarTanggalTagihan } from './periodeTagihan'

// Keputusan owner 2026-09-11: nota Pak Aziz tiap tgl 10, 20, dan HARI TERAKHIR
// bulan (tgl 31 ikut periode 21-31; Februari ditagih 28/29). Spec §4.4.
describe('periodeTagihan', () => {
  it('tgl 1-10 -> ditagih tgl 10', () => {
    expect(periodeTagihan('2026-09-03')).toEqual({ mulai: '2026-09-01', akhir: '2026-09-10', tanggalTagihan: '2026-09-10' })
    expect(periodeTagihan('2026-09-10').tanggalTagihan).toBe('2026-09-10')
  })
  it('tgl 11-20 -> ditagih tgl 20', () => {
    expect(periodeTagihan('2026-09-11')).toEqual({ mulai: '2026-09-11', akhir: '2026-09-20', tanggalTagihan: '2026-09-20' })
  })
  it('tgl 21+ -> hari terakhir bulan', () => {
    expect(periodeTagihan('2026-09-21')).toEqual({ mulai: '2026-09-21', akhir: '2026-09-30', tanggalTagihan: '2026-09-30' })
    expect(periodeTagihan('2026-10-31').tanggalTagihan).toBe('2026-10-31')
  })
  it('Februari: 28 di tahun biasa, 29 di tahun kabisat', () => {
    expect(periodeTagihan('2027-02-25').tanggalTagihan).toBe('2027-02-28')
    expect(periodeTagihan('2028-02-29').tanggalTagihan).toBe('2028-02-29')
  })
  it('menerima timestamp ISO penuh', () => {
    expect(periodeTagihan('2026-09-21T23:10:00+07:00').tanggalTagihan).toBe('2026-09-30')
  })
  it('menolak tanggal tak valid', () => {
    expect(() => periodeTagihan('bukan-tanggal')).toThrow()
  })
})

describe('daftarTanggalTagihan', () => {
  it('periode berjalan dulu, lalu mundur', () => {
    expect(daftarTanggalTagihan('2026-09-25', 4)).toEqual(['2026-09-30', '2026-09-20', '2026-09-10', '2026-08-31'])
  })
  it('melintasi tahun', () => {
    expect(daftarTanggalTagihan('2027-01-05', 2)).toEqual(['2027-01-10', '2026-12-31'])
  })
})
