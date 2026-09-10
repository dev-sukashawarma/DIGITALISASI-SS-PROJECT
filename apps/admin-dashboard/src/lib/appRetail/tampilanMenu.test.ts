import { describe, it, expect } from 'vitest'
import { namaKategori, hargaAplikasiTampil } from './tampilanMenu'

describe('namaKategori', () => {
  it('membaca bentuk objek', () => {
    expect(namaKategori({ name: 'Minuman' })).toBe('Minuman')
  })
  it('membaca bentuk array yang dikembalikan PostgREST saat kardinalitas tak pasti', () => {
    expect(namaKategori([{ name: 'Minuman' }])).toBe('Minuman')
  })
  it('menjadi tanda pisah bila kategori kosong', () => {
    expect(namaKategori(null)).toBe('—')
    expect(namaKategori([])).toBe('—')
  })
})

describe('hargaAplikasiTampil', () => {
  it('mengembalikan harga aplikasi bila diisi', () => {
    expect(hargaAplikasiTampil({ aplikasi: '9000' })).toBe(9000)
  })
  it('null berarti ikut harga kasir', () => {
    expect(hargaAplikasiTampil({ gofood: '15000' })).toBeNull()
    expect(hargaAplikasiTampil({ aplikasi: '0' })).toBeNull()
    expect(hargaAplikasiTampil(null)).toBeNull()
    expect(hargaAplikasiTampil('bukan json')).toBeNull()
  })
  it('menerima bentuk string JSON', () => {
    expect(hargaAplikasiTampil('{"aplikasi":"9500"}')).toBe(9500)
  })
})
