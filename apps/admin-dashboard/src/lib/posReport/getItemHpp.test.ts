import { describe, it, expect } from 'vitest'
import { getItemHpp } from './compute'
import { adalahKanalSsOnline } from '@/lib/hpp/kanalSsOnline'

const TIKTOK_SHOP_ID = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'
const SHOPEE_ID = 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'

// Harga SS Online (marketplace) 14.022, harga biasa 18.310 — angka nyata
// "Original Ayam Besar" per 19 Sep 2026.
const ayamBesar = {
  id: 'ayam',
  hpp_override: 18310,
  channel_hpp: { ss_online: 14022, shopee_shop: 14022, tiktok_shop: 14022 },
  is_package: false,
}

describe('adalahKanalSsOnline', () => {
  it('menerima hanya kanal marketplace (Shopee & TikTok Shop)', () => {
    for (const ch of ['ss_online', 'ss-online', 'SS_ONLINE', 'tiktok_shop', 'shopee_shop', TIKTOK_SHOP_ID, SHOPEE_ID]) {
      expect(adalahKanalSsOnline(ch)).toBe(true)
    }
  })

  it('menolak food apps & kanal lain walau namanya mirip', () => {
    for (const ch of ['shopeefood', 'tiktokgo', 'tiktok', 'shopee', 'gofood', 'grabfood', 'pos', '', null, undefined]) {
      expect(adalahKanalSsOnline(ch)).toBe(false)
    }
  })
})

describe('getItemHpp — pemilihan HPP SS Online', () => {
  it('ShopeeFood memakai HPP biasa, bukan SS Online', () => {
    expect(getItemHpp(ayamBesar, 'outlet', undefined, undefined, 'shopeefood')).toBe(18310)
  })

  it('TikTok GO memakai HPP biasa, bukan SS Online', () => {
    expect(getItemHpp(ayamBesar, 'outlet', undefined, undefined, 'tiktokgo')).toBe(18310)
  })

  it('marketplace (kanal UUID ecommerce) tetap memakai HPP SS Online', () => {
    expect(getItemHpp(ayamBesar, 'outlet', undefined, undefined, TIKTOK_SHOP_ID)).toBe(14022)
    expect(getItemHpp(ayamBesar, 'outlet', undefined, undefined, SHOPEE_ID)).toBe(14022)
    expect(getItemHpp(ayamBesar, 'outlet', undefined, undefined, 'ss_online')).toBe(14022)
  })

  it('isi paket TikTok GO memakai HPP biasa komponennya', () => {
    const duo = { id: 'duo', hpp_override: null, channel_hpp: null, is_package: true,
      package_items: [{ quantity: 2, component: ayamBesar }] }
    expect(getItemHpp(duo, 'outlet', undefined, undefined, 'tiktokgo')).toBe(36620)
  })
})

describe('getItemHpp — markup mitra', () => {
  it('paket tanpa HPP sendiri di outlet mitra dikali 1,1 SEKALI (bukan 1,21)', () => {
    const komp = { id: 'k', hpp_override: 10000, channel_hpp: null, is_package: false }
    const paket = { id: 'p', hpp_override: null, channel_hpp: null, is_package: true,
      package_items: [{ quantity: 2, component: komp }] }
    expect(getItemHpp(paket, 'mitra', undefined, undefined, 'pos')).toBe(22000)
  })

  it('menu satuan di outlet mitra dikali 1,1', () => {
    expect(getItemHpp(ayamBesar, 'mitra', undefined, undefined, 'pos')).toBe(Math.round(18310 * 1.1))
  })
})
