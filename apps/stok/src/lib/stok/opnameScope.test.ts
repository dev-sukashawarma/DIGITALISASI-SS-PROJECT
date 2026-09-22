import { describe, it, expect } from 'vitest'
import { isBahanOpname } from './opnameScope'

describe('isBahanOpname', () => {
  it('menolak kategori ASET & PERLENGKAPAN, apa pun hurufnya', () => {
    expect(isBahanOpname({ nama: 'PRINTER THERMAL', kategori: 'ASET' })).toBe(false)
    expect(isBahanOpname({ nama: 'ID CARD', kategori: 'PERLENGKAPAN' })).toBe(false)
    expect(isBahanOpname({ nama: 'Barang Lain', kategori: ' aset ' })).toBe(false)
  })

  it('menolak PRINTER THERMAL & ID CARD walau kategorinya bergeser', () => {
    expect(isBahanOpname({ nama: 'printer thermal', kategori: 'OPERASIONAL' })).toBe(false)
    expect(isBahanOpname({ nama: ' ID CARD ', kategori: null })).toBe(false)
  })

  it('menerima bahan baku biasa', () => {
    expect(isBahanOpname({ nama: 'AYAM', kategori: 'FOOD & BEVERAGE' })).toBe(true)
    expect(isBahanOpname({ nama: 'KERTAS STRUK', kategori: 'OPERASIONAL' })).toBe(true)
    expect(isBahanOpname({ nama: 'AQUA', kategori: null })).toBe(true)
  })
})
