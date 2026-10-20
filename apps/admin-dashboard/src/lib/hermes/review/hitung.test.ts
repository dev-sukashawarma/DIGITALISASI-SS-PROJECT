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
