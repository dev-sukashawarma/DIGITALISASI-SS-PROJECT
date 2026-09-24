import { describe, it, expect } from 'vitest'
import { bacaAngka } from './angka'

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
})
