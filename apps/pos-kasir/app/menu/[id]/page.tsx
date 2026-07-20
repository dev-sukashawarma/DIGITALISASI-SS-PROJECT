import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductDetailClient from './ProductDetailClient'
import type { MenuItem } from '@/types'

export const dynamic = 'force-dynamic'

const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('outlet_staff').select('outlet_id').eq('id', user.id).single()
    : { data: null }
  const outletId = profile?.outlet_id || PUSAT_OUTLET_ID

  const [{ data: mainItem }, { data: settings }] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order), package_items:menu_packages!package_id(id, menu_item_id, or_menu_item_id, quantity)').eq('id', id).single(),
    supabase.from('kiosk_settings').select('key, value, outlet_id').or(`outlet_id.is.null,outlet_id.eq.550e8400-e29b-41d4-a716-446655440001,outlet_id.eq.${outletId}`).in('key', ['upsell_ids', 'unavailable_menu_ids']),
  ])

  if (!mainItem) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <p className="text-gray-500 font-medium">Produk tidak ditemukan</p>
        <Link href="/" className="btn-primary">Kembali ke Menu</Link>
      </div>
    )
  }

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  const getSetting = (key: string, preferGlobal: boolean = false) => {
    const rows = settings?.filter(s => s.key === key) || []
    const sortedRows = [...rows].sort((a, b) => {
      const getWeight = (id: string | null) => {
        if (preferGlobal) {
          if (id === null) return 3
          if (id === PUSAT_OUTLET_ID) return 2
          if (id === outletId) return 1
          return 0
        } else {
          if (id === outletId) return 3
          if (id === PUSAT_OUTLET_ID) return 2
          if (id === null) return 1
          return 0
        }
      }
      return getWeight(a.outlet_id) - getWeight(b.outlet_id)
    })
    const best = sortedRows.pop()
    return parseIds(best?.value)
  }

  let unavIds = getSetting('unavailable_menu_ids', false)
  let upIds = getSetting('upsell_ids', false)

  // Apply availability override
  const isGlobal = mainItem.outlet_id === null
  if (isGlobal && unavIds.includes(mainItem.id)) {
    mainItem.is_available = false
  }

  let upsellItems: MenuItem[] = []
  if (upIds.length > 0) {
    const { data: uItems } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', upIds)
      .eq('is_available', true)

    upsellItems = (uItems ?? []).filter(u => {
      if (u.id === id) return false
      if (u.outlet_id === null && unavIds.includes(u.id)) return false
      return true
    })
  }

  let packageOptionItems: MenuItem[] = []
  if (mainItem.is_package && mainItem.package_items) {
    const packageItemIds = new Set<string>()
    mainItem.package_items.forEach((pi: any) => {
      if (pi.menu_item_id) packageItemIds.add(pi.menu_item_id)
      if (pi.or_menu_item_id) packageItemIds.add(pi.or_menu_item_id)
    })
    
    if (packageItemIds.size > 0) {
      const { data: pItems } = await supabase
        .from('menu_items')
        .select('*')
        .in('id', Array.from(packageItemIds))
      packageOptionItems = pItems || []
    }
  }

  return (
    <ProductDetailClient
      item={mainItem as MenuItem}
      upsellItems={upsellItems}
      packageOptionItems={packageOptionItems}
      outletId={outletId}
    />
  )
}

