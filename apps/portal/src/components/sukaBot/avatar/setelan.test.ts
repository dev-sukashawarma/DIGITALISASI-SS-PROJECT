import { describe, expect, it } from 'vitest'
import {
  bacaSetelan, batasSliderPanel, LEBAR_PANEL, SETELAN_BAWAAN, TINGGI_MAKS, TINGGI_MIN, TINGGI_PANEL,
  tinggiChefEfektif, ukuranPanelPilihan,
} from './setelan'

describe('bacaSetelan', () => {
  it('bawaan bila kosong, bukan JSON, atau bukan objek', () => {
    for (const mentah of [null, '', 'bukan json', '42', 'null', '[]']) expect(bacaSetelan(mentah)).toEqual(SETELAN_BAWAAN)
  })
  it('membaca setelan yang sah', () => {
    const s = { tinggiChef: 350, lebarPanel: 500, tinggiPanel: 800, animasi: false, tersembunyi: true }
    expect(bacaSetelan(JSON.stringify(s))).toEqual(s)
  })
  it('angka di luar rentang / bukan angka = otomatis (null), pecahan dibulatkan', () => {
    for (const v of [10, 9999, 'besar', NaN, null]) {
      const s = bacaSetelan(JSON.stringify({ tinggiChef: v, lebarPanel: v, tinggiPanel: v }))
      expect([s.tinggiChef, s.lebarPanel, s.tinggiPanel]).toEqual([null, null, null])
    }
    expect(bacaSetelan(JSON.stringify({ tinggiChef: 152.6 })).tinggiChef).toBe(153)
  })
  it('format lama ukuranPanel kecil/besar diubah ke angka yang sama, sedang = otomatis', () => {
    expect(bacaSetelan(JSON.stringify({ ukuranPanel: 'kecil' }))).toMatchObject({ lebarPanel: 320, tinggiPanel: 480 })
    expect(bacaSetelan(JSON.stringify({ ukuranPanel: 'besar' }))).toMatchObject({ lebarPanel: 448, tinggiPanel: 680 })
    expect(bacaSetelan(JSON.stringify({ ukuranPanel: 'sedang' }))).toMatchObject({ lebarPanel: null, tinggiPanel: null })
  })
  it('kolom rusak lain diganti nilai bawaan', () => {
    expect(bacaSetelan(JSON.stringify({ animasi: 'ya', tersembunyi: 1 })))
      .toEqual({ tinggiChef: null, lebarPanel: null, tinggiPanel: null, animasi: true, tersembunyi: false })
  })
})

describe('tinggiChefEfektif', () => {
  it('otomatis: 140 desktop, 110 HP (< 640 px)', () => {
    expect(tinggiChefEfektif(null, { w: 1440, h: 900 })).toBe(140)
    expect(tinggiChefEfektif(null, { w: 390, h: 844 })).toBe(110)
  })
  it('bisa sampai 400 px bila layar cukup tinggi', () => {
    expect(TINGGI_MAKS).toBe(400)
    expect(tinggiChefEfektif(400, { w: 1920, h: 1080 })).toBe(400)
  })
  it('dibatasi 60% tinggi layar, tak pernah di bawah minimum', () => {
    expect(tinggiChefEfektif(400, { w: 1440, h: 600 })).toBe(360)
    expect(tinggiChefEfektif(400, { w: 1440, h: 100 })).toBe(TINGGI_MIN)
  })
})

describe('ukuran kotak chat', () => {
  it('otomatis = 384x576, pilihan dipakai apa adanya', () => {
    expect(ukuranPanelPilihan(SETELAN_BAWAAN)).toEqual({ w: 384, h: 576 })
    expect(ukuranPanelPilihan({ ...SETELAN_BAWAAN, lebarPanel: 600, tinggiPanel: 850 })).toEqual({ w: 600, h: 850 })
  })
  it('rentang slider: lebar 300-640, tinggi 400-900', () => {
    expect([LEBAR_PANEL.min, LEBAR_PANEL.maks, TINGGI_PANEL.min, TINGGI_PANEL.maks]).toEqual([300, 640, 400, 900])
  })
  it('batas atas slider mengikuti layar, tak pernah di bawah batas bawah', () => {
    expect(batasSliderPanel({ w: 1920, h: 1080 })).toEqual({ lebarMaks: 640, tinggiMaks: 900 })
    expect(batasSliderPanel({ w: 1440, h: 800 })).toEqual({ lebarMaks: 640, tinggiMaks: 688 })
    expect(batasSliderPanel({ w: 280, h: 400 })).toEqual({ lebarMaks: 300, tinggiMaks: 400 })
  })
})
