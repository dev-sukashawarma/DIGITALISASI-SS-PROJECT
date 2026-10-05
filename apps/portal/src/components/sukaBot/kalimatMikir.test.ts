import { describe, expect, it } from 'vitest'
import { KALIMAT_MIKIR, kalimatBerikut } from './kalimatMikir'

describe('kalimatBerikut', () => {
  it('daftar cukup beragam dan tanpa duplikat', () => {
    expect(KALIMAT_MIKIR.length).toBeGreaterThanOrEqual(8)
    expect(new Set(KALIMAT_MIKIR).size).toBe(KALIMAT_MIKIR.length)
  })
  it('kalimat pertama diambil acak dari daftar', () => {
    expect(kalimatBerikut(null, () => 0)).toBe(KALIMAT_MIKIR[0])
    expect(kalimatBerikut(null, () => 0.999)).toBe(KALIMAT_MIKIR[KALIMAT_MIKIR.length - 1])
  })
  it('tidak pernah mengulang kalimat yang sedang tampil', () => {
    for (const sekarang of KALIMAT_MIKIR) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) expect(kalimatBerikut(sekarang, () => r)).not.toBe(sekarang)
    }
  })
  it('semua kalimat lain bisa terpilih', () => {
    const sekarang = KALIMAT_MIKIR[0]
    const n = KALIMAT_MIKIR.length - 1
    const terpilih = new Set(Array.from({ length: n }, (_, i) => kalimatBerikut(sekarang, () => (i + 0.5) / n)))
    expect(terpilih.size).toBe(n)
  })
})
