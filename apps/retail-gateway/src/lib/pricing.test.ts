import { describe, it, expect } from 'vitest'
import { hitungTotal, type ItemPesanan } from './pricing'

const item = (harga: number, qty: number): ItemPesanan => ({
  menu_item_id: '33333333-3333-3333-3333-333333333333',
  name: 'Shawarma Ayam Original',
  unit_price: harga,
  quantity: qty,
})

describe('hitungTotal', () => {
  it('menjumlahkan subtotal tanpa diskon', () => {
    expect(hitungTotal([item(25000, 2), item(15000, 1)], 0)).toEqual({
      subtotal: 65000,
      discountAmount: 0,
      total: 65000,
    })
  })

  it('menerapkan diskon persen dan membulatkan ke rupiah utuh', () => {
    expect(hitungTotal([item(25000, 1)], 20)).toEqual({
      subtotal: 25000,
      discountAmount: 5000,
      total: 20000,
    })
  })

  it('tidak menghasilkan pecahan rupiah', () => {
    const hasil = hitungTotal([item(8333, 1)], 15)
    expect(Number.isInteger(hasil.discountAmount)).toBe(true)
    expect(Number.isInteger(hasil.total)).toBe(true)
    expect(hasil.subtotal - hasil.discountAmount).toBe(hasil.total)
  })

  it('membatasi potongan maksimal 50 persen dari subtotal', () => {
    const hasil = hitungTotal([item(20000, 1)], 80)
    expect(hasil.discountAmount).toBe(10000)
    expect(hasil.total).toBe(10000)
  })

  it('menolak keranjang kosong dengan total nol', () => {
    expect(hitungTotal([], 20)).toEqual({ subtotal: 0, discountAmount: 0, total: 0 })
  })
})
