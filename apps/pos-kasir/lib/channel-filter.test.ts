import { describe, it, expect } from 'vitest'
import { matchesChannelFilter } from './channel-filter'

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
