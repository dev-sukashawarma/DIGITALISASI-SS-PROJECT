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
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').eq('id', id).single(),
    supabase.from('kiosk_settings').select('key, value, outlet_id').or(`outlet_id.is.null,outlet_id.eq.${outletId}`).in('key', ['upsell_ids', 'unavailable_menu_ids']),
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

  let unavIds: string[] = []
  let upIds: string[] = []
  
  const sortedSettings = [...(settings || [])].sort((a, b) => {
    if (a.outlet_id === null && b.outlet_id !== null) return -1
    if (a.outlet_id !== null && b.outlet_id === null) return 1
    return 0
  })

  sortedSettings.forEach(s => {
    if (s.key === 'unavailable_menu_ids') unavIds = parseIds(s.value)
    if (s.key === 'upsell_ids') upIds = parseIds(s.value)
  })

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

  return (
    <ProductDetailClient
      item={mainItem as MenuItem}
      upsellItems={upsellItems}
      outletId={outletId}
    />
  )
}
