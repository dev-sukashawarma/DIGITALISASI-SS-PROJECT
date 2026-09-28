import { describe, expect, it } from 'vitest'
import { alasanTolakHapus, lokasiGambar } from './hapusMenu'

describe('alasanTolakHapus', () => {
  it('boleh dihapus bila tak pernah terjual dan bukan isi paket', () => {
    expect(alasanTolakHapus('tesss', { terjual: 0, jadiIsiPaket: 0 })).toBeNull()
  })

  it('ditolak bila pernah terjual', () => {
    const a = alasanTolakHapus('PAKET COUPLE', { terjual: 21, jadiIsiPaket: 0 })
    expect(a).toContain('21 baris penjualan')
    expect(a).toContain('Nonaktifkan saja')
  })

  it('ditolak bila masih jadi isi paket lain', () => {
    const a = alasanTolakHapus('Original Sapi Reguler', { terjual: 0, jadiIsiPaket: 1 })
    expect(a).toContain('isi 1 paket')
  })

  it('menyebut kedua alasan sekaligus', () => {
    const a = alasanTolakHapus('Ice Tea', { terjual: 1234, jadiIsiPaket: 20 })
    expect(a).toContain('1.234 baris penjualan dan masih menjadi isi 20 paket')
  })
})

describe('lokasiGambar', () => {
  it('membaca bucket dari URL, bukan menebak', () => {
    expect(lokasiGambar('https://x.supabase.co/storage/v1/object/public/menu-images/17866-abc.webp'))
      .toEqual({ bucket: 'menu-images', path: '17866-abc.webp' })
  })

  it('null untuk URL kosong atau asing', () => {
    expect(lokasiGambar(null)).toBeNull()
    expect(lokasiGambar('https://contoh.com/gambar.png')).toBeNull()
  })
})
