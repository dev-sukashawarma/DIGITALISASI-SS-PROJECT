import { describe, it, expect } from 'vitest'
import { groupChannel } from './channelGroups'

describe('groupChannel', () => {
  it('pos -> offline', () => {
    expect(groupChannel('pos')).toBe('offline')
  })
  it('online -> online', () => {
    expect(groupChannel('online')).toBe('online')
  })
  it('gofood, shopeefood, grabfood -> foodapps', () => {
    expect(groupChannel('gofood')).toBe('foodapps')
    expect(groupChannel('shopeefood')).toBe('foodapps')
    expect(groupChannel('grabfood')).toBe('foodapps')
  })
  it('tiktok -> tiktok', () => {
    expect(groupChannel('tiktok')).toBe('tiktok')
  })
  it('nilai tak dikenal -> fallback offline (konsisten dengan default POS Kasir di resolveOrderSource)', () => {
    expect(groupChannel('entah-apa')).toBe('offline')
  })
})
