import { describe, it, expect } from 'vitest'
import { petakanBanner, pilihPopup, type BannerApp } from './banners'

function contoh(ubah: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'b1', badge: '🔥 Promo', judul: 'Judul', subjudul: 'Sub',
    teks_tombol: 'Pesan', gambar_url: 'https://x/y.jpg',
    aksi: 'tidak_ada', target_menu_item_id: null, urutan: 0, ...ubah,
  }
}

describe('petakanBanner', () => {
  it('memetakan baris lengkap', () => {
    expect(petakanBanner(contoh())?.judul).toBe('Judul')
  })

  it('menolak baris tanpa judul', () => {
    expect(petakanBanner(contoh({ judul: null }))).toBeNull()
  })

  it('menolak aksi yang tidak dikenal', () => {
    expect(petakanBanner(contoh({ aksi: 'buka_url' }))).toBeNull()
  })

  it('menolak menu_item tanpa target', () => {
    expect(petakanBanner(contoh({ aksi: 'menu_item' }))).toBeNull()
  })

  it('mengosongkan teks kosong jadi null', () => {
    expect(petakanBanner(contoh({ badge: '' }))?.badge).toBeNull()
  })
})

describe('pilihPopup', () => {
  // `urutan` WAJIB lewat argumen contoh(), bukan disebar sebelum spread --
  // spread menang, jadi `{ urutan: 5, ...contoh() }` diam-diam jadi 0.
  const a = contoh({ id: 'a', urutan: 5 }) as unknown as BannerApp
  const b = contoh({ id: 'b', urutan: 1 }) as unknown as BannerApp

  it('mengembalikan null saat tidak ada', () => {
    expect(pilihPopup([])).toBeNull()
  })

  it('memilih urutan terkecil saat lebih dari satu', () => {
    expect(pilihPopup([a, b])?.id).toBe('b')
  })
})
