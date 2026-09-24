import { describe, it, expect } from 'vitest'
import { ringkasSatuan, kapital, labelKategori } from './tampilan'

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
