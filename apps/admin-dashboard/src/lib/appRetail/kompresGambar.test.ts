import { describe, it, expect } from 'vitest'
import {
  hitungDimensi,
  perluDiproses,
  formatDilewati,
  namaHasil,
  MAKS_SISI,
  BATAS_LEWATI_BYTE,
} from './kompresGambar'

describe('hitungDimensi', () => {
  it('tidak membesarkan gambar yang sudah lebih kecil dari batas', () => {
    expect(hitungDimensi(800, 600)).toEqual({ lebar: 800, tinggi: 600 })
  })

  it('menskala turun berdasar sisi TERPANJANG, bukan selalu lebar', () => {
    // Potret: tingginya yang melewati batas.
    expect(hitungDimensi(1000, 4000)).toEqual({ lebar: 320, tinggi: MAKS_SISI })
  })

  it('mempertahankan rasio pada gambar lanskap besar', () => {
    expect(hitungDimensi(4000, 3000)).toEqual({ lebar: MAKS_SISI, tinggi: 960 })
  })

  it('tidak pernah menghasilkan sisi 0 pada gambar sangat panjang-sempit', () => {
    // Canvas berukuran 0 melempar, jadi ini bukan sekadar kerapian.
    const d = hitungDimensi(8000, 1)
    expect(d.lebar).toBe(MAKS_SISI)
    expect(d.tinggi).toBeGreaterThanOrEqual(1)
  })

  it('mengembalikan 0 untuk dimensi tak masuk akal, bukan NaN', () => {
    expect(hitungDimensi(0, 500)).toEqual({ lebar: 0, tinggi: 0 })
    expect(hitungDimensi(Number.NaN, 500)).toEqual({ lebar: 0, tinggi: 0 })
    expect(hitungDimensi(-10, 500)).toEqual({ lebar: 0, tinggi: 0 })
  })
})

describe('formatDilewati', () => {
  it('melewati GIF (mengode ulang membuang animasinya)', () => {
    expect(formatDilewati('image/gif')).toBe(true)
  })

  it('melewati SVG (vektor tak boleh diraster)', () => {
    expect(formatDilewati('image/svg+xml')).toBe(true)
  })

  it('tidak melewati JPEG/PNG/WebP', () => {
    expect(formatDilewati('image/jpeg')).toBe(false)
    expect(formatDilewati('image/png')).toBe(false)
    expect(formatDilewati('image/webp')).toBe(false)
  })

  it('tahan huruf besar dan tipe kosong', () => {
    expect(formatDilewati('IMAGE/GIF')).toBe(true)
    expect(formatDilewati('')).toBe(false)
  })
})

describe('perluDiproses', () => {
  it('memproses gambar besar', () => {
    expect(perluDiproses({ type: 'image/jpeg', size: 5_252_621 })).toBe(true)
  })

  it('melewati gambar yang sudah kecil', () => {
    expect(perluDiproses({ type: 'image/jpeg', size: 120 * 1024 })).toBe(false)
  })

  it('melewati tepat di ambang, memproses satu byte di atasnya', () => {
    expect(perluDiproses({ type: 'image/jpeg', size: BATAS_LEWATI_BYTE })).toBe(false)
    expect(perluDiproses({ type: 'image/jpeg', size: BATAS_LEWATI_BYTE + 1 })).toBe(true)
  })

  it('melewati GIF besar sekalipun', () => {
    expect(perluDiproses({ type: 'image/gif', size: 9_000_000 })).toBe(false)
  })

  it('melewati berkas yang sama sekali bukan gambar', () => {
    expect(perluDiproses({ type: 'application/pdf', size: 9_000_000 })).toBe(false)
  })
})

describe('namaHasil', () => {
  it('mengganti akhiran mengikuti tipe hasil', () => {
    expect(namaHasil('promo.jpeg', 'image/webp')).toBe('promo.webp')
    expect(namaHasil('promo.png', 'image/jpeg')).toBe('promo.jpg')
  })

  it('menangani nama bertitik banyak', () => {
    expect(namaHasil('banner.v2.final.PNG', 'image/webp')).toBe('banner.v2.final.webp')
  })

  it('menangani nama tanpa akhiran', () => {
    expect(namaHasil('banner', 'image/webp')).toBe('banner.webp')
  })

  it('tidak menghasilkan nama yang diawali titik saja', () => {
    expect(namaHasil('.jpeg', 'image/webp')).toBe('banner.webp')
  })
})
