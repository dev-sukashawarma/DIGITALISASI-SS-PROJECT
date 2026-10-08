import { describe, it, expect } from 'vitest'
import { buatKonteksMarcomPalsu } from './fixture'
import { hitungJadwalKonten } from './konten'

describe('marcom_konten_jadwal', () => {
  it('menghitung jadwal konten hari ini secara default', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungJadwalKonten(konteks, { periode: 'hari_ini' })

    expect(hasil.meta.periode).toBe('hari_ini')
    expect(hasil.meta.dari).toBe('2026-10-08')
    expect(hasil.meta.sampai).toBe('2026-10-08')
    expect(hasil.ringkasan.total).toBe(2)
    expect(hasil.ringkasan.sudah_posting).toBe(1) // Sidak Dapur Sambal Bakar
    expect(hasil.ringkasan.siap_tayang).toBe(1) // Sound Viral Cek Ombak Pedas
    expect(hasil.daftar).toHaveLength(2)
  })

  it('mengambil jadwal konten minggu ini', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungJadwalKonten(konteks, { periode: 'minggu_ini' })

    // 2026-10-08 adalah hari Kamis. Senin minggu ini adalah 2026-10-05, Minggu adalah 2026-10-11.
    expect(hasil.meta.dari).toBe('2026-10-05')
    expect(hasil.meta.sampai).toBe('2026-10-11')
    expect(hasil.ringkasan.total).toBe(4)
    expect(hasil.daftar).toHaveLength(4)
  })

  it('memfilter konten berdasarkan platform TIKTOK', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungJadwalKonten(konteks, {
      periode: 'minggu_ini',
      platform: 'TIKTOK',
    })

    expect(hasil.daftar).toHaveLength(2)
    expect(hasil.daftar.every((k) => k.platform === 'TIKTOK')).toBe(true)
  })

  it('memfilter konten berdasarkan nama outlet', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungJadwalKonten(konteks, {
      periode: 'minggu_ini',
      outlet: 'Solo Baru',
    })

    expect(hasil.daftar).toHaveLength(1)
    expect(hasil.daftar[0].title).toBe('Sidak Dapur Sambal Bakar')
  })

  it('memfilter konten berdasarkan status Belum Posting', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungJadwalKonten(konteks, {
      periode: 'minggu_ini',
      status: 'belum_posting',
    })

    expect(hasil.daftar).toHaveLength(2) // Siap Tayang dan Draft
    expect(hasil.daftar.map((k) => k.status)).toEqual(['Siap Tayang', 'Draft'])
  })
})
