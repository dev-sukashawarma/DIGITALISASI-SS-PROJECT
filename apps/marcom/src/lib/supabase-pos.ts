import { createClient } from '@supabase/supabase-js'
import type { MenuItem, Category, SalesChannel, Outlet, MenuPromo } from '@/types/menu'

const DEFAULT_SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'

export function getPosSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!rawKey || rawKey.trim().length === 0 || rawKey === 'undefined') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set. ' +
        'Set di .env atau panel Coolify app ini.'
    )
  }
  const key = rawKey.trim()

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export type PosMenuItem = {
  id: string
  name: string
  price: number
  categoryId?: string
  categoryName?: string
  hpp?: number
  isPackage?: boolean
}

export async function fetchPosMenuItems(): Promise<PosMenuItem[]> {
  try {
    const supabase = getPosSupabase()
    const [{ data: categories }, { data: items, error }, { data: recipes }, { data: packages }] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase
        .from('menu_items')
        .select('id, name, price, category_id, is_available, hpp_override, is_package')
        .eq('is_available', true)
        .order('name', { ascending: true }),
      supabase
        .from('resep')
        .select('menu_item_ref, buffer_amount, resep_item(qty_per_porsi, bahan_baku:bahan_baku_id(bahan_baku_sku(harga_beli, qty_isi, is_default, is_active), bahan_baku_harga(harga_beli_display, kemasan_qty)))')
        .eq('scope', 'global'),
      supabase.from('menu_packages').select('package_id, menu_item_id, quantity')
    ])

    if (error || !items) {
      console.error('Error fetching POS menu items:', error)
      return []
    }

    // 1. Hitung HPP dari resep (BOM)
    const recipeHppMap: Record<string, number> = {}
    for (const r of (recipes || [])) {
      let total = 0
      for (const item of (r.resep_item || [])) {
        const rawBb = (item as any).bahan_baku
        if (!rawBb) continue
        const bb: any = Array.isArray(rawBb) ? rawBb[0] : rawBb
        if (!bb) continue
        const skus = Array.isArray(bb.bahan_baku_sku) ? bb.bahan_baku_sku.filter((s: any) => s.is_active) : []
        let harga = 0, qty = 0
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
      recipeHppMap[r.menu_item_ref] = Math.round(total + Number(r.buffer_amount || 0))
    }

    // 2. Map HPP single item (prioritas: hpp_override > recipeHppMap)
    const singleHppMap: Record<string, number> = {}
    for (const it of items) {
      if (it.hpp_override != null && Number(it.hpp_override) > 0) {
        singleHppMap[it.id] = Math.round(Number(it.hpp_override))
      } else if (recipeHppMap[it.id] != null && recipeHppMap[it.id] > 0) {
        singleHppMap[it.id] = recipeHppMap[it.id]
      }
    }

    // 3. Map HPP paket combo (jumlah dari komponen paket)
    const pkgMap: Record<string, Array<{ menu_item_id: string; quantity: number }>> = {}
    for (const p of (packages || [])) {
      if (!pkgMap[p.package_id]) pkgMap[p.package_id] = []
      pkgMap[p.package_id].push(p)
    }

    const catMap = new Map((categories || []).map((c: any) => [c.id, c.name]))

    return items.map((it: any) => {
      let hpp = singleHppMap[it.id]
      if (hpp == null && it.is_package && pkgMap[it.id]) {
        let pkgTotal = 0
        for (const comp of pkgMap[it.id]) {
          const compHpp = singleHppMap[comp.menu_item_id] || 0
          pkgTotal += compHpp * Number(comp.quantity || 1)
        }
        if (pkgTotal > 0) hpp = Math.round(pkgTotal)
      }

      const finalHpp = hpp ?? Math.round((Number(it.price) || 0) * 0.45)

      return {
        id: it.id,
        name: it.name,
        price: Number(it.price) || 0,
        categoryId: it.category_id || undefined,
        categoryName: catMap.get(it.category_id) || 'Menu Lainnya',
        hpp: finalHpp,
        isPackage: !!it.is_package,
      }
    })
  } catch (err) {
    console.error('fetchPosMenuItems failed:', err)
    return []
  }
}

export type PosOutlet = {
  id: string
  name: string
  slug?: string | null
  type: string
  region?: string | null
  address?: string | null
  phone?: string | null
  isActive: boolean
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
}

export async function fetchPosOutlets(): Promise<PosOutlet[]> {
  try {
    const supabase = getPosSupabase()
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .order('name', { ascending: true })

    if (error || !data) {
      console.error('Error fetching POS outlets:', error)
      return []
    }

    return (data as Array<Record<string, unknown>>).map((o) => ({
      id: String(o.id),
      name: String(o.name || ''),
      slug: (o.slug as string) || null,
      type: (o.type as string) || 'outlet',
      region: (o.region as string) || null,
      address: (o.address as string) || null,
      phone: (o.phone as string) || null,
      isActive: (o.is_active as boolean) ?? true,
      bankName: (o.bank_name as string) || null,
      bankAccountNumber: (o.bank_account_number as string) || null,
      bankAccountName: (o.bank_account_name as string) || null,
    }))
  } catch (err) {
    console.error('fetchPosOutlets failed:', err)
    return []
  }
}

export const DEFAULT_FOOD_CHANNELS: SalesChannel[] = [
  { id: '1284ac2a-e753-4380-9f32-59219a322459', name: 'GoFood', is_active: true },
  { id: '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a', name: 'GrabFood', is_active: true },
  { id: '0eaf2746-da9f-492c-a9b4-f091307c98c2', name: 'ShopeeFood', is_active: true },
  { id: 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8', name: 'TikTok Go', is_active: true },
]

export async function fetchFullPosMenuData() {
  const supabase = getPosSupabase()
  const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

  const [itemsRes, categoriesRes, settingsRes, channelsRes, outletsRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('*, categories(id,name,sort_order), package_items:menu_packages!package_id(id, menu_item_id, quantity, or_menu_item_id)')
      .order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase
      .from('kiosk_settings')
      .select('key, value')
      .eq('outlet_id', PUSAT_OUTLET_ID)
      .in('key', ['upsell_ids', 'bestseller_ids', 'recommendation_ids']),
    supabase.from('sales_channels').select('*').eq('is_active', true).order('name'),
    supabase.from('outlets').select('*').eq('is_active', true).order('name'),
  ])

  let items: MenuItem[] = []
  if (itemsRes.error) {
    console.warn('Fallback fetching items without packages:', itemsRes.error)
    const fallback = await supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order')
    items = (fallback.data as MenuItem[]) || []
  } else {
    items = (itemsRes.data as MenuItem[]) || []
  }

  const categories: Category[] = (categoriesRes.data as Category[]) || []
  let channels: SalesChannel[] = (channelsRes.data as SalesChannel[]) || []
  if (!channels || channels.length === 0) {
    channels = [...DEFAULT_FOOD_CHANNELS]
  } else {
    const existingSlugs = new Set(channels.map((c) => c.name.toLowerCase().replace(/[\s_]+/g, '')))
    for (const def of DEFAULT_FOOD_CHANNELS) {
      const defSlug = def.name.toLowerCase().replace(/[\s_]+/g, '')
      if (!existingSlugs.has(defSlug)) {
        channels.push(def)
      }
    }
  }
  const outlets: Outlet[] = (outletsRes.data as Outlet[]) || []

  const settingsData = settingsRes.data || []
  const parseIds = (key: string) => {
    try {
      const val = settingsData.find((s) => s.key === key)?.value
      return val ? JSON.parse(val) : []
    } catch {
      return []
    }
  }

  const upsells: string[] = parseIds('upsell_ids')
  const bestsellers: string[] = parseIds('bestseller_ids')
  const recommendations: string[] = parseIds('recommendation_ids')

  let promos: MenuPromo[] = []
  const activeOutletIds = outlets.map((o) => o.id)
  if (activeOutletIds.length > 0) {
    const promosRes = await supabase
      .from('outlet_promos')
      .select('scope, menu_item_id, outlet_id, is_active, start_date, end_date, daily_start_time, daily_end_time, daily_schedule')
      .eq('is_active', true)
      .in('outlet_id', activeOutletIds)

    if (!promosRes.error && promosRes.data) {
      promos = promosRes.data as MenuPromo[]
    }
  }

  return {
    items,
    categories,
    channels,
    outlets,
    upsells,
    bestsellers,
    recommendations,
    promos,
  }
}
