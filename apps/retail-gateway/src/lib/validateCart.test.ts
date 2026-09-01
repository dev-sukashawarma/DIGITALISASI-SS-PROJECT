import { describe, it, expect } from 'vitest'
import { periksaKeranjang, jumlahWajar } from './validateCart'
import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'

const menu = (over: Partial<MenuApp> = {}): MenuApp => ({
  id: 'm1',
  name: 'Shawarma Ayam Original',
  description: null,
  price: 25000,
  image_url: null,
  is_available: true,
  category_id: null,
  sort_order: null,
  ...over,
})

const keranjang = (over: Partial<ItemPesanan> = {}): ItemPesanan => ({
  menu_item_id: 'm1',
  name: 'Shawarma Ayam Original',
  unit_price: 25000,
  quantity: 1,
  ...over,
})

describe('periksaKeranjang', () => {
  it('tidak melaporkan masalah saat semuanya cocok', () => {
    expect(periksaKeranjang([keranjang()], [menu()])).toEqual([])
  })

  it('melaporkan item yang sudah habis', () => {
    const masalah = periksaKeranjang([keranjang()], [menu({ is_available: false })])
    expect(masalah).toEqual([
      { menu_item_id: 'm1', name: 'Shawarma Ayam Original', jenis: 'habis' },
    ])
  })

  it('melaporkan harga yang berubah beserta harga barunya', () => {
    const masalah = periksaKeranjang([keranjang()], [menu({ price: 28000 })])
    expect(masalah).toEqual([
      {
        menu_item_id: 'm1',
        name: 'Shawarma Ayam Original',
        jenis: 'harga_berubah',
        harga_baru: 28000,
      },
    ])
  })

  it('melaporkan item yang sudah tidak ada di katalog', () => {
    const masalah = periksaKeranjang([keranjang({ menu_item_id: 'hilang' })], [menu()])
    expect(masalah).toEqual([
      { menu_item_id: 'hilang', name: 'Shawarma Ayam Original', jenis: 'tidak_ada' },
    ])
  })

  it('menerima jumlah bulat wajar', () => {
    expect(jumlahWajar([keranjang({ quantity: 1 }), keranjang({ quantity: 99 })])).toBe(true)
  })

  it('menolak jumlah nol, negatif, pecahan, NaN, dan di atas 99', () => {
    expect(jumlahWajar([keranjang({ quantity: 0 })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: -5 })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: 1.5 })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: NaN })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: 100 })])).toBe(false)
  })

  it('menolak kalau SATU item saja tidak wajar', () => {
    expect(jumlahWajar([keranjang({ quantity: 2 }), keranjang({ quantity: -1 })])).toBe(false)
  })

  it('melaporkan setiap item bermasalah, bukan hanya yang pertama', () => {
    const masalah = periksaKeranjang(
      [keranjang(), keranjang({ menu_item_id: 'm2', name: 'Es Teh Manis', unit_price: 8000 })],
      [menu({ is_available: false }), menu({ id: 'm2', name: 'Es Teh Manis', price: 9000 })]
    )
    expect(masalah).toHaveLength(2)
    expect(masalah[0].jenis).toBe('habis')
    expect(masalah[1].jenis).toBe('harga_berubah')
  })
})
