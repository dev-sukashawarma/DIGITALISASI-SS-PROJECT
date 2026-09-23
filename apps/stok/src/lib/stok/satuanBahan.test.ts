import { describe, it, expect } from 'vitest'
import { turunkanFaktorSatuan } from './satuanBahan'

describe('turunkanFaktorSatuan', () => {
  it('tiga tingkat: faktor_tampilan = tengah × isi kecil, faktor_konversi = isi per tengah', () => {
    // FOIL: 1 Dus = 48 Roll, 1 Roll = 760 cm
    expect(
      turunkanFaktorSatuan({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', isiKecilPerTengah: 760 }),
    ).toEqual({
      satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm',
      faktor_konversi: 760, faktor_tampilan: 36480,
    })
  })

  it('tengah sama dengan besar berisi 1 = tanpa tengah (kasus GAS 12 KG)', () => {
    expect(
      turunkanFaktorSatuan({ satuan: 'tabung', satuan_tengah: 'tabung', faktor_tengah: 1, satuan_kecil: 'gram', isiKecilPerTengah: 12000 }),
    ).toEqual({
      satuan: 'tabung', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram',
      faktor_konversi: 12000, faktor_tampilan: 12000,
    })
  })

  it('perbandingan nama tengah vs besar tidak peka huruf besar', () => {
    const r = turunkanFaktorSatuan({ satuan: 'Kg', satuan_tengah: 'kg', faktor_tengah: 1, satuan_kecil: 'Gram', isiKecilPerTengah: 1000 })
    expect(r.satuan_tengah).toBeNull()
    expect(r.faktor_tampilan).toBe(1000)
    expect(r.faktor_konversi).toBe(1000)
  })

  it('tengah kosong = tanpa tengah', () => {
    const r = turunkanFaktorSatuan({ satuan: 'Pack', satuan_tengah: '', faktor_tengah: 5, satuan_kecil: 'Pcs', isiKecilPerTengah: 50 })
    expect(r).toMatchObject({ satuan_tengah: null, faktor_tengah: null, faktor_tampilan: 50, faktor_konversi: 50 })
  })

  it('isi tidak valid menghasilkan null, bukan angka palsu', () => {
    const r = turunkanFaktorSatuan({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', isiKecilPerTengah: 0 })
    expect(r.faktor_tampilan).toBeNull()
    expect(r.faktor_konversi).toBeNull()
    const n = turunkanFaktorSatuan({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: Number.NaN, satuan_kecil: 'cm', isiKecilPerTengah: 760 })
    expect(n.faktor_tampilan).toBeNull()
  })

  it('memangkas spasi', () => {
    const r = turunkanFaktorSatuan({ satuan: ' Dus ', satuan_tengah: ' Roll ', faktor_tengah: 2, satuan_kecil: ' cm ', isiKecilPerTengah: 3 })
    expect(r).toMatchObject({ satuan: 'Dus', satuan_tengah: 'Roll', satuan_kecil: 'cm', faktor_tampilan: 6 })
  })
})
