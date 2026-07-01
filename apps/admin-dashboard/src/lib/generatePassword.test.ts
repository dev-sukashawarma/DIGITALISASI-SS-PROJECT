import { describe, it, expect } from 'vitest'
import { generateTempPassword } from './generatePassword'

describe('generateTempPassword', () => {
  it('panjang default 10, dan bisa dikustom', () => {
    expect(generateTempPassword()).toHaveLength(10)
    expect(generateTempPassword(16)).toHaveLength(16)
  })

  it('hanya karakter aman (tanpa 0 O 1 l I)', () => {
    const pw = generateTempPassword(200)
    expect(pw).toMatch(/^[A-Za-z2-9]+$/) // alfanumerik, tanpa digit 0 & 1
    expect(pw).not.toMatch(/[0O1lI]/) // tanpa karakter ambigu yang disebut
  })

  it('tidak menghasilkan nilai seragam yang sama (acak)', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateTempPassword()))
    // Praktis mustahil sama semua bila benar-benar acak.
    expect(set.size).toBeGreaterThan(45)
  })

  it('tidak pernah mengembalikan default lama', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTempPassword()).not.toBe('sukashawarma123')
    }
  })
})
