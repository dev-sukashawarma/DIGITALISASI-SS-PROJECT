import { describe, it, expect } from 'vitest'
import { calculateItemDiscount, resolveBasePrice, calculateItemPrice } from './promo-calculator'

describe('calculateItemDiscount', () => {
  it('mencatat selisih harga saat promo menurunkan harga satuan', () => {
    // harga asli 40.000, setelah promo jadi 30.000, beli 1
    expect(calculateItemDiscount(40000, 30000, 1)).toBe(10000)
  })

  it('mengalikan selisih dengan quantity', () => {
    expect(calculateItemDiscount(40000, 30000, 3)).toBe(30000)
  })

  it('nol saat tidak ada promo', () => {
    expect(calculateItemDiscount(40000, 40000, 2)).toBe(0)
  })

  it('nol untuk order endorse — makanan gratis bukan potongan penjualan', () => {
    // Keputusan owner 2026-07-31: endorse dikecualikan dari Total Potongan,
    // supaya angka potongan tetap murni promo/diskon jual-beli.
    expect(calculateItemDiscount(40000, 0, 2, { isGiveaway: true })).toBe(0)
  })
})

describe('resolveBasePrice', () => {
  it('pakai harga menu biasa saat tak ada channel price', () => {
    expect(resolveBasePrice(40000, undefined, null)).toBe(40000)
    expect(resolveBasePrice(40000, 'pos', null)).toBe(40000)
  })

  it('pakai harga channel saat channel punya harga sendiri', () => {
    expect(resolveBasePrice(40000, 'gofood', { gofood: 45000 })).toBe(45000)
  })

  it('markup channel BUKAN diskon — harga acuan ikut naik jadi selisihnya nol', () => {
    // GoFood di-markup 45.000 (nutupi komisi), tanpa promo apa pun.
    // Kalau harga acuan salah ambil menu.price (40.000), diskon jadi -5.000
    // dan Omzet Kotor di laporan jadi lebih kecil dari Pendapatan Bersih.
    const channelPrices = { gofood: 45000 }
    const unitPrice = calculateItemPrice(40000, 'menu-1', [], undefined, 'gofood', channelPrices)
    const basePrice = resolveBasePrice(40000, 'gofood', channelPrices)

    expect(unitPrice).toBe(45000)
    expect(calculateItemDiscount(basePrice, unitPrice, 1)).toBe(0)
  })
})
