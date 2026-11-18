import { describe, it, expect } from 'vitest'
import { cocokkanNominalJam } from './cocokkan'

const wib = (s: string) => new Date(`${s}+07:00`).toISOString()
const bayar = (xenditId: string, nominal: number, jam: string) => ({ xenditId, nominal, dibayarAt: wib(jam) })
const pesanan = (externalOrderId: string, total: number, jam: string) => ({ externalOrderId, total, createdAt: wib(jam) })

describe('cocokkanNominalJam', () => {
  it('kasus Oktober: bayar 29 detik setelah pesan, dan bayar 40 detik setelah pesan', () => {
    const hasil = cocokkanNominalJam(
      [bayar('x1', 54324, '2026-10-09T14:33:41'), bayar('x2', 32192, '2026-10-21T21:34:15')],
      [pesanan('cic', 54324, '2026-10-09T14:33:12'), pesanan('paj', 32192, '2026-10-21T21:33:35')],
      new Set(),
    )
    expect(Object.fromEntries(hasil)).toEqual({ x1: 'cic', x2: 'paj' })
  })

  it('pesanan di luar jendela (dibuat 25 menit sebelum bayar) tidak dicocokkan', () => {
    const hasil = cocokkanNominalJam([bayar('x', 34204, '2026-10-10T19:30:00')], [pesanan('a', 34204, '2026-10-10T19:05:00')], new Set())
    expect(hasil.size).toBe(0)
  })

  it('nominal beda tidak dicocokkan', () => {
    const hasil = cocokkanNominalJam([bayar('x', 34204, '2026-10-10T19:30:00')], [pesanan('a', 34000, '2026-10-10T19:29:00')], new Set())
    expect(hasil.size).toBe(0)
  })

  it('dua pembayaran & dua pesanan bernominal sama → masing-masing ke yang terdekat, satu-ke-satu', () => {
    const hasil = cocokkanNominalJam(
      [bayar('x1', 60360, '2026-10-13T21:28:00'), bayar('x2', 60360, '2026-10-13T21:40:00')],
      [pesanan('a', 60360, '2026-10-13T21:27:00'), pesanan('b', 60360, '2026-10-13T21:39:00')],
      new Set(),
    )
    expect(Object.fromEntries(hasil)).toEqual({ x1: 'a', x2: 'b' })
  })

  it('satu pembayaran, dua pesanan dengan selisih waktu sama → tidak dicocokkan', () => {
    const hasil = cocokkanNominalJam(
      [bayar('x', 29174, '2026-10-01T15:00:00')],
      [pesanan('a', 29174, '2026-10-01T14:58:00'), pesanan('b', 29174, '2026-10-01T15:02:00')],
      new Set(),
    )
    expect(hasil.size).toBe(0)
  })

  it('pesanan yang sudah tertaut dilewati', () => {
    const hasil = cocokkanNominalJam([bayar('x', 54324, '2026-10-09T14:50:00')], [pesanan('cic2', 54324, '2026-10-09T14:49:31')], new Set(['cic2']))
    expect(hasil.size).toBe(0)
  })
})
