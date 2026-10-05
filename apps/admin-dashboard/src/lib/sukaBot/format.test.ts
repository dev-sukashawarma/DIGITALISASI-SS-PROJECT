import { describe, it, expect } from 'vitest'
import { rupiah, jamWib, jamWibAngka } from './format'

describe('format', () => {
  it('rupiah dengan titik ribuan, dibulatkan', () => {
    expect(rupiah(48200000)).toBe('Rp 48.200.000')
    expect(rupiah(1234.6)).toBe('Rp 1.235')
    expect(rupiah(0)).toBe('Rp 0')
  })
  it('jam WIB', () => {
    const d = new Date('2026-10-01T07:30:00Z') // 14:30 WIB
    expect(jamWib(d)).toBe('14:30')
    expect(jamWibAngka(d)).toBe(14)
  })
})
