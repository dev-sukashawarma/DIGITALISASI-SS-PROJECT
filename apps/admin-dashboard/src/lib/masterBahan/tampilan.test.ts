import { describe, it, expect } from 'vitest'
import { ringkasSatuan, ringkasSatuanKirim, ringkasSatuanOpname, kapital, labelKategori } from './tampilan'

const dasar = { satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_tampilan: 1000 }

describe('ringkasSatuan', () => {
  it('dua tingkat: 1 besar = isi kecil', () => {
    expect(ringkasSatuan(dasar)).toBe('1 Kg = 1.000 Gram')
  })
  it('tiga tingkat: sebut tengah dan kecil', () => {
    expect(ringkasSatuan({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', faktor_tampilan: 36480 }))
      .toBe('1 Dus = 48 Roll = 36.480 cm')
  })
  it('satu tingkat: hanya nama satuan', () => {
    expect(ringkasSatuan({ ...dasar, satuan: 'Pcs', satuan_kecil: null, faktor_tampilan: null })).toBe('Pcs')
  })
  it('kecil sama dengan besar dan isi 1: tidak diulang', () => {
    expect(ringkasSatuan({ ...dasar, satuan: 'Pcs', satuan_kecil: 'pcs', faktor_tampilan: 1 })).toBe('Pcs')
  })
  it('faktor tak valid: hanya satuan besar', () => {
    expect(ringkasSatuan({ ...dasar, faktor_tampilan: 0 })).toBe('Kg')
  })
})

describe('kapital & labelKategori', () => {
  it('kapital huruf pertama saja', () => {
    expect(kapital('roll')).toBe('Roll')
    expect(kapital('')).toBe('')
  })
  it('kategori diseragamkan huruf besar', () => {
    expect(labelKategori('  minuman ')).toBe('MINUMAN')
    expect(labelKategori(null)).toBe('—')
  })
})

const foil = { satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', faktor_tampilan: 36480 }

describe('ringkasSatuanKirim', () => {
  it('kirim per satuan tengah: sebut isinya dalam satuan kecil', () => {
    expect(ringkasSatuanKirim({ ...foil, satuan_distribusi: 'roll' }))
      .toEqual({ label: 'Roll', isi: '760 cm', dikenal: true, bawaan: false })
  })
  it('kirim per satuan besar: tanpa isi tambahan', () => {
    expect(ringkasSatuanKirim({ ...foil, satuan_distribusi: 'Dus' }))
      .toEqual({ label: 'Dus', isi: null, dikenal: true, bawaan: false })
  })
  it('kosong: ikut satuan besar dan ditandai bawaan', () => {
    expect(ringkasSatuanKirim({ ...foil, satuan_distribusi: '  ' }))
      .toEqual({ label: 'Dus', isi: null, dikenal: true, bawaan: true })
  })
  it('kg pada bahan bergram: isi 1.000 gram', () => {
    expect(ringkasSatuanKirim({ ...dasar, satuan: 'Bal', satuan_kecil: 'gram', faktor_tampilan: 20000, satuan_distribusi: 'kg' }))
      .toEqual({ label: 'Kg', isi: '1.000 gram', dikenal: true, bawaan: false })
  })
  it('label tak cocok tingkat mana pun: tidak dikenal', () => {
    expect(ringkasSatuanKirim({ ...foil, satuan_distribusi: 'karung' }))
      .toEqual({ label: 'Karung', isi: null, dikenal: false, bawaan: false })
  })
})

describe('ringkasSatuanOpname', () => {
  it('tiga tingkat berurutan besar → kecil', () => {
    expect(ringkasSatuanOpname({ ...foil, is_opname: true })).toBe('Dus · Roll · cm')
  })
  it('satuan kembar tidak diulang', () => {
    expect(ringkasSatuanOpname({ ...dasar, satuan: 'Pcs', satuan_kecil: 'pcs', faktor_tampilan: 1, is_opname: true })).toBe('Pcs')
  })
  it('tidak diopname: null', () => {
    expect(ringkasSatuanOpname({ ...foil, is_opname: false })).toBeNull()
  })
})
