import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rankRecommendations, type OrderItemIds } from '@/lib/recommendations'
import type { MenuItem } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')?.trim() || null
  const cartParam = searchParams.get('cart')?.trim() || ''
  const cartIds = cartParam ? cartParam.split(',').map((s) => s.trim()).filter(Boolean) : []
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 4, 1), 8)

  // Seed = the detail product, or the cart items.
  const seedIds = productId ? [productId] : cartIds
  if (seedIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const supabase = createServiceClient()

  // All menu items (for availability, category, sort order, hydration).
  const { data: menuRows, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, category_id, name, description, price, image_url, is_available, sort_order, outlet_id, categories(*)')
    .order('sort_order')

  if (menuErr || !menuRows) {
    return NextResponse.json({ items: [] })
  }
  const menuItems = menuRows as any as MenuItem[]

  // Orders that contain any seed product.
  const { data: seedOrderRows } = await supabase
    .from('order_items')
    .select('order_id')
    .in('menu_item_id', seedIds)

  const orderIds = Array.from(new Set((seedOrderRows ?? []).map((r) => r.order_id).filter(Boolean)))

  // Build the per-order item-id lists for those orders.
  let orders: OrderItemIds[] = []
  if (orderIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('order_items')
      .select('order_id, menu_item_id')
      .in('order_id', orderIds)

    const grouped = new Map<string, string[]>()
    for (const row of itemRows ?? []) {
      if (!row.order_id || !row.menu_item_id) continue
      const list = grouped.get(row.order_id) ?? []
      list.push(row.menu_item_id)
      grouped.set(row.order_id, list)
    }
    orders = [...grouped.values()]
  }

  const seedCategoryId = productId
    ? (menuItems.find((m) => m.id === productId)?.category_id ?? null)
    : null

  const items = rankRecommendations({
    seedIds,
    cartIds,
    menuItems,
    orders,
    limit,
    seedCategoryId,
  })

  return NextResponse.json({ items })
}
