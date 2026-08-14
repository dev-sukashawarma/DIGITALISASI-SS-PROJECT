import { describe, it, expect } from 'vitest'
import { groupChannel } from './channelGroups'

describe('groupChannel', () => {
  it('groups tiktok (TikTok Go delivery) as tiktok', () => {
    expect(groupChannel('tiktok')).toBe('tiktok')
  })

  it('groups tiktok_shop (marketplace) as online, NOT tiktok', () => {
    expect(groupChannel('tiktok_shop')).toBe('online')
  })

  it('groups shopee_shop (marketplace) as online', () => {
    expect(groupChannel('shopee_shop')).toBe('online')
  })

  it('groups pos as offline', () => {
    expect(groupChannel('pos')).toBe('offline')
  })

  it('falls back to offline for an unrecognized sales_source', () => {
    expect(groupChannel('totally_unknown_value')).toBe('offline')
  })
})
