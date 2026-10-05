import { describe, it, expect } from 'vitest'
import { rupiah, persenPerubahan, teksPersen, jamWib, jamWibAngka } from './format'

describe('format', () => {
  it('rupiah dengan titik ribuan, dibulatkan', () => {
    expect(rupiah(48200000)).toBe('Rp 48.200.000')
    expect(rupiah(1234.6)).toBe('Rp 1.235')
    expect(rupiah(0)).toBe('Rp 0')
  })
  it('persen perubahan 1 desimal, null bila pembanding nol', () => {
    expect(persenPerubahan(106, 100)).toBe(6)
    expect(persenPerubahan(90, 120)).toBe(-25)
    expect(persenPerubahan(5, 0)).toBeNull()
  })
  it('teks persen', () => {
    expect(teksPersen(6.2)).toBe('+6,2%')
    expect(teksPersen(-3)).toBe('-3%')
    expect(teksPersen(0)).toBe('0%')
    expect(teksPersen(null)).toBe('—')
  })
  it('jam WIB', () => {
    const d = new Date('2026-10-01T07:30:00Z') // 14:30 WIB
    expect(jamWib(d)).toBe('14:30')
    expect(jamWibAngka(d)).toBe(14)
  })
})
