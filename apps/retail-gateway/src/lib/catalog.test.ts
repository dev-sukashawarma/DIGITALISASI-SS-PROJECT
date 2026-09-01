import { describe, it, expect } from 'vitest'
import { bersihkanKatalog } from './catalog'

describe('bersihkanKatalog', () => {
  it('memakai deskripsi_app bila ada, jatuh ke description bila tidak', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: 25000,
        description: 'deskripsi kasir', deskripsi_app: 'Ayam panggang, sayur segar, saus khas',
        image_url: null, foto_app: null, is_available: true, category_id: 'c1', sort_order: 1,
      },
      {
        id: 'b', name: 'Kebab Mini', price: 15000,
        description: 'deskripsi kasir', deskripsi_app: null,
        image_url: null, foto_app: null, is_available: true, category_id: 'c1', sort_order: 2,
      },
    ])
    expect(hasil[0].description).toBe('Ayam panggang, sayur segar, saus khas')
    expect(hasil[1].description).toBe('deskripsi kasir')
  })

  it('memakai foto_app bila ada, jatuh ke image_url bila tidak', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: 25000, description: null,
        deskripsi_app: null, image_url: 'kasir.jpg', foto_app: 'app.jpg',
        is_available: true, category_id: null, sort_order: null,
      },
      {
        id: 'b', name: 'Es Teh Manis', price: 8000, description: null,
        deskripsi_app: null, image_url: 'kasir.jpg', foto_app: null,
        is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil[0].image_url).toBe('app.jpg')
    expect(hasil[1].image_url).toBe('kasir.jpg')
  })

  it('memaksa harga jadi angka', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: '25000', description: null,
        deskripsi_app: null, image_url: null, foto_app: null,
        is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil[0].price).toBe(25000)
  })

  it('memperlakukan ketersediaan yang tidak diketahui sebagai habis', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: 25000, description: null,
        deskripsi_app: null, image_url: null, foto_app: null,
        is_available: null, category_id: null, sort_order: null,
      },
      {
        id: 'b', name: 'Kebab Mini', price: 15000, description: null,
        deskripsi_app: null, image_url: null, foto_app: null,
        category_id: null, sort_order: null,
      },
    ])
    expect(hasil[0].is_available).toBe(false)
    expect(hasil[1].is_available).toBe(false)
  })

  it('membuang baris dengan harga tak sah alih-alih mengirim NaN', () => {
    const hasil = bersihkanKatalog([
      { id: 'a', name: 'Harga huruf', price: 'abc', is_available: true },
      { id: 'b', name: 'Harga negatif', price: -500, is_available: true },
      { id: 'c', name: 'Tanpa harga', is_available: true },
      {
        id: 'd', name: 'Sah', price: 12000, description: null, deskripsi_app: null,
        image_url: null, foto_app: null, is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].id).toBe('d')
    expect(hasil[0].price).toBe(12000)
  })

  it('membuang baris tanpa id atau nama', () => {
    const hasil = bersihkanKatalog([
      { id: null, name: 'Tanpa id', price: 1000 },
      { id: 'a', name: null, price: 1000 },
      {
        id: 'b', name: 'Sah', price: 1000, description: null, deskripsi_app: null,
        image_url: null, foto_app: null, is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].id).toBe('b')
  })
})
