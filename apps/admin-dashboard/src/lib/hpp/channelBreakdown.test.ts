import { describe, it, expect } from 'vitest'
import { getOrderHppChannelGroup } from '@/hooks/useHpp'

describe('getOrderHppChannelGroup — Pengelompokan Kanal HPP', () => {
  it('mengelompokkan GoFood, GrabFood, ShopeeFood ke food_apps', () => {
    expect(getOrderHppChannelGroup('gofood', 'pos')).toBe('food_apps')
    expect(getOrderHppChannelGroup('grabfood', 'pos')).toBe('food_apps')
    expect(getOrderHppChannelGroup('shopeefood', 'pos')).toBe('food_apps')
    expect(getOrderHppChannelGroup(null, 'gofood')).toBe('food_apps')
    expect(getOrderHppChannelGroup(null, 'grabfood')).toBe('food_apps')
    expect(getOrderHppChannelGroup(null, 'shopeefood')).toBe('food_apps')
    expect(getOrderHppChannelGroup('food_apps', 'pos')).toBe('food_apps')
  })

  it('mengelompokkan TikTok Go ke tiktok_go', () => {
    expect(getOrderHppChannelGroup('tiktokgo', 'pos')).toBe('tiktok_go')
    expect(getOrderHppChannelGroup('tiktok', 'pos')).toBe('tiktok_go')
    expect(getOrderHppChannelGroup(null, 'tiktokgo')).toBe('tiktok_go')
    expect(getOrderHppChannelGroup(null, 'tiktok')).toBe('tiktok_go')
  })

  it('mengelompokkan Website & Marketplace ke website', () => {
    expect(getOrderHppChannelGroup(null, 'online')).toBe('website')
    expect(getOrderHppChannelGroup('tiktok_shop', 'pos')).toBe('website')
    expect(getOrderHppChannelGroup('shopee_shop', 'pos')).toBe('website')
    expect(getOrderHppChannelGroup('ss_online', 'pos')).toBe('website')
  })

  it('mengelompokkan POS Kasir, Pawoon, dan Dine-in ke outlet', () => {
    expect(getOrderHppChannelGroup(null, 'pos', 'Customer')).toBe('outlet')
    expect(getOrderHppChannelGroup('pos_kasir', 'pos')).toBe('outlet')
    expect(getOrderHppChannelGroup(null, 'pos_kasir')).toBe('outlet')
    expect(getOrderHppChannelGroup(null, null)).toBe('outlet')
    expect(getOrderHppChannelGroup(null, 'pos', 'Pawoon Import')).toBe('outlet')
  })

  it('mengelompokkan endorse ke outlet (biaya outlet/pusat)', () => {
    expect(getOrderHppChannelGroup('endorse', 'pos', 'Influencer', true)).toBe('outlet')
    expect(getOrderHppChannelGroup(null, 'endors', 'Influencer')).toBe('outlet')
  })
})
