import { describe, it, expect } from 'vitest'
import {
  agregasiSentimen,
  hitungRankingOutlet,
  saringAlertAktif,
  saringReviewNegatif,
} from './hitung'
import { ALERTS_PALSU, OUTLETS_PALSU, REVIEWS_PALSU } from './fixture'

describe('hitung.ts domain review', () => {
  describe('hitungRankingOutlet', () => {
    it('mengurutkan berdasarkan rating tertinggi secara default dan mengabaikan outlet tidak aktif / tes', () => {
      const hasil = hitungRankingOutlet(OUTLETS_PALSU)
      expect(hasil.total_outlet).toBe(3) // out-tes diabaikan
      expect(hasil.peringkat[0].outlet).toBe('SUKA SHAWARMA EMPANG')
      expect(hasil.peringkat[0].rating).toBe(4.8)
      expect(hasil.peringkat[1].outlet).toBe('MITRA CIBINONG')
      expect(hasil.peringkat[2].outlet).toBe('MITRA KALISARI')
      expect(hasil.rata_rata_rating).toBe(4.3)
    })

    it('mendukung pengurutan terendah', () => {
      const hasil = hitungRankingOutlet(OUTLETS_PALSU, { urutkan: 'terendah' })
      expect(hasil.peringkat[0].outlet).toBe('MITRA KALISARI')
      expect(hasil.peringkat[0].rating).toBe(3.9)
    })

    it('mendukung pengurutan ulasan terbanyak', () => {
      const hasil = hitungRankingOutlet(OUTLETS_PALSU, { urutkan: 'ulasan_terbanyak' })
      expect(hasil.peringkat[0].outlet).toBe('SUKA SHAWARMA EMPANG')
      expect(hasil.peringkat[0].total_ulasan).toBe(340)
    })

    it('dapat difilter per status operasional', () => {
      const hasil = hitungRankingOutlet(OUTLETS_PALSU, { status: 'attention' })
      expect(hasil.total_outlet).toBe(1)
      expect(hasil.peringkat[0].outlet).toBe('MITRA KALISARI')
    })

    it('mengecualikan outlet non-ritel (Kitchen Pusat) dan memposisikan outlet 0 ulasan di bagian bawah', () => {
      const campuran = [
        ...OUTLETS_PALSU,
        {
          id: 'out-kitchen',
          nama: 'Suka Shawarma Kitchen (Outlet Pusat)',
          slug: 'kitchen',
          kota: 'Bogor',
          ratingRataRata: 5.0,
          totalUlasan: 0,
          statusOperasional: 'good' as const,
          isActive: true,
        },
        {
          id: 'out-ciledug',
          nama: 'Suka Shawarma Ciledug',
          slug: 'ciledug',
          kota: 'Tangerang',
          ratingRataRata: 0,
          totalUlasan: 0,
          statusOperasional: 'good' as const,
          isActive: true,
        },
      ]
      const hasil = hitungRankingOutlet(campuran)
      // Kitchen Pusat & out-tes diabaikan, Ciledug masuk tapi tanpa ulasan
      expect(hasil.total_outlet).toBe(4)
      expect(hasil.peringkat.find((p) => p.outlet.includes('Kitchen'))).toBeUndefined()
      // Peringkat 1-3 adalah outlet dengan ulasan nyata (Empang 4.8, Cibinong 4.2, Kalisari 3.9)
      expect(hasil.peringkat[0].outlet).toBe('SUKA SHAWARMA EMPANG')
      expect(hasil.peringkat[1].outlet).toBe('MITRA CIBINONG')
      expect(hasil.peringkat[2].outlet).toBe('MITRA KALISARI')
      // Ciledug (0 ulasan) berada di peringkat terbawah dan berlabel belum ada ulasan
      const ciledug = hasil.peringkat[3]
      expect(ciledug.outlet).toBe('Suka Shawarma Ciledug')
      expect(ciledug.rating).toBe(0)
      expect(ciledug.catatan).toBe('Belum ada ulasan di Google Maps')
      expect(hasil.outlet_tanpa_ulasan).toEqual(['Suka Shawarma Ciledug'])
      // Rata-rata rating tidak terdistorsi oleh 0 ulasan
      expect(hasil.rata_rata_rating).toBe(4.3)
    })
  })

  describe('saringReviewNegatif', () => {
    it('menyaring ulasan dengan rating <= 2 atau sentimen negative', () => {
      const hasil = saringReviewNegatif(REVIEWS_PALSU)
      expect(hasil.total_ulasan_negatif).toBe(2)
      expect(hasil.daftar_ulasan.map((u) => u.rating)).toEqual([2, 1])
    })

    it('mendukung filter hanyaUrgensiTinggi', () => {
      const hasil = saringReviewNegatif(REVIEWS_PALSU, { hanyaUrgensiTinggi: true })
      expect(hasil.total_ulasan_negatif).toBe(1)
      expect(hasil.daftar_ulasan[0].urgensi).toBe('high')
      expect(hasil.daftar_ulasan[0].reviewer).toBe('Rian Pratama')
    })
  })

  describe('agregasiSentimen', () => {
    it('menghitung distribusi sentimen, bintang, dan topik komplain', () => {
      const hasil = agregasiSentimen(REVIEWS_PALSU)
      expect(hasil.total_ulasan).toBe(4)
      expect(hasil.sentimen.positif.jumlah).toBe(1)
      expect(hasil.sentimen.negatif.jumlah).toBe(2)
      expect(hasil.sentimen.netral.jumlah).toBe(1)
      expect(hasil.distribusi_bintang.bintang_5).toBe(1)
      expect(hasil.distribusi_bintang.bintang_1).toBe(1)
      expect(hasil.topik_keluhan_utama.length).toBeGreaterThan(0)
    })
  })

  describe('saringAlertAktif', () => {
    it('hanya mengambil alert dengan status active', () => {
      const hasil = saringAlertAktif(ALERTS_PALSU)
      expect(hasil.total_alert_aktif).toBe(2)
      expect(hasil.rekap_keparahan.high).toBe(1)
      expect(hasil.rekap_keparahan.medium).toBe(1)
    })

    it('dapat difilter berdasarkan tingkat severity', () => {
      const hasil = saringAlertAktif(ALERTS_PALSU, { severity: 'high' })
      expect(hasil.total_alert_aktif).toBe(1)
      expect(hasil.daftar_alert[0].severity).toBe('high')
    })
  })
})
