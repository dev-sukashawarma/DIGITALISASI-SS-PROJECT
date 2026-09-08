import { describe, it, expect } from 'vitest'
import {
  computeDeltaPct,
  computeWastePctOmzet,
  aggregateByBahanWithSpread,
  type WasteSummaryRow,
} from './wasteMetrics'

const row = (over: Partial<WasteSummaryRow>): WasteSummaryRow => ({
  outlet_id: 'o1',
  outlet_name: 'Outlet 1',
  bahan_baku_id: 'b1',
  bahan_nama: 'KEJU',
  reason: 'Basi / Expired',
  tanggal: '2026-08-01',
  qty: 1,
  qty_kecil: 10,
  satuan_kecil: 'Lembar',
  hpp_kecil: 1000,
  nilai: 10000,
  jumlah_insiden: 1,
  ...over,
})

describe('computeDeltaPct', () => {
  it('naik 50% ketika 100 -> 150', () => {
    expect(computeDeltaPct(150, 100)).toBe(50)
  })

  it('turun 25% ketika 100 -> 75', () => {
    expect(computeDeltaPct(75, 100)).toBe(-25)
  })

  it('mengembalikan null ketika periode sebelumnya nol (bukan Infinity)', () => {
    expect(computeDeltaPct(150, 0)).toBeNull()
  })

  it('mengembalikan 0 ketika keduanya sama', () => {
    expect(computeDeltaPct(100, 100)).toBe(0)
  })
})

describe('computeWastePctOmzet', () => {
  it('menghitung 2% dari 20.000 waste atas 1.000.000 omzet', () => {
    expect(computeWastePctOmzet(20_000, 1_000_000)).toBe(2)
  })

  it('mengembalikan null ketika omzet nol (bukan Infinity)', () => {
    expect(computeWastePctOmzet(20_000, 0)).toBeNull()
  })

  it('mengembalikan null ketika omzet negatif', () => {
    expect(computeWastePctOmzet(20_000, -5)).toBeNull()
  })
})

describe('aggregateByBahanWithSpread', () => {
  it('menjumlahkan nilai per bahan dan mengurutkan menurun', () => {
    const out = aggregateByBahanWithSpread([
      row({ bahan_baku_id: 'b1', bahan_nama: 'KEJU', nilai: 100 }),
      row({ bahan_baku_id: 'b2', bahan_nama: 'SAPI', nilai: 500 }),
      row({ bahan_baku_id: 'b1', bahan_nama: 'KEJU', nilai: 50 }),
    ])
    expect(out.map((b) => b.name)).toEqual(['SAPI', 'KEJU'])
    expect(out[1].nilai).toBe(150)
  })

  it('menghitung sebaran outlet unik, bukan jumlah baris', () => {
    const out = aggregateByBahanWithSpread([
      row({ outlet_id: 'o1', nilai: 10 }),
      row({ outlet_id: 'o1', nilai: 10 }),
      row({ outlet_id: 'o2', nilai: 10 }),
    ])
    expect(out[0].outletCount).toBe(2)
  })

  it('menjumlahkan qty_kecil dan mempertahankan satuan', () => {
    const out = aggregateByBahanWithSpread([
      row({ qty_kecil: 4, satuan_kecil: 'Lembar' }),
      row({ qty_kecil: 6, satuan_kecil: 'Lembar' }),
    ])
    expect(out[0].qty_kecil).toBe(10)
    expect(out[0].satuan_kecil).toBe('Lembar')
  })

  it('mengembalikan array kosong untuk input kosong', () => {
    expect(aggregateByBahanWithSpread([])).toEqual([])
  })
})
