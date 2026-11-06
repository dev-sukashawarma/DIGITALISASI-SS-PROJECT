import { describe, it, expect } from 'vitest'
import {
  CANONICAL_WASTE_REASONS,
  CLAIMABLE_REASON,
  normalizeReason,
  countFreeTextIncidents,
} from './wasteReasons'

describe('CANONICAL_WASTE_REASONS', () => {
  it('berisi persis 4 opsi dropdown WasteModal.tsx (Lainnya sudah dihapus dari form)', () => {
    expect(CANONICAL_WASTE_REASONS).toEqual([
      'Basi / Expired',
      'Jatuh / Tumpah',
      'Gosong / Rusak Masak',
      'Kualitas Buruk (dari supplier)',
    ])
  })

  it('tidak lagi mengandung Lainnya', () => {
    expect(CANONICAL_WASTE_REASONS).not.toContain('Lainnya')
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

  it('mengembalikan null untuk literal fallback ManualEntryForm ("Waste")', () => {
    expect(normalizeReason('Waste')).toBeNull()
  })

  it('mengembalikan null untuk catatan bebas yang diketik crew', () => {
    expect(normalizeReason('Basi dan berubah warna')).toBeNull()
    expect(normalizeReason('Rusak')).toBeNull()
  })

  it('mengembalikan null untuk "Lainnya" historis (sudah dihapus dari form)', () => {
    expect(normalizeReason('Lainnya')).toBeNull()
  })

  it('mengembalikan null untuk string kosong', () => {
    expect(normalizeReason('')).toBeNull()
  })

  it('peka huruf besar-kecil: varian beda kapitalisasi bukan nilai kanonik', () => {
    expect(normalizeReason('lainnya')).toBeNull()
    expect(normalizeReason('BASI / EXPIRED')).toBeNull()
  })
})

describe('countFreeTextIncidents', () => {
  const row = (reason: string, jumlah_insiden: number) => ({ reason, jumlah_insiden })

  it('menghitung insiden non-kanonik, bukan jumlah baris', () => {
    expect(
      countFreeTextIncidents([
        row('Waste', 5),
        row('Rusak', 1),
        row('Lainnya', 9),       // 'Lainnya' sekarang non-kanonik
        row('Basi / Expired', 3),
      ])
    ).toBe(15) // 5 + 1 + 9 = 15 (semua non-kanonik kecuali 'Basi / Expired')
  })

  it('mengembalikan 0 kalau semua reason kanonik', () => {
    expect(
      countFreeTextIncidents([row('Jatuh / Tumpah', 4), row('Gosong / Rusak Masak', 2)])
    ).toBe(0)
  })

  it('mengembalikan 0 untuk input kosong', () => {
    expect(countFreeTextIncidents([])).toBe(0)
  })
})
