import { describe, expect, it } from 'vitest'
import { barangMasukStok, validasiBarisTerima } from './terimaPo'

describe('barangMasukStok', () => {
  it('datang dikurangi ditolak', () => {
    expect(barangMasukStok(10, 3)).toBe(7)
  })
  it('tidak pernah minus', () => {
    expect(barangMasukStok(2, 5)).toBe(0)
  })
})

describe('validasiBarisTerima', () => {
  it('ditolak melebihi datang', () => {
    expect(validasiBarisTerima({ datang: 2, ditolak: 3, alasanTolak: 'rusak' })).toBe('Jumlah ditolak melebihi jumlah datang')
  })
  it('ditolak tanpa alasan', () => {
    expect(validasiBarisTerima({ datang: 5, ditolak: 1, alasanTolak: null })).toBe('Pilih alasan penolakan')
  })
  it('baris valid', () => {
    expect(validasiBarisTerima({ datang: 5, ditolak: 1, alasanTolak: 'kualitas_tidak_sesuai' })).toBeNull()
    expect(validasiBarisTerima({ datang: 5, ditolak: 0, alasanTolak: null })).toBeNull()
  })
})
