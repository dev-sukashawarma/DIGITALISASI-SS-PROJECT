import { describe, it, expect } from 'vitest'
import { getChannel } from './channels'

describe('getChannel — marketplace platforms', () => {
  it('resolves tiktok_shop to its own channel config', () => {
    const ch = getChannel('tiktok_shop')
    expect(ch?.id).toBe('tiktok_shop')
    expect(ch?.label).toBe('TikTok Shop')
  })

  it('resolves shopee_shop to its own channel config', () => {
    const ch = getChannel('shopee_shop')
    expect(ch?.id).toBe('shopee_shop')
    expect(ch?.label).toBe('Shopee')
  })

  it('does NOT let shopee_shop collide with the existing shopeefood alias', () => {
    const shopeeShop = getChannel('shopee_shop')
    const shopeeFoodAlias = getChannel('shopee')
    expect(shopeeShop?.id).not.toBe(shopeeFoodAlias?.id)
  })

  it('keeps the existing tiktok alias pointing at TikTok Go (unchanged)', () => {
    const ch = getChannel('tiktok')
    expect(ch?.id).toBe('tiktokgo')
    expect(ch?.label).toBe('TikTok Go')
  })

  it('keeps the existing shopee alias pointing at ShopeeFood (unchanged)', () => {
    const ch = getChannel('shopee')
    expect(ch?.id).toBe('shopeefood')
    expect(ch?.label).toBe('ShopeeFood')
  })
})
