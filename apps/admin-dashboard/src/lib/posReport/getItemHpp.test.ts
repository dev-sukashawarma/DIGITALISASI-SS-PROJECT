import { describe, it, expect } from 'vitest'
import { getItemHpp, buildMenuMaps, buildPenerapHpp, MITRA_CILEUNGSI_OUTLET_ID } from './compute'
import { adalahKanalSsOnline } from '@/lib/hpp/kanalSsOnline'
import { MENU_SELECT } from './laporan'

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

describe('getItemHpp — markup mitra & takeout OPEX mulai Okt 2026', () => {
  it('sebelum 1 Okt 2026: paket tanpa HPP sendiri di outlet mitra dikali 1,1 SEKALI (bukan 1,21)', () => {
    const komp = { id: 'k', hpp_override: 10000, channel_hpp: null, is_package: false }
    const paket = { id: 'p', hpp_override: null, channel_hpp: null, is_package: true,
      package_items: [{ quantity: 2, component: komp }] }
    expect(getItemHpp(paket, 'mitra', undefined, undefined, 'pos', undefined, undefined, 'mitra-lain', '2026-09-20')).toBe(22000)
  })

  it('sebelum 1 Okt 2026: menu satuan di outlet mitra dikali 1,1', () => {
    expect(getItemHpp(ayamBesar, 'mitra', undefined, undefined, 'pos', undefined, undefined, 'mitra-lain', '2026-09-20')).toBe(Math.round(18310 * 1.1))
  })

  it('Okt 2026 takeout OPEX vs Cileungsi x1,1, lalu Nov 2026 seragam x1,15 tanpa bentrok cache', () => {
    // Panggil pada objek referensi yang sama untuk menguji isolasi memoKey
    expect(getItemHpp(ayamBesar, 'mitra', undefined, undefined, 'pos', undefined, undefined, 'mitra-jatiasih', '2026-10-15')).toBe(18310)
    expect(getItemHpp(ayamBesar, 'mitra', undefined, undefined, 'pos', undefined, undefined, MITRA_CILEUNGSI_OUTLET_ID, '2026-10-15')).toBe(Math.round(18310 * 1.1))
    // Mulai 1 Nov 2026: kedua outlet mitra dapat angka yang SAMA (x1,15).
    expect(getItemHpp(ayamBesar, 'mitra', undefined, undefined, 'pos', undefined, undefined, 'mitra-jatiasih', '2026-11-01')).toBe(Math.round(18310 * 1.15))
    expect(getItemHpp(ayamBesar, 'mitra', undefined, undefined, 'pos', undefined, undefined, MITRA_CILEUNGSI_OUTLET_ID, '2026-11-02')).toBe(Math.round(18310 * 1.15))
    // 31 Okt harus tetap memakai aturan lama (batas bawah cabang November).
    expect(getItemHpp(ayamBesar, 'mitra', undefined, undefined, 'pos', undefined, undefined, 'mitra-jatiasih', '2026-10-31')).toBe(18310)
  })

  it('transisi minuman murni Aqua dalam paket sebelum vs mulai 2 Nov 2026', () => {
    const ayamSedang = { id: 'ayam-sdg', hpp_override: 13275, channel_hpp: null, is_package: false }
    const aquaOct = { id: 'c8427af3-0a41-48dd-9a08-6b93cd913ec6', hpp_override: 1700, channel_hpp: null, is_package: false }
    const paketOct = {
      id: 'pkg-ayam-aqua',
      hpp_override: null,
      channel_hpp: null,
      is_package: true,
      package_items: [
        { quantity: 1, component: ayamSedang },
        { quantity: 1, component: aquaOct },
      ],
    }
    expect(getItemHpp(paketOct, 'mitra', undefined, undefined, 'pos', undefined, undefined, 'mitra-lain', '2026-10-20')).toBe(Math.round(13275 + 1700 * 1.1))

    const aquaNov = { ...aquaOct, hpp_override: 1870 }
    const paketNov = {
      ...paketOct,
      package_items: [
        { quantity: 1, component: { ...ayamSedang, hpp_override: 13961 } },
        { quantity: 1, component: aquaNov },
      ],
    }
    // Mulai 1 Nov 2026: aturan takeout OPEX tidak lagi dipakai; paket dikali
    // 1,15 SEKALI di tingkat paket (bukan per komponen lalu dijumlah).
    expect(getItemHpp(paketNov, 'mitra', undefined, undefined, 'pos', undefined, undefined, 'mitra-lain', '2026-11-02')).toBe(Math.round((13961 + 1870) * 1.15))
    expect(getItemHpp(paketNov, 'mitra', undefined, undefined, 'pos', undefined, undefined, MITRA_CILEUNGSI_OUTLET_ID, '2026-11-02')).toBe(Math.round((13961 + 1870) * 1.15))
  })
})

describe('buildMenuMaps & MENU_SELECT — proteksi duplikat yatim menu_items', () => {
  it('MENU_SELECT memuat is_available, outlet_id, categories(name)', () => {
    expect(MENU_SELECT).toContain('is_available')
    expect(MENU_SELECT).toContain('outlet_id')
    expect(MENU_SELECT).toMatch(/categories\s*\(\s*name\s*\)/)
  })

  it('buildMenuMaps & buildPenerapHpp tidak menimpa menu aktif dengan yatim nonaktif yang muncul belakangan', () => {
    const activeItem = {
      id: 'act-1',
      name: 'Original Ayam Besar',
      hpp_override: 18310,
      channel_hpp: { ss_online: 14022 },
      is_package: false,
      is_available: true,
      outlet_id: null,
      categories: { name: 'Shawarma' },
    }
    const orphanAfter = {
      id: 'orp-2',
      name: 'Original Ayam Besar',
      hpp_override: 11000,
      channel_hpp: {},
      is_package: false,
      is_available: false,
      outlet_id: null,
      categories: null,
    }

    const { menuItemByNameMap } = buildMenuMaps([activeItem, orphanAfter])
    expect(menuItemByNameMap.get('Original Ayam Besar')?.id).toBe('act-1')
    expect(menuItemByNameMap.get('original ayam besar')?.id).toBe('act-1')
    expect(getItemHpp(null, 'outlet', 'Original Ayam Besar', menuItemByNameMap, 'pos')).toBe(18310)

    const pHpp = buildPenerapHpp([activeItem, orphanAfter], []).untuk('2026-10-31')
    expect(pHpp.byName.get('Original Ayam Besar')?.id).toBe('act-1')
    expect(pHpp.byName.get('original ayam besar')?.id).toBe('act-1')
  })
})
