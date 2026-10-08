import { describe, it, expect } from 'vitest'
import { buatKonteksMarcomPalsu } from './fixture'
import { hitungPromoAktif } from './promo'

describe('marcom_promo_aktif', () => {
  it('memisahkan promo aktif hari ini vs promo mendatang', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungPromoAktif(konteks, {})

    // Pada 2026-10-08:
    // promo-1 (1-15 Okt): aktif (SS Karanganyar)
    // promo-2 (5-10 Okt): aktif (SS Solo Baru)
    // promo-3 (20-31 Okt): mendatang (SS Kartasura)
    expect(hasil.ringkasan).toEqual({
      total_aktif: 2,
      total_mendatang: 1,
    })
    expect(hasil.promo_aktif).toHaveLength(2)
    expect(hasil.promo_mendatang).toHaveLength(1)
    expect(hasil.promo_mendatang[0].title).toBe('Festival Sambal Nusantara')
  })

  it('memfilter promo berdasarkan nama outlet', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungPromoAktif(konteks, { outlet: 'Karanganyar' })

    expect(hasil.promo_aktif).toHaveLength(1)
    expect(hasil.promo_aktif[0].title).toBe('Diskon 30% Paket Bebek Bakar')
    expect(hasil.promo_mendatang).toHaveLength(0)
  })

  it('menangani tanggal custom', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungPromoAktif(konteks, { tanggal: '2026-10-25' })

    // Pada 2026-10-25: promo-1 & promo-2 sudah berakhir, promo-3 aktif
    expect(hasil.ringkasan.total_aktif).toBe(1)
    expect(hasil.promo_aktif[0].title).toBe('Festival Sambal Nusantara')
  })
})
