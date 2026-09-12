import { describe, it, expect } from 'vitest'
import { alokasiAwal, validasiAlokasi, type SaldoVendor } from './alokasiVendor'

const dj: SaldoVendor = { vendor_id: 'dj', vendor_nama: 'Djafafood', sisa: 3, aktif: true }
const az: SaldoVendor = { vendor_id: 'az', vendor_nama: 'Pak Aziz', sisa: 4, aktif: true }

describe('alokasiAwal', () => {
  it('satu vendor → semua ke vendor itu', () => {
    expect(alokasiAwal(5, [dj])).toEqual([{ vendor_id: 'dj', qty: 5 }])
  })
  it('multi: vendor bersisa terbanyak yang cukup', () => {
    expect(alokasiAwal(4, [dj, az])).toEqual([{ vendor_id: 'az', qty: 4 }])
  })
  it('multi: tak ada yang cukup → kosong (kitchen harus pecah)', () => {
    expect(alokasiAwal(5, [dj, az])).toEqual([])
  })
  it('belum aktif → kosong, wajib pilih manual', () => {
    expect(alokasiAwal(1, [{ ...dj, aktif: false }, { ...az, aktif: false }])).toEqual([])
  })
})

describe('validasiAlokasi', () => {
  it('bahan satu/tanpa vendor → selalu lolos', () => {
    expect(validasiAlokasi(5, [], [dj])).toBeNull()
    expect(validasiAlokasi(5, [], [])).toBeNull()
  })
  it('multi tanpa alokasi → wajib pilih', () => {
    expect(validasiAlokasi(5, [], [dj, az])).toMatch(/Pilih vendor/)
  })
  it('pecah 3+2 pas → lolos', () => {
    expect(validasiAlokasi(5, [{ vendor_id: 'dj', qty: 3 }, { vendor_id: 'az', qty: 2 }], [dj, az])).toBeNull()
  })
  it('total tak pas → ditolak', () => {
    expect(validasiAlokasi(5, [{ vendor_id: 'dj', qty: 3 }], [dj, az])).toMatch(/belum sama/)
  })
  it('melebihi sisa vendor aktif → ditolak', () => {
    expect(validasiAlokasi(4, [{ vendor_id: 'dj', qty: 4 }], [dj, az])).toMatch(/Sisa Djafafood tinggal 3/)
  })
  it('vendor belum aktif → sisa tidak dicek', () => {
    expect(validasiAlokasi(9, [{ vendor_id: 'dj', qty: 9 }], [{ ...dj, aktif: false }, az])).toBeNull()
  })
  it('vendor ganda / qty ≤ 0 / vendor asing → ditolak', () => {
    expect(validasiAlokasi(2, [{ vendor_id: 'dj', qty: 1 }, { vendor_id: 'dj', qty: 1 }], [dj, az])).toMatch(/dua kali/)
    expect(validasiAlokasi(2, [{ vendor_id: 'dj', qty: 2 }, { vendor_id: 'az', qty: 0 }], [dj, az])).toMatch(/lebih dari 0/)
    expect(validasiAlokasi(2, [{ vendor_id: 'x', qty: 2 }], [dj, az])).toMatch(/tidak dikenal/)
  })
})
