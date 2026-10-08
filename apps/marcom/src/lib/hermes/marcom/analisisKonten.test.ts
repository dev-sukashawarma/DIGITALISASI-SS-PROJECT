import { describe, it, expect } from 'vitest'
import { buatKonteksMarcomPalsu } from './fixture'
import { hitungAnalisisKonten } from './analisisKonten'

describe('marcom_analisis_konten', () => {
  it('menghitung metrik performa konten minggu ini sesuai rumus ContentMetricsView', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungAnalisisKonten(konteks, { periode: 'minggu_ini' })

    expect(hasil.ringkasan).toEqual({
      total_konten: 4,
      total_video: 4,
      total_feed: 0,
      total_views: 52000,
      total_reach: 43000,
      total_likes: 3600,
      total_comments: 210,
      total_shares: 120,
      total_saves: 205,
      total_engagement: 4135,
      avg_er: 7.95, // (4135 / 52000) * 100
      avg_ebr: 9.62, // (4135 / 43000) * 100
    })

    // Top video berdasarkan views terbanyak
    expect(hasil.top_konten).toHaveLength(4)
    expect(hasil.top_konten[0].title).toBe('Sidak Dapur Sambal Bakar')
    expect(hasil.top_konten[0].views).toBe(30000)
    expect(hasil.top_konten[1].title).toBe('Promo Gajian Diskon 30%')
    expect(hasil.top_konten[1].views).toBe(22000)

    // Breakdown per pilar
    const branding = hasil.per_pilar.find((p) => p.pilar === 'Branding')
    expect(branding).toBeDefined()
    expect(branding?.views).toBe(30000)
    expect(branding?.count).toBe(2)
    expect(branding?.er).toBe(9.08)

    // Breakdown per tipe konten
    const sidak = hasil.per_tipe_konten.find((t) => t.tipe === 'Sidak Outlet')
    expect(sidak).toBeDefined()
    expect(sidak?.count).toBe(2)
    expect(sidak?.views).toBe(30000)
    expect(sidak?.avg_views).toBe(15000)

    // Perbandingan organik vs ads
    expect(hasil.organik_vs_ads.organik.count).toBe(3)
    expect(hasil.organik_vs_ads.organik.views).toBe(30000)
    expect(hasil.organik_vs_ads.ads.count).toBe(1)
    expect(hasil.organik_vs_ads.ads.views).toBe(22000)
    expect(hasil.organik_vs_ads.ads.budget).toBe(500000)
  })

  it('memfilter analisis konten berdasarkan platform', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungAnalisisKonten(konteks, {
      periode: 'minggu_ini',
      platform: 'TIKTOK',
    })

    expect(hasil.ringkasan.total_konten).toBe(2)
    expect(hasil.ringkasan.total_views).toBe(30000)
    expect(hasil.top_konten[0].platform).toBe('TIKTOK')
  })
})
