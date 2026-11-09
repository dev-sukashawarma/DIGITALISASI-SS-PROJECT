import { describe, it, expect } from 'vitest'
import { SATUAN_BAKU, KATEGORI_RESMI, opsiPilihan } from './daftarPilihan'

describe('daftar resmi', () => {
  it('satuan baku mencakup semua satuan yang dipakai bahan aktif', () => {
    const dipakai = ['bal', 'blok', 'box', 'bungkus', 'cm', 'dus', 'galon', 'gram', 'kg', 'kompan', 'lembar',
      'liter', 'ml', 'pack', 'pcs', 'roll', 'sachet', 'tabung', 'unit', 'ikat']
    const kanon = SATUAN_BAKU.map((s) => s.toLowerCase())
    for (const s of dipakai) expect(kanon).toContain(s)
  })
  it('tidak ada satuan kembar beda huruf', () => {
    const kanon = SATUAN_BAKU.map((s) => s.toLowerCase())
    expect(new Set(kanon).size).toBe(kanon.length)
  })
  it('kategori resmi = enam nilai yang dipakai app stok', () => {
    expect(KATEGORI_RESMI).toEqual(['FOOD & BEVERAGE', 'BUMBU', 'PACKAGING', 'OPERASIONAL', 'ASET', 'PERLENGKAPAN'])
  })
})

describe('opsiPilihan', () => {
  const daftar = ['Dus', 'Kg', 'gram']
  it('kosong: daftar apa adanya', () => {
    expect(opsiPilihan(daftar, '')).toEqual([
      { nilai: 'Dus', label: 'Dus' }, { nilai: 'Kg', label: 'Kg' }, { nilai: 'gram', label: 'gram' },
    ])
  })
  it('nilai tersimpan beda huruf dipetakan ke opsi yang sama, nilainya dipertahankan persis', () => {
    // supaya membuka form tidak dianggap "mengubah" satuan (kg -> Kg)
    expect(opsiPilihan(daftar, 'kg')).toEqual([
      { nilai: 'Dus', label: 'Dus' }, { nilai: 'kg', label: 'Kg' }, { nilai: 'gram', label: 'gram' },
    ])
  })
  it('nilai lama di luar daftar tetap muncul, ditandai (lama)', () => {
    expect(opsiPilihan(daftar, 'crt')).toEqual([
      { nilai: 'Dus', label: 'Dus' }, { nilai: 'Kg', label: 'Kg' }, { nilai: 'gram', label: 'gram' },
      { nilai: 'crt', label: 'crt (lama)' },
    ])
  })
})
