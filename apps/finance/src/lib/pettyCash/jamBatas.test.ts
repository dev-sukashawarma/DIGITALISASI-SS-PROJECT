import { describe, it, expect } from 'vitest'
import {
  bisaProsesDaruratTopup,
  cekBatasProsesFinanceTopupWib,
  cekJamPengajuanTopupWib,
  cekJamPengeluaranPosWib,
} from './jamBatas'

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

describe('bisaProsesDaruratTopup', () => {
  const hariIni = new Date(Date.UTC(2026, 10, 28, 10, 15, 0)) // 2026-11-28 17:15 WIB

  it('mengizinkan untuk top-up yang auto-batal hari ini', () => {
    expect(
      bisaProsesDaruratTopup(
        {
          status: 'rejected',
          created_at: '2026-11-28T08:35:00Z', // 15:35 WIB
          description: 'Beli gas\n\n[Ditolak Finance: Dibatalkan otomatis oleh sistem karena melewati batas pukul 17:00 WIB]',
        },
        hariIni,
      ),
    ).toBe(true)
  })

  it('menolak jika ditolak manual Finance atau berasal dari hari kemarin', () => {
    expect(
      bisaProsesDaruratTopup(
        {
          status: 'rejected',
          created_at: '2026-11-28T08:35:00Z',
          description: 'Beli gas\n\n[Ditolak Finance: Nominal terlalu besar]',
        },
        hariIni,
      ),
    ).toBe(false)

    expect(
      bisaProsesDaruratTopup(
        {
          status: 'rejected',
          created_at: '2026-11-27T08:35:00Z',
          description: 'Beli gas\n\n[Ditolak Finance: Dibatalkan otomatis oleh sistem karena melewati batas pukul 17:00 WIB]',
        },
        hariIni,
      ),
    ).toBe(false)
  })
})

describe('cekBatasProsesFinanceTopupWib (17:00 WIB + darurat)', () => {
  const createdSameDay = '2026-11-28T08:35:00Z' // 15:35 WIB

  it('mengizinkan antara 16:00 dan 16:59 WIB (grace period 1 jam)', () => {
    const jam1630 = new Date(Date.UTC(2026, 10, 28, 9, 30, 0)) // 16:30 WIB
    expect(cekBatasProsesFinanceTopupWib(createdSameDay, jam1630, false).diizinkan).toBe(true)
  })

  it('menolak normal tepat 17:00 WIB ke atas, tetapi mengizinkan bila isDarurat = true', () => {
    const jam1705 = new Date(Date.UTC(2026, 10, 28, 10, 5, 0)) // 17:05 WIB
    expect(cekBatasProsesFinanceTopupWib(createdSameDay, jam1705, false).diizinkan).toBe(false)
    expect(cekBatasProsesFinanceTopupWib(createdSameDay, jam1705, true).diizinkan).toBe(true)
  })

  it('tetap menolak pengajuan dari hari sebelumnya walau isDarurat = true', () => {
    const besokPagi = new Date(Date.UTC(2026, 10, 29, 3, 0, 0)) // 29 Nov 10:00 WIB
    expect(cekBatasProsesFinanceTopupWib(createdSameDay, besokPagi, true).diizinkan).toBe(false)
  })
})
