import { describe, it, expect } from 'vitest'
import {
  wibDateHour,
  sameWeekdayOccurrences,
  baseLabel,
  prevWibDate,
  formatWibDateHuman,
} from './period'

describe('wibDateHour', () => {
  it('mengubah UTC ke tanggal & jam WIB', () => {
    // 2026-09-03T07:30:00Z = 14:30 WIB, 3 September
    expect(wibDateHour(new Date('2026-09-03T07:30:00Z'))).toEqual({
      date: '2026-09-03',
      hour: 14,
    })
  })

  it('malam UTC sudah masuk hari berikutnya di WIB', () => {
    // 2026-09-03T18:00:00Z = 01:00 WIB, 4 September
    expect(wibDateHour(new Date('2026-09-03T18:00:00Z'))).toEqual({
      date: '2026-09-04',
      hour: 1,
    })
  })
})

describe('prevWibDate', () => {
  it('mengambil tanggal H-1 dengan benar', () => {
    expect(prevWibDate('2026-09-05')).toBe('2026-09-04')
  })

  it('pergantian bulan mundur ke akhir bulan sebelumnya', () => {
    expect(prevWibDate('2026-09-01')).toBe('2026-08-31')
  })

  it('pergantian tahun mundur ke 31 Desember', () => {
    expect(prevWibDate('2027-01-01')).toBe('2026-12-31')
  })
})

describe('formatWibDateHuman', () => {
  it('memformat tanggal ke format lengkap bahasa Indonesia', () => {
    expect(formatWibDateHuman('2026-09-04')).toBe('Jumat, 4 September 2026')
    expect(formatWibDateHuman('2026-09-05')).toBe('Sabtu, 5 September 2026')
  })
})

describe('sameWeekdayOccurrences', () => {
  it('Kamis 3 September 2026 -> semua Kamis Agustus 2026', () => {
    expect(sameWeekdayOccurrences('2026-09-03')).toEqual([
      '2026-08-06',
      '2026-08-13',
      '2026-08-20',
      '2026-08-27',
    ])
  })

  it('bulan dengan 5 kemunculan hari yang sama semuanya ikut', () => {
    // Sabtu 5 September 2026 -> Agustus 2026 punya 5 hari Sabtu
    expect(sameWeekdayOccurrences('2026-09-05')).toEqual([
      '2026-08-01',
      '2026-08-08',
      '2026-08-15',
      '2026-08-22',
      '2026-08-29',
    ])
  })

  it('membuang kemunculan di bawah lantai data', () => {
    // Bulan pembanding Juli 2026 seluruhnya di bawah lantai 2026-08-01
    expect(sameWeekdayOccurrences('2026-08-06')).toEqual([])
  })

  it('pergantian tahun: Januari membandingkan ke Desember', () => {
    // Kamis 7 Januari 2027 -> Kamis-Kamis Desember 2026
    expect(sameWeekdayOccurrences('2027-01-07')).toEqual([
      '2026-12-03',
      '2026-12-10',
      '2026-12-17',
      '2026-12-24',
      '2026-12-31',
    ])
  })
})

describe('baseLabel', () => {
  it('menyebut nama hari dan nama bulan pembanding', () => {
    expect(baseLabel('2026-09-03')).toBe('rata-rata Kamis Agustus')
  })

  it('pergantian tahun menyebut bulan Desember', () => {
    expect(baseLabel('2027-01-07')).toBe('rata-rata Kamis Desember')
  })
})
