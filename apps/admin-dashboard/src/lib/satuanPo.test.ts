import { describe, it, expect } from 'vitest'
import { hitungFaktorPo, type BahanSatuan } from './satuanPo'

const bahan = (o: Partial<BahanSatuan>): BahanSatuan => ({
  satuan: null,
  satuan_po: null,
  satuan_tengah: null,
  faktor_tengah: null,
  satuan_kecil: null,
  faktor_tampilan: null,
  ...o,
})

describe('hitungFaktorPo', () => {
  it('satuan_po = satuan besar, ada satuan kecil -> faktor_tampilan (AYAM)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Kg', satuan_po: 'kg', satuan_kecil: 'Gram', faktor_tampilan: 1000,
    }))).toBe(1000)
  })

  it('satuan_po = satuan tengah -> faktor_tampilan / faktor_tengah (FOIL)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'roll',
      satuan_tengah: 'Roll', faktor_tengah: 48,
      satuan_kecil: 'cm', faktor_tampilan: 36480,
    }))).toBe(760)
  })

  it('satuan_po = satuan tengah, PLASTIK BESAR -> 50', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Ikat', satuan_po: 'pack',
      satuan_tengah: 'Pack', faktor_tengah: 5,
      satuan_kecil: 'Lembar', faktor_tampilan: 250,
    }))).toBe(50)
  })

  it('satuan_po = satuan kecil -> 1 (MIE)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'bungkus',
      satuan_kecil: 'Bungkus', faktor_tampilan: 40,
    }))).toBe(1)
  })

  it('tanpa satuan kecil, satuan besar adalah satuan terkecil -> 1 (PLASTIK 24)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Pack', satuan_po: 'pack',
    }))).toBe(1)
  })

  it('satuan_kecil bertanda "-" diperlakukan kosong -> 1', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Unit', satuan_po: 'unit', satuan_kecil: '-',
    }))).toBe(1)
  })

  it('mengenali sinonim bks <-> bungkus', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'bks',
      satuan_kecil: 'Bungkus', faktor_tampilan: 40,
    }))).toBe(1)
  })

  it('label satuan_po tidak dikenal -> null, BUKAN 1', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'karung',
      satuan_tengah: 'Roll', faktor_tengah: 48,
      satuan_kecil: 'cm', faktor_tampilan: 36480,
    }))).toBeNull()
  })

  it('cocok satuan tengah tapi faktor_tengah kosong -> null', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'roll',
      satuan_tengah: 'Roll', faktor_tengah: null,
      satuan_kecil: 'cm', faktor_tampilan: 36480,
    }))).toBeNull()
  })

  it('cocok satuan besar, ada satuan kecil tapi faktor_tampilan kosong -> null', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Kg', satuan_po: 'kg', satuan_kecil: 'Gram', faktor_tampilan: null,
    }))).toBeNull()
  })

  it('satuan_po kosong -> null', () => {
    expect(hitungFaktorPo(bahan({ satuan: 'Kg', satuan_po: null }))).toBeNull()
  })
})
