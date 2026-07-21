import { describe, it, expect } from 'vitest'
import { calculateItemPrice, BasePromo } from './promo-calculator'

/**
 * Harga hasil promo dipakai langsung sebagai unit_price -> subtotal -> total_amount
 * (kolom numeric(10,2)), lalu tercetak di struk. Nilai pecahan tak bisa diterima
 * kasir secara fisik, jadi setoran laci selalu meleset tipis dari catatan sistem.
 * Pembulatan dilakukan di harga SATUAN supaya unit_price * qty = subtotal tetap konsisten.
 */

const globalPromo = (over: Partial<BasePromo> = {}): BasePromo => ({
  scope: 'global',
  menu_item_id: null,
  discount_type: 'percentage',
  discount_value: 33,
  is_active: true,
  ...over,
})

const itemPromo = (menuId: string, over: Partial<BasePromo> = {}): BasePromo => ({
  scope: 'item',
  menu_item_id: menuId,
  discount_type: 'percentage',
  discount_value: 33,
  is_active: true,
  ...over,
})

describe('calculateItemPrice - pembulatan rupiah', () => {
  it('membulatkan hasil promo persentase global ke rupiah utuh', () => {
    // 12345 * 0.67 = 8271.15
    const harga = calculateItemPrice(12345, 'menu-1', [globalPromo()])
    expect(Number.isInteger(harga)).toBe(true)
    expect(harga).toBe(8271)
  })

  it('membulatkan hasil promo persentase per-item ke rupiah utuh', () => {
    const harga = calculateItemPrice(12345, 'menu-1', [itemPromo('menu-1')])
    expect(Number.isInteger(harga)).toBe(true)
    expect(harga).toBe(8271)
  })

  it('membulatkan ke atas saat pecahannya >= 0.5', () => {
    // 17500 * 0.85 = 14875 (bulat); pakai 15% dari 12341 -> 10489.85
    const harga = calculateItemPrice(12341, 'menu-1', [globalPromo({ discount_value: 15 })])
    expect(harga).toBe(10490)
  })

  it('promo nominal tetap menghasilkan rupiah utuh', () => {
    const harga = calculateItemPrice(
      12000,
      'menu-1',
      [globalPromo({ discount_type: 'nominal', discount_value: 2500.5 })]
    )
    expect(Number.isInteger(harga)).toBe(true)
  })
})

describe('calculateItemPrice - perilaku yang TIDAK boleh berubah', () => {
  it('harga tanpa promo apa pun tetap apa adanya', () => {
    expect(calculateItemPrice(15000, 'menu-1', [])).toBe(15000)
  })

  it('kombinasi bulat yang sudah dipakai produksi tetap sama', () => {
    // Semua promo produksi saat ini kelipatan 10% dengan harga menu bulat
    expect(calculateItemPrice(12500, 'menu-1', [globalPromo({ discount_value: 20 })])).toBe(10000)
    expect(calculateItemPrice(20000, 'menu-1', [globalPromo({ discount_value: 10 })])).toBe(18000)
    expect(calculateItemPrice(15000, 'menu-1', [globalPromo({ discount_value: 40 })])).toBe(9000)
  })

  it('promo kedaluwarsa diabaikan', () => {
    const kadaluarsa = globalPromo({ end_date: '2020-01-01T00:00:00Z' })
    expect(calculateItemPrice(12345, 'menu-1', [kadaluarsa])).toBe(12345)
  })

  it('promo yang kuotanya habis diabaikan', () => {
    const habis = globalPromo({ usage_limit: 3, current_usage: 3 })
    expect(calculateItemPrice(12345, 'menu-1', [habis])).toBe(12345)
  })

  it('min_purchase yang belum tercapai diabaikan', () => {
    const minBeli = globalPromo({ min_purchase: 50000 })
    expect(calculateItemPrice(12345, 'menu-1', [minBeli], 10000)).toBe(12345)
  })

  it('harga tidak pernah negatif', () => {
    const besar = globalPromo({ discount_type: 'nominal', discount_value: 99999 })
    expect(calculateItemPrice(12345, 'menu-1', [besar])).toBe(0)
  })
})
