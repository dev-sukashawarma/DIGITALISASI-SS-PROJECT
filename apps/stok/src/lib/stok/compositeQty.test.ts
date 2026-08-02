import { describe, it, expect } from 'vitest'
import { toSatuanBesar, formatSatuanBesar, formatCompositeInput, kecilPerBesar } from './compositeQty'
import type { CompositeUnit } from './compositeQty'

/** KENTANG: 1 Dus = 10 Kg, 1 Kg = 1000 Gram (10000 Gram/Dus). */
const KENTANG: CompositeUnit = {
  satuan: 'Dus',
  satuan_tengah: 'Kg',
  faktor_tengah: 10,
  satuan_kecil: 'Gram',
  faktor_tampilan: 10000,
  faktor_konversi: 1000,
}

/** AYAM: dua tingkat saja, 1 Kg = 1000 Gram. */
const AYAM: CompositeUnit = {
  satuan: 'Kg',
  satuan_tengah: null,
  faktor_tengah: null,
  satuan_kecil: 'Gram',
  faktor_tampilan: 1000,
  faktor_konversi: 1000,
}

/** PLASTIK: satu tingkat, tanpa satuan kecil. */
const PLASTIK: CompositeUnit = {
  satuan: 'Pcs',
  satuan_tengah: null,
  faktor_tengah: null,
  satuan_kecil: null,
  faktor_tampilan: null,
  faktor_konversi: 1,
}

describe('kecilPerBesar', () => {
  it('pakai faktor_tampilan bila tersedia', () => {
    expect(kecilPerBesar(KENTANG)).toBe(10000)
  })

  it('hitung dari faktor_tengah x faktor_konversi bila faktor_tampilan kosong', () => {
    expect(kecilPerBesar({ ...KENTANG, faktor_tampilan: null })).toBe(10000)
  })
})

describe('toSatuanBesar', () => {
  it('konversi input 3 tingkat turun ke satuan besar (bukan naik ke satuan kecil)', () => {
    // Kasus produksi yang bikin 202500: 20 Dus + 2 Kg + 500 Gram
    expect(toSatuanBesar(KENTANG, { besar: '20', tengah: '2', kecil: '500' })).toBe(20.25)
  })

  it('konversi input 2 tingkat', () => {
    expect(toSatuanBesar(AYAM, { besar: '3', kecil: '250' })).toBe(3.25)
  })

  it('abaikan tingkat yang tidak dimiliki bahan', () => {
    expect(toSatuanBesar(PLASTIK, { besar: '12', tengah: '9', kecil: '9' })).toBe(12)
  })

  it('input kosong jadi 0', () => {
    expect(toSatuanBesar(KENTANG, {})).toBe(0)
  })
})

describe('formatSatuanBesar', () => {
  it('urai saldo satuan besar jadi teks bertingkat', () => {
    expect(formatSatuanBesar(KENTANG, 20.25)).toBe('20 Dus + 2 Kg + 500 Gram')
  })

  it('saldo bulat tidak memunculkan sisa', () => {
    expect(formatSatuanBesar(KENTANG, 21)).toBe('21 Dus')
  })

  it('urai bahan 2 tingkat', () => {
    expect(formatSatuanBesar(AYAM, 3.25)).toBe('3 Kg + 250 Gram')
  })

  it('selisih negatif diberi tanda minus', () => {
    expect(formatSatuanBesar(KENTANG, -0.75)).toBe('-7 Kg + 500 Gram')
  })

  it('nol tetap terbaca', () => {
    expect(formatSatuanBesar(KENTANG, 0)).toBe('0 Dus')
  })

  it('bahan tanpa satuan kecil dibulatkan 2 desimal', () => {
    expect(formatSatuanBesar(PLASTIK, 12.5)).toBe('12.5 Pcs')
    expect(formatSatuanBesar(PLASTIK, 12)).toBe('12 Pcs')
  })
})

describe('formatCompositeInput', () => {
  it('gabung tingkat yang diisi saja', () => {
    expect(formatCompositeInput(KENTANG, { besar: '20', tengah: '2', kecil: '500' }))
      .toBe('20 Dus + 2 Kg + 500 Gram')
  })

  it('lewati tingkat yang tidak dimiliki bahan', () => {
    expect(formatCompositeInput(AYAM, { besar: '3', tengah: '5', kecil: '250' }))
      .toBe('3 Kg + 250 Gram')
  })

  it('kosong jadi 0 satuan besar', () => {
    expect(formatCompositeInput(KENTANG, {})).toBe('0 Dus')
  })
})
