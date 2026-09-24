import { describe, it, expect } from 'vitest'
import { statusOutlet, pesanStatus } from './jamBuka'

// Semua waktu dinyatakan dalam WIB (+07:00) agar uji tak tergantung zona server.
const wib = (s: string) => new Date(`${s}+07:00`)
const dasar = {
  openHour: '14:00:00', closeHour: '22:00:00', isActive: true,
  tutupSementara: [], menitPesanTerakhir: 30,
}

describe('statusOutlet', () => {
  it('buka di tengah jam operasional', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T15:00:00') })
    expect(s.bisaPesan).toBe(true)
    expect(s.alasan).toBe('buka')
    expect(s.pesanTerakhir?.toISOString()).toBe(wib('2026-09-24T21:30:00').toISOString())
  })

  it('belum buka pagi hari, buka lagi hari yang sama', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T09:00:00') })
    expect(s.bisaPesan).toBe(false)
    expect(s.alasan).toBe('belum_buka')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-24T14:00:00').toISOString())
  })

  it('00.30 WIB (masih 17.30 UTC hari sebelumnya) dihitung sebagai pagi WIB', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-25T00:30:00') })
    expect(s.alasan).toBe('belum_buka')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-25T14:00:00').toISOString())
  })

  it('lewat pesan terakhir: 21.45 ditolak, buka lagi besok', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T21:45:00') })
    expect(s.bisaPesan).toBe(false)
    expect(s.alasan).toBe('lewat_pesan_terakhir')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-25T14:00:00').toISOString())
  })

  it('tepat di batas pesan terakhir 21.30 sudah ditolak', () => {
    expect(statusOutlet({ ...dasar, sekarang: wib('2026-09-24T21:30:00') }).bisaPesan).toBe(false)
  })

  it('sesudah jam tutup', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T23:00:00') })
    expect(s.alasan).toBe('sudah_tutup')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-25T14:00:00').toISOString())
  })

  it('tanpa data jam = buka sepanjang hari', () => {
    const s = statusOutlet({ ...dasar, openHour: null, closeHour: null, sekarang: wib('2026-09-24T03:00:00') })
    expect(s.bisaPesan).toBe(true)
    expect(s.pesanTerakhir).toBeNull()
  })

  it('jam tutup lewat tengah malam (18.00-02.00)', () => {
    const malam = { ...dasar, openHour: '18:00:00', closeHour: '02:00:00' }
    expect(statusOutlet({ ...malam, sekarang: wib('2026-09-25T00:30:00') }).bisaPesan).toBe(true)
    expect(statusOutlet({ ...malam, sekarang: wib('2026-09-25T01:45:00') }).alasan).toBe('lewat_pesan_terakhir')
    expect(statusOutlet({ ...malam, sekarang: wib('2026-09-25T10:00:00') }).alasan).toBe('belum_buka')
  })

  it('nonaktif menang atas segalanya', () => {
    const s = statusOutlet({ ...dasar, isActive: false, sekarang: wib('2026-09-24T15:00:00') })
    expect(s.alasan).toBe('nonaktif')
    expect(s.bisaPesan).toBe(false)
  })

  it('tutup sementara menang atas jam buka; yang sampai-nya terjauh berlaku', () => {
    const s = statusOutlet({
      ...dasar, sekarang: wib('2026-09-24T15:00:00'),
      tutupSementara: [
        { sampai: wib('2026-09-24T18:00:00'), alasan: 'Stok habis' },
        { sampai: wib('2026-09-26T14:00:00'), alasan: 'Renovasi' },
      ],
    })
    expect(s.alasan).toBe('tutup_sementara')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-26T14:00:00').toISOString())
    expect(s.alasanTutup).toBe('Renovasi')
  })

  it('tutup sementara yang sudah lewat diabaikan (aktif lagi otomatis)', () => {
    const s = statusOutlet({
      ...dasar, sekarang: wib('2026-09-24T15:00:00'),
      tutupSementara: [{ sampai: wib('2026-09-24T14:59:00'), alasan: null }],
    })
    expect(s.bisaPesan).toBe(true)
  })
})

describe('pesanStatus', () => {
  it('menyebut jam buka dalam format 14.00', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T09:00:00') })
    expect(pesanStatus(s)).toBe('Outlet belum buka. Buka pukul 14.00.')
  })
  it('tutup sementara menyebut tanggal dan alasan', () => {
    const s = statusOutlet({
      ...dasar, sekarang: wib('2026-09-24T15:00:00'),
      tutupSementara: [{ sampai: wib('2026-09-26T14:00:00'), alasan: 'Renovasi' }],
    })
    expect(pesanStatus(s)).toBe('Outlet tutup sementara (Renovasi). Buka lagi 26 Sep pukul 14.00.')
  })
})
