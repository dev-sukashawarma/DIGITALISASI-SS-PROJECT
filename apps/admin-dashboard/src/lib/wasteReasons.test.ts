import { describe, it, expect } from 'vitest'
import {
  CANONICAL_WASTE_REASONS,
  CLAIMABLE_REASON,
  OTHER_MANUAL_REASON,
  normalizeReason,
  isClaimableReason,
  countFreeTextIncidents,
} from './wasteReasons'

describe('CANONICAL_WASTE_REASONS', () => {
  it('berisi 8 opsi kategori SOP standar tanpa Lainnya', () => {
    expect(CANONICAL_WASTE_REASONS).toEqual([
      'Trimming / Bonggol',
      'Gosong / Rusak Masak',
      'Basi / Expired',
      'Rusak Fisik / Sobek',
      'Sisa Produksi / Adonan',
      'Jatuh / Tumpah',
      'Pesanan Dibatalkan',
      'Kualitas Buruk (dari supplier)',
    ])
    expect(CANONICAL_WASTE_REASONS).not.toContain('Lainnya')
  })

  it('CLAIMABLE_REASON adalah salah satu nilai kanonik', () => {
    expect(CANONICAL_WASTE_REASONS).toContain(CLAIMABLE_REASON)
  })
})

describe('normalizeReason', () => {
  it('membiarkan 8 nilai kanonik kembali apa adanya', () => {
    for (const r of CANONICAL_WASTE_REASONS) {
      expect(normalizeReason(r)).toBe(r)
    }
  })

  it('mengelompokkan variasi bonggol/trimming sayur ke Trimming / Bonggol', () => {
    expect(normalizeReason('Bonggol')).toBe('Trimming / Bonggol')
    expect(normalizeReason('Bongol')).toBe('Trimming / Bonggol')
    expect(normalizeReason('Bogol')).toBe('Trimming / Bonggol')
    expect(normalizeReason('Bongkol sayur')).toBe('Trimming / Bonggol')
    expect(normalizeReason('Batang sayur')).toBe('Trimming / Bonggol')
    expect(normalizeReason('Bongol dan daun busuk')).toBe('Trimming / Bonggol')
  })

  it('mengelompokkan variasi cacat supplier ke Kualitas Buruk (dari supplier)', () => {
    expect(normalizeReason('Kualitas Buruk')).toBe(CLAIMABLE_REASON)
    expect(normalizeReason('Kualitas Buruk (dari supplier)\nrusak dalam pack / patah')).toBe(
      CLAIMABLE_REASON
    )
    expect(normalizeReason('Rusak dari suplayer')).toBe(CLAIMABLE_REASON)
    expect(isClaimableReason('Kualitas Buruk')).toBe(true)
    expect(isClaimableReason('Bonggol')).toBe(false)
  })

  it('mengelompokkan sisa produksi & tepung bekas chicken ke Sisa Produksi / Adonan', () => {
    expect(normalizeReason('Bekas chicken')).toBe('Sisa Produksi / Adonan')
    expect(normalizeReason('Frdchiken')).toBe('Sisa Produksi / Adonan')
    expect(normalizeReason('Sisa')).toBe('Sisa Produksi / Adonan')
  })

  it('mengelompokkan kerusakan fisik bahan ke Rusak Fisik / Sobek', () => {
    expect(normalizeReason('Rusak')).toBe('Rusak Fisik / Sobek')
    expect(normalizeReason('Ruksak')).toBe('Rusak Fisik / Sobek')
    expect(normalizeReason('Kering dan menempel jadi sobek')).toBe('Rusak Fisik / Sobek')
    expect(normalizeReason('kulit retak')).toBe('Rusak Fisik / Sobek')
  })

  it('mengelompokkan pembatalan order ke Pesanan Dibatalkan', () => {
    expect(normalizeReason('Pesanan dibatalkan')).toBe('Pesanan Dibatalkan')
    expect(normalizeReason('Cancel orderan online')).toBe('Pesanan Dibatalkan')
  })

  it('mengelompokkan variasi basi/layu/berbau ke Basi / Expired', () => {
    expect(normalizeReason('Basi dan berubah warna')).toBe('Basi / Expired')
    expect(normalizeReason('sudah berbau')).toBe('Basi / Expired')
    expect(normalizeReason('BASI / EXPIRED')).toBe('Basi / Expired')
  })

  it('menampung teks di luar 8 kategori SOP dan data historis ke Alasan Manual Lainnya (tidak ada baris yang hilang)', () => {
    expect(normalizeReason('Waste')).toBe(OTHER_MANUAL_REASON)
    expect(normalizeReason('Lainnya')).toBe(OTHER_MANUAL_REASON)
    expect(normalizeReason('lainnya')).toBe(OTHER_MANUAL_REASON)
    expect(normalizeReason('Tester')).toBe(OTHER_MANUAL_REASON)
    expect(normalizeReason('')).toBe(OTHER_MANUAL_REASON)
  })
})

describe('countFreeTextIncidents', () => {
  const row = (reason: string, jumlah_insiden: number) => ({ reason, jumlah_insiden })

  it('menghitung insiden yang masuk ke Alasan Manual Lainnya', () => {
    expect(
      countFreeTextIncidents([
        row('Tester', 5),
        row('Lainnya', 9),
        row('Bonggol', 15), // dipetakan ke Trimming / Bonggol -> bukan manual liar
        row('Basi / Expired', 3),
      ])
    ).toBe(14)
  })

  it('mengembalikan 0 kalau semua reason terpetakan ke 8 kategori SOP', () => {
    expect(
      countFreeTextIncidents([
        row('Bonggol', 15),
        row('Gosong / Rusak Masak', 11),
        row('Kualitas Buruk', 1),
      ])
    ).toBe(0)
  })

  it('mengembalikan 0 untuk input kosong', () => {
    expect(countFreeTextIncidents([])).toBe(0)
  })
})
