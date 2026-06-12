import { describe, it, expect } from 'vitest'
import { rankRecommendations } from '@/lib/recommendations'
import type { MenuItem } from '@/types'
import type { RankInput } from '@/lib/recommendations'

function menu(id: string, category_id: string | null, sort_order = 0, is_available = true): MenuItem {
  return { id, outlet_id: null, category_id, name: id, description: null, price: 1000, image_url: null, is_available, sort_order }
}

// Menu: m1,m2 in catA ; topKentang,topKeju in catTop ; m3 in catB
const MENU: MenuItem[] = [
  menu('m1', 'catA', 1),
  menu('m2', 'catA', 2),
  menu('m3', 'catB', 3),
  menu('kentang', 'catTop', 4),
  menu('keju', 'catTop', 5),
]

describe('rankRecommendations', () => {
  it('ranks by co-purchase frequency, excluding the seed', () => {
    // Orders: m1 bought with kentang 2x, with keju 1x
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: [],
      menuItems: MENU,
      orders: [
        ['m1', 'kentang'],
        ['m1', 'kentang'],
        ['m1', 'keju'],
      ],
      limit: 4,
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result[0]).toBe('kentang') // most co-purchased first
    expect(result).toContain('keju')
    expect(result).not.toContain('m1') // seed excluded
  })

  it('excludes items already in the cart', () => {
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: ['m1', 'kentang'],
      menuItems: MENU,
      orders: [['m1', 'kentang'], ['m1', 'keju']],
      limit: 4,
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result).not.toContain('kentang') // in cart
    expect(result).toContain('keju')
  })

  it('never recommends unavailable items', () => {
    const menuWithHabis = MENU.map((m) => (m.id === 'kentang' ? { ...m, is_available: false } : m))
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: [],
      menuItems: menuWithHabis,
      orders: [['m1', 'kentang'], ['m1', 'kentang'], ['m1', 'keju']],
      limit: 4,
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result).not.toContain('kentang')
  })

  it('cold-start (no orders) falls back to other-category items by sort_order', () => {
    const input: RankInput = {
      seedIds: ['m1'], // catA
      cartIds: [],
      menuItems: MENU,
      orders: [],
      limit: 4,
      seedCategoryId: 'catA',
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result).not.toContain('m1') // seed excluded
    expect(result).not.toContain('m2') // same category as seed excluded from fallback
    // other-category items, sort_order order: m3(3), kentang(4), keju(5)
    expect(result).toEqual(['m3', 'kentang', 'keju'])
  })

  it('fills remaining slots with fallback when co-purchase data is thin', () => {
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: [],
      menuItems: MENU,
      orders: [['m1', 'keju']], // only 1 co-purchase
      limit: 4,
      seedCategoryId: 'catA',
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result[0]).toBe('keju') // co-purchase ranked first
    // remaining filled from other categories, not duplicating keju or seed-category m2
    expect(result).toContain('m3')
    expect(result).toContain('kentang')
    expect(result).not.toContain('m1')
    expect(result).not.toContain('m2')
  })

  it('respects the limit', () => {
    const input: RankInput = {
      seedIds: ['m1'], cartIds: [], menuItems: MENU, orders: [], limit: 2,
    }
    expect(rankRecommendations(input)).toHaveLength(2)
  })
})
