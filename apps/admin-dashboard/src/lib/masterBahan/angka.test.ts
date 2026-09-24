import { describe, it, expect } from 'vitest'
import { bacaAngka, tulisAngka, bacaIsian } from './angka'

describe('bacaAngka (parser angka Indonesia)', () => {
  it('titik sebagai ribuan, koma sebagai desimal (keduanya ada)', () => {
    expect(bacaAngka('11.554,50')).toBe(11554.5)
  })
  it('titik ribuan berulang', () => {
    expect(bacaAngka('1.000.000')).toBe(1000000)
  })
  it('titik ribuan tunggal (pola 3 digit)', () => {
    expect(bacaAngka('11.554')).toBe(11554)
  })
  it('koma sebagai desimal (tanpa titik)', () => {
    expect(bacaAngka('1,5')).toBe(1.5)
  })
  it('titik sebagai desimal (bukan pola ribuan)', () => {
    expect(bacaAngka('1.5')).toBe(1.5)
  })
  it('titik sebagai desimal, dua digit pecahan', () => {
    expect(bacaAngka('0.25')).toBe(0.25)
  })
  it('angka polos', () => {
    expect(bacaAngka('220000')).toBe(220000)
  })
  it('prefiks Rp + spasi + titik ribuan', () => {
    expect(bacaAngka('Rp 220.000')).toBe(220000)
  })
  it('string kosong → null', () => {
    expect(bacaAngka('')).toBeNull()
  })
  it('string kosong (hanya spasi) → null', () => {
    expect(bacaAngka('   ')).toBeNull()
  })
  it('bukan angka → null', () => {
    expect(bacaAngka('abc')).toBeNull()
  })
  it('lebih dari satu koma → null', () => {
    expect(bacaAngka('1,2,3')).toBeNull()
  })
  it('negatif tidak diizinkan → null', () => {
    expect(bacaAngka('-5')).toBeNull()
  })
  it('titik tunggal dengan leading zero group BUKAN pola ribuan (bug fix)', () => {
    expect(bacaAngka('0.500')).toBe(0.5)
  })
  it('titik tunggal leading zero, 3 digit pecahan (bug fix)', () => {
    expect(bacaAngka('0.125')).toBe(0.125)
  })
})

describe('tulisAngka (format Indonesia untuk pra-isi input, tanpa pemisah ribuan)', () => {
  it('null/undefined → string kosong', () => {
    expect(tulisAngka(null)).toBe('')
    expect(tulisAngka(undefined)).toBe('')
  })
  it('integer → tanpa pemisah ribuan', () => {
    expect(tulisAngka(1000)).toBe('1000')
    expect(tulisAngka(36480)).toBe('36480')
    expect(tulisAngka(0)).toBe('0')
  })
  it('desimal → koma', () => {
    expect(tulisAngka(2.125)).toBe('2,125')
    expect(tulisAngka(0.5)).toBe('0,5')
  })
  it.each([0, 1, 1000, 36480, 0.5, 2.125, 0.125, 1234.5])('round-trip lewat bacaAngka: %s', (x) => {
    expect(bacaAngka(tulisAngka(x))).toBe(x)
  })
})

describe('bacaIsian (isian opsional dengan bawaan)', () => {
  it('kosong → bawaan, tidak invalid', () => {
    expect(bacaIsian('', 0)).toEqual({ nilai: 0, invalid: false })
    expect(bacaIsian('   ', null)).toEqual({ nilai: null, invalid: false })
  })
  it('terisi & terbaca → nilai, tidak invalid', () => {
    expect(bacaIsian('220000', 0)).toEqual({ nilai: 220000, invalid: false })
  })
  it('terisi tapi tak terbaca → invalid, nilai null (bukan diam-diam jadi bawaan)', () => {
    expect(bacaIsian('abc', 0)).toEqual({ nilai: null, invalid: true })
  })
})
