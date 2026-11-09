import { describe, it, expect } from 'vitest'
import { nilaiSatuanDari, keDataSatuan, faktorTampilanDari, satuanInvalid } from './isianSatuan'

describe('nilaiSatuanDari / keDataSatuan / faktorTampilanDari (round-trip)', () => {
  it('FOIL Dus/Roll(48)/cm(760) → faktor 36480, round-trip lengkap', () => {
    const master = { satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', faktor_tampilan: 36480 }
    const nilai = nilaiSatuanDari(master)
    expect(nilai).toEqual({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: '48', satuan_kecil: 'cm', isi_kecil_per_tengah: '760' })
    const d = keDataSatuan(nilai)
    expect(d).toEqual({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', isi_kecil_per_tengah: 760 })
    expect(faktorTampilanDari(d)).toBe(36480)
  })

  it('satuan satu tingkat (tanpa tengah, tanpa kecil) → faktor_tampilan null', () => {
    const master = { satuan: 'Dus', satuan_tengah: null, faktor_tengah: null, satuan_kecil: null, faktor_tampilan: null }
    const nilai = nilaiSatuanDari(master)
    expect(nilai).toEqual({ satuan: 'Dus', satuan_tengah: '', faktor_tengah: '', satuan_kecil: '', isi_kecil_per_tengah: '' })
    const d = keDataSatuan(nilai)
    expect(faktorTampilanDari(d)).toBeNull()
  })

  it('satuan kecil gram tanpa tengah → isi langsung dari faktor_tampilan, round-trip', () => {
    const master = { satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram', faktor_tampilan: 500 }
    const nilai = nilaiSatuanDari(master)
    expect(nilai).toEqual({ satuan: 'Pack', satuan_tengah: '', faktor_tengah: '', satuan_kecil: 'gram', isi_kecil_per_tengah: '500' })
    const d = keDataSatuan(nilai)
    expect(d).toEqual({ satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram', isi_kecil_per_tengah: 500 })
    expect(faktorTampilanDari(d)).toBe(500)
  })

  it('nilaiSatuanDari pakai cek positif, bukan truthiness, untuk faktor_tengah/faktor_tampilan', () => {
    const master = { satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: -48, satuan_kecil: 'cm', faktor_tampilan: -36480 }
    const nilai = nilaiSatuanDari(master)
    // faktor negatif diperlakukan seperti tidak ada, bukan ditampilkan apa adanya
    expect(nilai.faktor_tengah).toBe('')
    expect(nilai.isi_kecil_per_tengah).toBe('')
  })
})

describe('satuanInvalid', () => {
  const lengkap = { satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: '48', satuan_kecil: 'cm', isi_kecil_per_tengah: '760' }

  it('lengkap & valid → false', () => {
    expect(satuanInvalid(lengkap)).toBe(false)
  })

  it('satuan besar kosong → true', () => {
    expect(satuanInvalid({ ...lengkap, satuan: '' })).toBe(true)
  })

  it('satuan tengah diisi tapi faktor_tengah kosong → true', () => {
    expect(satuanInvalid({ ...lengkap, faktor_tengah: '' })).toBe(true)
  })

  it('satuan kecil diisi tapi isi_kecil_per_tengah kosong → true', () => {
    expect(satuanInvalid({ ...lengkap, isi_kecil_per_tengah: '' })).toBe(true)
  })

  it('faktor_tengah tak terbaca → true', () => {
    expect(satuanInvalid({ ...lengkap, faktor_tengah: 'abc' })).toBe(true)
  })

  it('faktor_tengah nol/negatif → true', () => {
    expect(satuanInvalid({ ...lengkap, faktor_tengah: '0' })).toBe(true)
    expect(satuanInvalid({ ...lengkap, faktor_tengah: '-5' })).toBe(true)
  })

  it('isi_kecil_per_tengah tak terbaca → true', () => {
    expect(satuanInvalid({ ...lengkap, isi_kecil_per_tengah: 'xx' })).toBe(true)
  })

  it('satu tingkat tanpa tengah/kecil, satuan terisi → false', () => {
    expect(satuanInvalid({ satuan: 'Dus', satuan_tengah: '', faktor_tengah: '', satuan_kecil: '', isi_kecil_per_tengah: '' })).toBe(false)
  })
})
