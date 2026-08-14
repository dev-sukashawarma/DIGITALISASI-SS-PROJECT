import { describe, it, expect } from 'vitest'
import { isMarketplaceOutlet, splitOutletsByType } from './marketplaceOutlets'

describe('isMarketplaceOutlet', () => {
  it('returns true when type is marketplace', () => {
    expect(isMarketplaceOutlet({ type: 'marketplace' })).toBe(true)
  })

  it('returns false for a physical outlet type', () => {
    expect(isMarketplaceOutlet({ type: 'outlet' })).toBe(false)
  })

  it('returns false when type is undefined', () => {
    expect(isMarketplaceOutlet({ type: undefined })).toBe(false)
  })
})

describe('splitOutletsByType', () => {
  const outlets = [
    { id: '1', name: 'Cibubur', type: 'outlet' },
    { id: '2', name: 'TikTok Shop', type: 'marketplace' },
    { id: '3', name: 'Empang', type: undefined },
    { id: '4', name: 'Shopee', type: 'marketplace' },
  ]

  it('separates physical outlets from marketplace outlets, preserving order', () => {
    const { physical, marketplace } = splitOutletsByType(outlets)
    expect(physical.map(o => o.id)).toEqual(['1', '3'])
    expect(marketplace.map(o => o.id)).toEqual(['2', '4'])
  })

  it('returns an empty marketplace array when none are present', () => {
    const { physical, marketplace } = splitOutletsByType([outlets[0]])
    expect(physical).toHaveLength(1)
    expect(marketplace).toHaveLength(0)
  })

  it('returns an empty physical array when all are marketplace', () => {
    const { physical, marketplace } = splitOutletsByType([outlets[1], outlets[3]])
    expect(physical).toHaveLength(0)
    expect(marketplace).toHaveLength(2)
  })
})
