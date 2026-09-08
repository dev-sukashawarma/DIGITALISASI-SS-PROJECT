import { describe, it, expect } from 'vitest'
import {
  CANONICAL_WASTE_REASONS,
  CLAIMABLE_REASON,
  normalizeReason,
  countFreeTextIncidents,
} from './wasteReasons'

describe('CANONICAL_WASTE_REASONS', () => {
  it('berisi persis 5 opsi dropdown WasteModal.tsx', () => {
    expect(CANONICAL_WASTE_REASONS).toEqual([
      'Basi / Expired',
      'Jatuh / Tumpah',
      'Gosong / Rusak Masak',
      'Kualitas Buruk (dari supplier)',
      'Lainnya',
    ])
  })

  it('CLAIMABLE_REASON adalah salah satu nilai kanonik', () => {
    expect(CANONICAL_WASTE_REASONS).toContain(CLAIMABLE_REASON)
  })
})

describe('normalizeReason', () => {
  it('membiarkan nilai kanonik apa adanya', () => {
    for (const r of CANONICAL_WASTE_REASONS) {
      expect(normalizeReason(r)).toBe(r)
    }
  })

  it('melipat literal fallback ManualEntryForm ("Waste") ke Lainnya', () => {
    expect(normalizeReason('Waste')).toBe('Lainnya')
  })

  it('melipat catatan bebas yang diketik crew ke Lainnya', () => {
    expect(normalizeReason('Basi dan berubah warna')).toBe('Lainnya')
    expect(normalizeReason('Rusak')).toBe('Lainnya')
  })

  it('melipat string kosong ke Lainnya, bukan membiarkan bar tanpa label', () => {
    expect(normalizeReason('')).toBe('Lainnya')
  })

  it('peka huruf besar-kecil: varian beda kapitalisasi bukan nilai kanonik', () => {
    // Data nyata memakai kapitalisasi persis dropdown; varian lain berarti
    // penulis lain, jadi memang harus jatuh ke Lainnya.
    expect(normalizeReason('lainnya')).toBe('Lainnya')
    expect(normalizeReason('BASI / EXPIRED')).toBe('Lainnya')
  })
})

describe('countFreeTextIncidents', () => {
  const row = (reason: string, jumlah_insiden: number) => ({ reason, jumlah_insiden })

  it('menghitung insiden non-kanonik, bukan jumlah baris', () => {
    expect(
      countFreeTextIncidents([
        row('Waste', 5),
        row('Rusak', 1),
        row('Lainnya', 9),
        row('Basi / Expired', 3),
      ])
    ).toBe(6)
  })

  it('mengembalikan 0 kalau semua reason kanonik', () => {
    expect(
      countFreeTextIncidents([row('Lainnya', 4), row('Jatuh / Tumpah', 2)])
    ).toBe(0)
  })

  it('mengembalikan 0 untuk input kosong', () => {
    expect(countFreeTextIncidents([])).toBe(0)
  })
})
