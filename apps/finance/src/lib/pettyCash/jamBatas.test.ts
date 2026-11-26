import { describe, it, expect } from 'vitest'
import { cekJamPengajuanTopupWib, cekJamPengeluaranPosWib } from './jamBatas'

// WIB = UTC + 7
const wib = (jam: number, menit = 0) =>
  new Date(Date.UTC(2026, 10, 26, jam - 7, menit, 0))

describe('cekJamPengajuanTopupWib (09:00–16:00 WIB)', () => {
  it('menolak sebelum 09:00 WIB', () => {
    expect(cekJamPengajuanTopupWib(wib(8, 59)).diizinkan).toBe(false)
    expect(cekJamPengajuanTopupWib(wib(0, 0)).diizinkan).toBe(false)
  })

  it('mengizinkan antara 09:00 dan 15:59 WIB', () => {
    expect(cekJamPengajuanTopupWib(wib(9, 0)).diizinkan).toBe(true)
    expect(cekJamPengajuanTopupWib(wib(15, 59)).diizinkan).toBe(true)
  })

  it('menolak tepat 16:00 WIB ke atas', () => {
    expect(cekJamPengajuanTopupWib(wib(16, 0)).diizinkan).toBe(false)
    expect(cekJamPengajuanTopupWib(wib(21, 30)).diizinkan).toBe(false)
  })
})

describe('cekJamPengeluaranPosWib (06:00–21:00 WIB)', () => {
  it('menolak sebelum 06:00 WIB', () => {
    expect(cekJamPengeluaranPosWib(wib(5, 59)).diizinkan).toBe(false)
  })

  it('mengizinkan antara 06:00 dan 20:59 WIB', () => {
    expect(cekJamPengeluaranPosWib(wib(6, 0)).diizinkan).toBe(true)
    expect(cekJamPengeluaranPosWib(wib(20, 59)).diizinkan).toBe(true)
  })

  it('menolak tepat 21:00 WIB ke atas', () => {
    expect(cekJamPengeluaranPosWib(wib(21, 0)).diizinkan).toBe(false)
    expect(cekJamPengeluaranPosWib(wib(23, 30)).diizinkan).toBe(false)
  })
})
