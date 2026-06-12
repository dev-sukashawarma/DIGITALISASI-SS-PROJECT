import type { MenuItem } from '@/types'

/** Each order is the list of menu_item_ids it contained. */
export type OrderItemIds = string[]

export interface RankInput {
  /** Products that drive the recommendation (the detail product, or the cart items). */
  seedIds: string[]
  /** Products already in the cart — never recommended back. */
  cartIds: string[]
  /** All menu items (used for availability, category, sort order, and hydration). */
  menuItems: MenuItem[]
  /** Past orders, each as a list of menu_item_ids. */
  orders: OrderItemIds[]
  /** Max results. */
  limit: number
  /** Category of the single seed product (detail mode) — excluded from fallback. Optional. */
  seedCategoryId?: string | null
}

/**
 * Rank "frequently bought together" recommendations.
 *
 * 1. Tally how often each other product appears in orders that contain a seed product.
 * 2. Rank available, non-excluded items by that tally (desc), tie-break by sort_order.
 * 3. If fewer than `limit`, fall back to best-selling items from OTHER categories
 *    (overall order frequency desc, tie-break by sort_order), excluding the seed's category.
 *    When there are no orders at all, "best-selling" is empty so items are ordered by sort_order.
 */
export function rankRecommendations(input: RankInput): MenuItem[] {
  const { seedIds, cartIds, menuItems, orders, limit, seedCategoryId } = input

  const excluded = new Set<string>([...seedIds, ...cartIds])
  const byId = new Map(menuItems.map((m) => [m.id, m]))
  const isTopping = (id: string) => {
    // @ts-ignore - categories might be nested depending on the query
    const catName = byId.get(id)?.categories?.name?.toLowerCase() || '';
    return catName.includes('toping') || catName.includes('topping');
  }

  const isPickable = (id: string) => {
    const m = byId.get(id)
    return !!m && m.is_available && !excluded.has(id) && !isTopping(id)
  }

  // 1. Co-purchase tally: orders containing any seed product.
  const seedSet = new Set(seedIds)
  const coTally = new Map<string, number>()
  // Overall popularity tally (for fallback ranking).
  const popTally = new Map<string, number>()

  for (const order of orders) {
    const containsSeed = order.some((id) => seedSet.has(id))
    for (const id of order) {
      popTally.set(id, (popTally.get(id) ?? 0) + 1)
      if (containsSeed && !seedSet.has(id)) {
        coTally.set(id, (coTally.get(id) ?? 0) + 1)
      }
    }
  }

  const sortOrder = (id: string) => byId.get(id)?.sort_order ?? 0

  // 2. Co-purchase recommendations.
  const coRanked = [...coTally.entries()]
    .filter(([id]) => isPickable(id))
    .sort((a, b) => {
      // 1. Tally
      if (b[1] !== a[1]) return b[1] - a[1];
      
      // 2. Sort Order
      return sortOrder(a[0]) - sortOrder(b[0]);
    })
    .map(([id]) => id)

  const result: string[] = []
  const seen = new Set<string>()
  for (const id of coRanked) {
    if (result.length >= limit) break
    if (!seen.has(id)) { result.push(id); seen.add(id) }
  }

  // 3. Fallback: other-category best-sellers.
  if (result.length < limit) {
    const fallback = menuItems
      .filter((m) => isPickable(m.id) && !seen.has(m.id))
      .filter((m) => m.category_id !== (seedCategoryId ?? null))
      .sort((a, b) => {
        // 1. Tally
        const diff = (popTally.get(b.id) ?? 0) - (popTally.get(a.id) ?? 0);
        if (diff !== 0) return diff;
        
        // 2. Sort Order
        return a.sort_order - b.sort_order;
      })
      .map((m) => m.id)

    for (const id of fallback) {
      if (result.length >= limit) break
      if (!seen.has(id)) { result.push(id); seen.add(id) }
    }
  }

  return result.map((id) => byId.get(id)!).slice(0, limit)
}
