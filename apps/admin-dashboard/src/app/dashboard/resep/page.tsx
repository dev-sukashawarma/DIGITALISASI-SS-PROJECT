import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import ResepTabView from './ResepTabView'
import { getMenuCategoryGroup, getSizeRank } from './categoryHelper'

export const dynamic = 'force-dynamic'

export default async function ResepPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Fetch all menu items with categories, channel prices, channel hpp, and package info
  const [menuRes, recipesRes, channelsRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id, name, price, hpp_override, channel_prices, channel_hpp, is_available, is_available_online, available_online_channels, is_package, sort_order, categories(name, sort_order), package_items:menu_packages!package_id(id, menu_item_id, quantity)')
      .order('sort_order'),
    supabase
      .from('resep')
      .select('menu_item_ref, is_active, buffer_amount, resep_item(id, bahan_baku_id, qty_per_porsi, bahan_baku:bahan_baku_id(id, bahan_baku_sku(harga_beli, qty_isi, is_default, is_active), bahan_baku_harga(harga_beli_display, kemasan_qty)))')
      .eq('scope', 'global'),
    supabase
      .from('sales_channels')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  const menuItems = menuRes.data || []
  const recipes = recipesRes.data || []
  const channels = channelsRes.data || []

  // Build HPP per menu_item from resep_item
  function calcHppFromRecipe(recipe: any): number {
    const items = recipe?.resep_item || []
    let total = 0
    for (const item of items) {
      const bb = item.bahan_baku as any
      if (!bb) continue
      // Find best price from SKU
      const skus: any[] = Array.isArray(bb.bahan_baku_sku) ? bb.bahan_baku_sku.filter((s: any) => s.is_active) : []
      let harga = 0
      let qty = 0
      if (skus.length > 0) {
        const def = skus.find((s: any) => s.is_default) || skus[0]
        harga = Number(def.harga_beli) || 0
        qty = Number(def.qty_isi) || 0
      } else {
        const h = Array.isArray(bb.bahan_baku_harga) ? bb.bahan_baku_harga[0] : bb.bahan_baku_harga
        harga = Number(h?.harga_beli_display) || 0
        qty = Number(h?.kemasan_qty) || 0
      }
      if (harga > 0 && qty > 0) {
        total += (harga / qty) * Number(item.qty_per_porsi || 0)
      }
    }
    const safeBuffer = Math.max(0, Number(recipe.buffer_amount) || 0)
    return Math.round(total + safeBuffer)
  }

  // Map recipe HPP by menu_item_ref
  const recipeHppMap: Record<string, number> = {}
  for (const r of recipes) {
    recipeHppMap[r.menu_item_ref] = calcHppFromRecipe(r)
  }
  const recipeSet = new Set(recipes.map((r: any) => r.menu_item_ref))

  // Build HPP table items
  const hppItems = menuItems.map((menu: any) => {
    const categoryInfo = menu.categories || {}
    const isPackage = !!menu.is_package
    let hpp: number | null = null
    let isPartial = false

    if (isPackage) {
      // Combo: sum HPP of each component × qty
      const components: any[] = menu.package_items || []
      let total = 0
      let allResolved = true
      for (const comp of components) {
        // Resolve component HPP (prioritize its hpp_override, then recipe HPP)
        const compMenu = menuItems.find((m: any) => m.id === comp.menu_item_id)
        const compHpp = compMenu?.hpp_override !== null && compMenu?.hpp_override !== undefined
          ? Number(compMenu.hpp_override)
          : recipeHppMap[comp.menu_item_id]

        if (compHpp !== undefined && compHpp !== null) {
          total += compHpp * Number(comp.quantity || 1)
        } else {
          allResolved = false
        }
      }
      if (components.length === 0) {
        hpp = null
      } else if (!allResolved) {
        hpp = total > 0 ? Math.round(total) : null
        isPartial = true
      } else {
        hpp = Math.round(total)
      }
    } else {
      // Single item HPP from recipe
      hpp = recipeSet.has(menu.id) ? (recipeHppMap[menu.id] ?? null) : null
    }

    const group = getMenuCategoryGroup({
      name: menu.name,
      category: categoryInfo.name,
      isPackage,
      availableOnlineChannels: menu.available_online_channels,
      channelPrices: menu.channel_prices,
    })

    return {
      id: menu.id,
      name: menu.name,
      category: group.shortName,
      categoryFullName: group.name,
      categoryId: group.id,
      categoryOrder: group.order,
      categoryIcon: group.icon,
      categoryBadgeBg: group.badgeBg,
      categoryBorderAccent: group.borderAccent,
      sortOrder: menu.sort_order || 0,
      price: Number(menu.price) || 0,
      hppOverride: menu.hpp_override !== null && menu.hpp_override !== undefined ? Number(menu.hpp_override) : null,
      channelPrices: (menu.channel_prices as Record<string, number>) || {},
      channelHpp: (menu.channel_hpp as Record<string, number>) || {},
      isAvailable: menu.is_available !== false,
      isAvailableOnline: !!menu.is_available_online,
      availableOnlineChannels: (menu.available_online_channels as string[] | null) ?? null,
      isPackage,
      hpp,
      isPartial,
    }
  })

  // BOM list data (existing tab)
  const menuWithBOM = menuItems.map((menu: any) => {
    const isPackage = !!menu.is_package
    const categoryInfo = menu.categories || {}
    let hasBOM = false
    let bomActive = false
    let itemCount = 0

    if (isPackage) {
      const components: any[] = menu.package_items || []
      // Combo has BOM if all its components have BOMs
      hasBOM = components.length > 0 && components.every((comp: any) => recipeSet.has(comp.menu_item_id))
      bomActive = hasBOM
      
      let count = 0
      for (const comp of components) {
         const bom = recipes?.find((r: any) => r.menu_item_ref === comp.menu_item_id)
         count += bom?.resep_item?.length || 0
      }
      itemCount = count
    } else {
      const bom = recipes?.find((r: any) => r.menu_item_ref === menu.id)
      hasBOM = !!bom
      bomActive = bom?.is_active
      itemCount = bom?.resep_item?.length || 0
    }

    const group = getMenuCategoryGroup({
      name: menu.name,
      category: categoryInfo.name,
      isPackage,
      availableOnlineChannels: menu.available_online_channels,
      channelPrices: menu.channel_prices,
    })

    return {
      ...menu,
      category: group.shortName,
      categoryFullName: group.name,
      categoryId: group.id,
      categoryOrder: group.order,
      categoryIcon: group.icon,
      categoryBadgeBg: group.badgeBg,
      categoryBorderAccent: group.borderAccent,
      hasBOM,
      bomActive,
      itemCount,
      isPackage,
    }
  }).sort((a: any, b: any) => {
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder
    const sizeRankA = getSizeRank(a.name)
    const sizeRankB = getSizeRank(b.name)
    if (sizeRankA !== sizeRankB) return sizeRankA - sizeRankB
    if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0)
    return a.name.localeCompare(b.name)
  })

  return (
    <ResepTabView
      menuWithBOM={menuWithBOM}
      hppItems={hppItems}
      channels={channels}
    />
  )
}
