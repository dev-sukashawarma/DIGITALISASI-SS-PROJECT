import { describe, it, expect } from 'vitest'
import { matchesChannelFilter, isFoodAppOrder, getOrderGrossAmount } from './channel-filter'

// Bentuk baris nyata di tabel `orders` (lihat lib/order-source.ts).
const websiteOnline = { channel: null, sales_source: 'online' }      // pesanan dari website
const websiteBackup = { channel: 'website', sales_source: 'online' } // input manual mode "website"
const walkIn        = { channel: null, sales_source: 'pos' }
const gofood        = { channel: 'gofood', sales_source: 'gofood' }
const tiktok        = { channel: 'tiktokgo', sales_source: 'tiktok' }

describe('matchesChannelFilter', () => {
  it('"all" melewatkan semua', () => {
    for (const o of [websiteOnline, walkIn, gofood]) {
      expect(matchesChannelFilter(o, 'all')).toBe(true)
    }
  })

  it('menangkap pesanan website meski kolom channel NULL', () => {
    expect(matchesChannelFilter(websiteOnline, 'website')).toBe(true)
    expect(matchesChannelFilter(websiteBackup, 'website')).toBe(true)
    expect(matchesChannelFilter(walkIn, 'website')).toBe(false)
    expect(matchesChannelFilter(gofood, 'website')).toBe(false)
  })

  it('"offline" tidak ikut menghitung pesanan website', () => {
    expect(matchesChannelFilter(walkIn, 'offline')).toBe(true)
    expect(matchesChannelFilter(websiteOnline, 'offline')).toBe(false)
    expect(matchesChannelFilter(gofood, 'offline')).toBe(false)
  })

  it('food apps cocok lewat kolom mana pun, termasuk alias tiktok', () => {
    expect(matchesChannelFilter(gofood, 'food_apps')).toBe(true)
    expect(matchesChannelFilter(tiktok, 'food_apps')).toBe(true)
    expect(matchesChannelFilter(tiktok, 'tiktokgo')).toBe(true)
    expect(matchesChannelFilter(gofood, 'tiktokgo')).toBe(false)
    expect(matchesChannelFilter(websiteOnline, 'food_apps')).toBe(false)
    expect(matchesChannelFilter(walkIn, 'food_apps')).toBe(false)
  })
})

describe('isFoodAppOrder', () => {
  it('mengenali food app dari kolom mana pun', () => {
    expect(isFoodAppOrder(gofood)).toBe(true)
    expect(isFoodAppOrder(tiktok)).toBe(true)
    expect(isFoodAppOrder({ channel: 'shopeefood', sales_source: null })).toBe(true)
    expect(isFoodAppOrder({ channel: null, sales_source: 'grabfood' })).toBe(true)
  })

  it('bukan food app: walk-in & website', () => {
    expect(isFoodAppOrder(walkIn)).toBe(false)
    expect(isFoodAppOrder(websiteOnline)).toBe(false)
    expect(isFoodAppOrder(websiteBackup)).toBe(false)
    expect(isFoodAppOrder({})).toBe(false)
  })
})

// Regresi yang sudah dua kali terjadi: promo malah MENAIKKAN omzet karena
// discount_amount / promo_subsidy ditambahkan balik ke total_amount.
describe('getOrderGrossAmount', () => {
  it('promo offline MENGURANGI omzet, bukan menambah', () => {
    // Harga asli 50rb, diskon 10rb → kasir terima 40rb.
    const order = { ...walkIn, total_amount: 40_000, discount_amount: 10_000, promo_subsidy: 0 }
    expect(getOrderGrossAmount(order)).toBe(40_000)
  })

  it('order offline tanpa promo: omzet = total apa adanya', () => {
    expect(getOrderGrossAmount({ ...walkIn, total_amount: 50_000 })).toBe(50_000)
  })

  it('food apps: omzet = harga menu asli, subsidi app TIDAK ikut ditambahkan', () => {
    // total_amount sudah harga asli 50rb; subsidi 15rb murni info "Potongan App".
    const order = { ...gofood, total_amount: 50_000, discount_amount: 15_000, promo_subsidy: 15_000 }
    expect(getOrderGrossAmount(order)).toBe(50_000)
  })

  it('total_amount kosong/invalid dianggap 0', () => {
    expect(getOrderGrossAmount({ total_amount: null })).toBe(0)
    expect(getOrderGrossAmount({})).toBe(0)
  })
})
