import { describe, expect, it } from 'vitest'
import { bacaSetelan, SETELAN_BAWAAN, tinggiChef, UKURAN_PANEL } from './setelan'

describe('bacaSetelan', () => {
  it('bawaan bila kosong, bukan JSON, atau bukan objek', () => {
    for (const mentah of [null, '', 'bukan json', '42', 'null', '[]']) expect(bacaSetelan(mentah)).toEqual(SETELAN_BAWAAN)
  })
  it('membaca setelan yang sah', () => {
    const s = { ukuranChef: 'besar', ukuranPanel: 'kecil', animasi: false, tersembunyi: true }
    expect(bacaSetelan(JSON.stringify(s))).toEqual(s)
  })
  it('kolom rusak diganti nilai bawaan satu per satu', () => {
    expect(bacaSetelan(JSON.stringify({ ukuranChef: 'raksasa', ukuranPanel: 'besar', animasi: 'ya', tersembunyi: 1 })))
      .toEqual({ ukuranChef: 'sedang', ukuranPanel: 'besar', animasi: true, tersembunyi: false })
  })
})

describe('tinggiChef', () => {
  it('desktop 110/140/180, HP (< 640 px) 90/110/130', () => {
    expect([tinggiChef('kecil', 1440), tinggiChef('sedang', 1440), tinggiChef('besar', 1440)]).toEqual([110, 140, 180])
    expect([tinggiChef('kecil', 390), tinggiChef('sedang', 390), tinggiChef('besar', 390)]).toEqual([90, 110, 130])
    expect(tinggiChef('sedang', 640)).toBe(140)
  })
})

describe('UKURAN_PANEL', () => {
  it('sedang = ukuran panel lama', () => {
    expect(UKURAN_PANEL).toEqual({ kecil: { w: 320, h: 480 }, sedang: { w: 384, h: 576 }, besar: { w: 448, h: 680 } })
  })
})
