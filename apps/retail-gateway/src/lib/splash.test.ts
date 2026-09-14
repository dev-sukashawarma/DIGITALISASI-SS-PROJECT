import { describe, it, expect } from 'vitest'
import { petakanSplash, SPLASH_BAWAAN, DURASI_MIN_MS, DURASI_MAKS_MS } from './splash'

describe('petakanSplash', () => {
  it('memetakan baris lengkap', () => {
    expect(petakanSplash({ gambar_url: 'https://x/splash.webp', durasi_ms: 2500 })).toEqual({
      gambar_url: 'https://x/splash.webp',
      durasi_ms: 2500,
    })
  })

  it('baris tidak ada -> bawaan (gambar APK, 3 detik)', () => {
    expect(petakanSplash(null)).toEqual(SPLASH_BAWAAN)
    expect(petakanSplash(undefined)).toEqual(SPLASH_BAWAAN)
  })

  it('gambar kosong atau hanya spasi -> null', () => {
    expect(petakanSplash({ gambar_url: '   ', durasi_ms: 3000 }).gambar_url).toBeNull()
    expect(petakanSplash({ gambar_url: null, durasi_ms: 3000 }).gambar_url).toBeNull()
  })

  it('menolak URL selain https', () => {
    expect(petakanSplash({ gambar_url: 'http://x/a.jpg', durasi_ms: 3000 }).gambar_url).toBeNull()
    expect(petakanSplash({ gambar_url: 'file:///data/a.jpg', durasi_ms: 3000 }).gambar_url).toBeNull()
  })

  it('membatasi durasi ke 1-5 detik', () => {
    expect(petakanSplash({ gambar_url: null, durasi_ms: 50 }).durasi_ms).toBe(DURASI_MIN_MS)
    expect(petakanSplash({ gambar_url: null, durasi_ms: 60000 }).durasi_ms).toBe(DURASI_MAKS_MS)
  })

  it('durasi bukan angka -> 3 detik', () => {
    expect(petakanSplash({ gambar_url: null, durasi_ms: '3000' }).durasi_ms).toBe(3000)
    expect(petakanSplash({ gambar_url: null, durasi_ms: Number.NaN }).durasi_ms).toBe(3000)
  })
})
