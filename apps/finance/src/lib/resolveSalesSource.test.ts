import { describe, it, expect } from 'vitest'
import { resolveSalesSource } from './resolveSalesSource'

// Kasus diambil dari kombinasi nyata (channel, sales_source) di orders
// September 2026. Harus sama dengan fungsi DB resolve_sales_source + aturan
// endorse di view sales_daily_spv, karena omzet Rekap Bulanan dikelompokkan
// dengan fungsi itu.
describe('resolveSalesSource', () => {
  it.each([
    [null, 'pos', 'pos'],
    ['shopeefood', 'pos', 'shopeefood'],
    ['tiktokgo', 'pos', 'tiktok'],
    ['grabfood', 'pos', 'grabfood'],
    ['gofood', 'pos', 'gofood'],
    ['shopeefood', 'shopeefood', 'shopeefood'],
    [null, 'online', 'online'],
    ['website', 'pos', 'online'],
    ['tiktokgo', 'tiktok', 'tiktok'],
    ['app', 'app', 'pos'],
    ['food_apps', 'gofood', 'gofood'],
    ['f3305089-b9e4-4b92-95da-14bf6e7fb6d5', null, 'tiktok_shop'],
    ['d68eb5ec-d6bb-4d0a-8758-a2600c8f1584', null, 'shopee_shop'],
    ['0eaf2746-da9f-492c-a9b4-f091307c98c2', null, 'shopeefood'],
    [null, null, 'pos'],
  ])('channel=%s sales_source=%s → %s', (ch, src, expected) => {
    expect(resolveSalesSource(ch, src)).toBe(expected)
  })

  it('endorse menang atas kanal lain', () => {
    expect(resolveSalesSource('endorse', 'pos')).toBe('endors')
    expect(resolveSalesSource(null, 'endors')).toBe('endors')
    expect(resolveSalesSource('shopeefood', 'pos', true)).toBe('endors')
  })
})
