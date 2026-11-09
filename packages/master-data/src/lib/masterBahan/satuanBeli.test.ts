import { describe, it, expect } from 'vitest'
import { pilihanSatuanBeli, hargaPerSatuanBesar } from './satuanBeli'

describe('pilihanSatuanBeli (cermin hitung_faktor_po + kg→gram)', () => {
  it('tiga tingkat FOIL', () => {
    expect(pilihanSatuanBeli({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', faktor_tampilan: 36480 }))
      .toEqual([{ label: 'Dus', isi: 36480 }, { label: 'Roll', isi: 760 }, { label: 'cm', isi: 1 }])
  })
  it('bahan gram mendapat kg = 1000', () => {
    expect(pilihanSatuanBeli({ satuan: 'Dus', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram', faktor_tampilan: 16500 }))
      .toEqual([{ label: 'Dus', isi: 16500 }, { label: 'gram', isi: 1 }, { label: 'kg', isi: 1000 }])
  })
  it('tidak menggandakan kg bila Kg sudah jadi tingkat', () => {
    const p = pilihanSatuanBeli({ satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_tampilan: 1000 })
    expect(p).toEqual([{ label: 'Kg', isi: 1000 }, { label: 'Gram', isi: 1 }])
  })
  it('satu tingkat: isi 1', () => {
    expect(pilihanSatuanBeli({ satuan: 'Unit', satuan_tengah: null, faktor_tengah: null, satuan_kecil: null, faktor_tampilan: null }))
      .toEqual([{ label: 'Unit', isi: 1 }])
  })
  it('faktor tak valid tidak menghasilkan isi palsu', () => {
    expect(pilihanSatuanBeli({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 0, satuan_kecil: 'cm', faktor_tampilan: null }))
      .toEqual([{ label: 'cm', isi: 1 }])
  })
})

describe('hargaPerSatuanBesar', () => {
  it('harga per roll → per Dus', () => {
    expect(hargaPerSatuanBesar(11554, 760, 36480)).toBeCloseTo(554592, 6)
  })
  it('tanpa satuan kecil memakai faktor 1', () => {
    expect(hargaPerSatuanBesar(220000, 1, null)).toBe(220000)
  })
  it('isi atau harga tak valid → null', () => {
    expect(hargaPerSatuanBesar(1000, 0, 10)).toBeNull()
    expect(hargaPerSatuanBesar(Number.NaN, 1, 10)).toBeNull()
  })
})
