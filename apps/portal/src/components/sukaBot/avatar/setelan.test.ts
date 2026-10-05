import { describe, expect, it } from 'vitest'
import { bacaSetelan, SETELAN_BAWAAN, TINGGI_MAKS, TINGGI_MIN, tinggiChefEfektif, UKURAN_PANEL } from './setelan'

describe('bacaSetelan', () => {
  it('bawaan bila kosong, bukan JSON, atau bukan objek', () => {
    for (const mentah of [null, '', 'bukan json', '42', 'null', '[]']) expect(bacaSetelan(mentah)).toEqual(SETELAN_BAWAAN)
  })
  it('membaca setelan yang sah', () => {
    const s = { tinggiChef: 200, ukuranPanel: 'kecil', animasi: false, tersembunyi: true }
    expect(bacaSetelan(JSON.stringify(s))).toEqual(s)
  })
  it('tinggi di luar rentang / bukan angka / format lama = otomatis (null)', () => {
    for (const tinggiChef of [10, 999, 'besar', NaN, null]) {
      expect(bacaSetelan(JSON.stringify({ tinggiChef })).tinggiChef).toBeNull()
    }
    expect(bacaSetelan(JSON.stringify({ ukuranChef: 'besar' })).tinggiChef).toBeNull()
    expect(bacaSetelan(JSON.stringify({ tinggiChef: 152.6 })).tinggiChef).toBe(153)
  })
  it('kolom rusak lain diganti nilai bawaan satu per satu', () => {
    expect(bacaSetelan(JSON.stringify({ ukuranPanel: 'raksasa', animasi: 'ya', tersembunyi: 1 })))
      .toEqual({ tinggiChef: null, ukuranPanel: 'sedang', animasi: true, tersembunyi: false })
  })
})

describe('tinggiChefEfektif', () => {
  it('otomatis: 140 desktop, 110 HP (< 640 px)', () => {
    expect(tinggiChefEfektif(null, { w: 1440, h: 900 })).toBe(140)
    expect(tinggiChefEfektif(null, { w: 390, h: 844 })).toBe(110)
  })
  it('pilihan pengguna dipakai apa adanya bila muat', () => {
    expect(tinggiChefEfektif(230, { w: 1440, h: 900 })).toBe(230)
  })
  it('dibatasi 60% tinggi layar, tak pernah di bawah minimum', () => {
    expect(tinggiChefEfektif(260, { w: 1440, h: 300 })).toBe(180)
    expect(tinggiChefEfektif(260, { w: 1440, h: 100 })).toBe(TINGGI_MIN)
    expect(TINGGI_MAKS).toBe(260)
  })
})

describe('UKURAN_PANEL', () => {
  it('sedang = ukuran panel lama', () => {
    expect(UKURAN_PANEL).toEqual({ kecil: { w: 320, h: 480 }, sedang: { w: 384, h: 576 }, besar: { w: 448, h: 680 } })
  })
})
