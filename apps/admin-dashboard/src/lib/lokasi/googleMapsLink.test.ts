import { describe, it, expect } from 'vitest'
import {
  bacaTempelanLokasi,
  hostGoogleMapsDiizinkan,
  parseDms,
  diLuarIndonesia,
  titikDariUrlMaps,
} from './googleMapsLink'

describe('googleMapsLink parser', () => {
  describe('hostGoogleMapsDiizinkan', () => {
    it('mengizinkan domain google maps yang sah', () => {
      expect(hostGoogleMapsDiizinkan('maps.app.goo.gl')).toBe(true)
      expect(hostGoogleMapsDiizinkan('goo.gl')).toBe(true)
      expect(hostGoogleMapsDiizinkan('consent.google.com')).toBe(true)
      expect(hostGoogleMapsDiizinkan('google.com')).toBe(true)
      expect(hostGoogleMapsDiizinkan('www.google.com')).toBe(true)
      expect(hostGoogleMapsDiizinkan('maps.google.com')).toBe(true)
      expect(hostGoogleMapsDiizinkan('google.co.id')).toBe(true)
      expect(hostGoogleMapsDiizinkan('www.google.co.id')).toBe(true)
      expect(hostGoogleMapsDiizinkan('maps.google.co.id')).toBe(true)
    })

    it('menolak domain luar atau percobaan spoofing host', () => {
      expect(hostGoogleMapsDiizinkan('evil.com')).toBe(false)
      expect(hostGoogleMapsDiizinkan('google.com.evil.com')).toBe(false)
      expect(hostGoogleMapsDiizinkan('attacker-maps.app.goo.gl')).toBe(false)
      expect(hostGoogleMapsDiizinkan('google.net')).toBe(false)
    })
  })

  describe('bacaTempelanLokasi - link pendek', () => {
    it('mendeteksi short link maps.app.goo.gl sebagai link_pendek', () => {
      const res = bacaTempelanLokasi('https://maps.app.goo.gl/w1nL6wS8T4e9yJ128')
      expect(res.jenis).toBe('link_pendek')
      if (res.jenis === 'link_pendek') {
        expect(res.url).toBe('https://maps.app.goo.gl/w1nL6wS8T4e9yJ128')
      }
    })

    it('mendeteksi short link goo.gl/maps sebagai link_pendek', () => {
      const res = bacaTempelanLokasi('https://goo.gl/maps/AbCdEfGhIjK')
      expect(res.jenis).toBe('link_pendek')
      if (res.jenis === 'link_pendek') {
        expect(res.url).toBe('https://goo.gl/maps/AbCdEfGhIjK')
      }
    })

    it('mendeteksi link pendek yang ditempel bersama teks tambahan', () => {
      const res = bacaTempelanLokasi('Outlet Suka Shawarma Bogor\nhttps://maps.app.goo.gl/w1nL6wS8T4e9yJ128')
      expect(res.jenis).toBe('link_pendek')
      if (res.jenis === 'link_pendek') {
        expect(res.url).toBe('https://maps.app.goo.gl/w1nL6wS8T4e9yJ128')
      }
    })

    it('menolak goo.gl non-maps', () => {
      const res = bacaTempelanLokasi('https://goo.gl/other-link')
      expect(res.jenis).toBe('bukan_link_maps')
    })
  })

  describe('bacaTempelanLokasi - koordinat dan nama tempat dari link maps', () => {
    it('mengekstrak koordinat pin dari parameter data !3d !4d dan nama tempat', () => {
      const url = 'https://www.google.com/maps/place/Suka+Shawarma/@-6.597143,106.806038,17z/data=!3m1!4b1!4m6!3m5!1s0x2e69c5e!8m2!3d-6.597143!4d106.806038!16s'
      const res = bacaTempelanLokasi(url)
      expect(res.jenis).toBe('titik')
      if (res.jenis === 'titik') {
        expect(res.titik.lat).toBeCloseTo(-6.597143, 5)
        expect(res.titik.lng).toBeCloseTo(106.806038, 5)
        expect(res.titik.akurasi).toBe('pin')
        expect(res.namaTempat).toBe('Suka Shawarma')
      }
    })

    it('mengekstrak koordinat dari parameter query (?q=lat,lng)', () => {
      const url = 'https://maps.google.com/?q=-6.597143,106.806038'
      const res = bacaTempelanLokasi(url)
      expect(res.jenis).toBe('titik')
      if (res.jenis === 'titik') {
        expect(res.titik.lat).toBeCloseTo(-6.597143, 5)
        expect(res.titik.lng).toBeCloseTo(106.806038, 5)
        expect(res.titik.akurasi).toBe('pin')
      }
    })

    it('membaca titik tengah layar jika hanya ada @lat,lng tanpa pin data', () => {
      const url = 'https://www.google.com/maps/@-6.597143,106.806038,17z'
      const res = bacaTempelanLokasi(url)
      expect(res.jenis).toBe('titik')
      if (res.jenis === 'titik') {
        expect(res.titik.lat).toBeCloseTo(-6.597143, 5)
        expect(res.titik.lng).toBeCloseTo(106.806038, 5)
        expect(res.titik.akurasi).toBe('tengah_peta')
      }
    })

    it('mengembalikan jenis tanpa_koordinat jika URL maps tidak mengandung titik koordinat', () => {
      const url = 'https://www.google.com/maps/place/Suka+Shawarma'
      const res = bacaTempelanLokasi(url)
      expect(res.jenis).toBe('tanpa_koordinat')
      if (res.jenis === 'tanpa_koordinat') {
        expect(res.namaTempat).toBe('Suka Shawarma')
      }
    })
  })

  describe('bacaTempelanLokasi - koordinat mentah', () => {
    it('mengekstrak koordinat dari format koma desimal langsung', () => {
      const res = bacaTempelanLokasi('-6.597143, 106.806038')
      expect(res.jenis).toBe('titik')
      if (res.jenis === 'titik') {
        expect(res.titik.lat).toBeCloseTo(-6.597143, 5)
        expect(res.titik.lng).toBeCloseTo(106.806038, 5)
        expect(res.titik.akurasi).toBe('pin')
        expect(res.namaTempat).toBeNull()
      }
    })

    it('mengekstrak koordinat dari format DMS (derajat menit detik)', () => {
      const res = bacaTempelanLokasi('6°35\'49.6"S 106°48\'21.6"E')
      expect(res.jenis).toBe('titik')
      if (res.jenis === 'titik') {
        expect(res.titik.lat).toBeCloseTo(-6.597111, 4)
        expect(res.titik.lng).toBeCloseTo(106.806000, 4)
        expect(res.titik.akurasi).toBe('pin')
        expect(res.namaTempat).toBeNull()
      }
    })

    it('mengembalikan bukan_link_maps untuk teks kosong atau sembarang teks non-maps', () => {
      expect(bacaTempelanLokasi('').jenis).toBe('bukan_link_maps')
      expect(bacaTempelanLokasi('   ').jenis).toBe('bukan_link_maps')
      expect(bacaTempelanLokasi('halo nama saya admin').jenis).toBe('bukan_link_maps')
      expect(bacaTempelanLokasi('https://example.com/test').jenis).toBe('bukan_link_maps')
    })
  })

  describe('parseDms', () => {
    it('mem-parsing format DMS standar dengan arah S dan E', () => {
      const hasil = parseDms('6°35\'49.6"S 106°48\'21.6"E')
      expect(hasil).not.toBeNull()
      expect(hasil!.lat).toBeCloseTo(-6.597111, 4)
      expect(hasil!.lng).toBeCloseTo(106.806000, 4)
    })

    it('mem-parsing format DMS dengan arah N dan W (negatif lng)', () => {
      const hasil = parseDms('40°42\'46.0"N 74°00\'21.6"W')
      expect(hasil).not.toBeNull()
      expect(hasil!.lat).toBeCloseTo(40.712778, 4)
      expect(hasil!.lng).toBeCloseTo(-74.006000, 4)
    })

    it('mem-parsing format bahasa Indonesia (Selatan / Barat / Timur)', () => {
      const hasil = parseDms('6°35\'49.6"S 106°48\'21.6"T')
      expect(hasil).not.toBeNull()
      expect(hasil!.lat).toBeCloseTo(-6.597111, 4)
      expect(hasil!.lng).toBeCloseTo(106.806000, 4)
    })

    it('mengembalikan null untuk format yang tidak lengkap atau tidak valid', () => {
      expect(parseDms('bukan koordinat dms')).toBeNull()
      expect(parseDms('6°35\'49.6"S')).toBeNull()
    })
  })

  describe('diLuarIndonesia', () => {
    it('mengembalikan false untuk koordinat di dalam wilayah Indonesia', () => {
      // Jakarta
      expect(diLuarIndonesia(-6.2088, 106.8456)).toBe(false)
      // Sabang, Aceh
      expect(diLuarIndonesia(5.89, 95.32)).toBe(false)
      // Merauke, Papua
      expect(diLuarIndonesia(-8.49, 140.40)).toBe(false)
    })

    it('mengembalikan true untuk koordinat di luar wilayah Indonesia', () => {
      // Tokyo, Jepang
      expect(diLuarIndonesia(35.6762, 139.6503)).toBe(true)
      // London, UK
      expect(diLuarIndonesia(51.5074, -0.1278)).toBe(true)
    })
  })

  describe('titikDariUrlMaps', () => {
    it('mengekstrak titik dari path place /maps/place/-6.59,106.80', () => {
      const u = new URL('https://www.google.com/maps/place/-6.597143,106.806038')
      const titik = titikDariUrlMaps(u)
      expect(titik).not.toBeNull()
      expect(titik!.lat).toBeCloseTo(-6.597143, 5)
      expect(titik!.lng).toBeCloseTo(106.806038, 5)
      expect(titik!.akurasi).toBe('pin')
    })
  })
})
