import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KasirMenuClient, { type MenuQueryData } from './KasirMenuClient'
import type { MenuItem, Category } from '@/types'

export const dynamic = 'force-dynamic'

export default async function KasirMenuServerPage() {
  const supabase = await createClient()

  // 1. Dapatkan sesi pengguna saat ini
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  }

  // 2. Dapatkan outlet_id
  const { data: profile } = await supabase.from('outlet_staff')
    .select('outlet_id')
    .eq('id', user.id)
    .single()

  const outletId = profile?.outlet_id

  if (!outletId) {
    const emptyData: MenuQueryData = {
      items: [], categories: [], bestsellers: [], upsells: [], recommendations: [], unavailableIds: [], autoUnavailableIds: [], forceAvailableIds: []
    }
    return <KasirMenuClient initialData={emptyData} serverOutletId="" />
  }

  // 3. Fetch data menu SSR
  const [{ data: m }, { data: c }, { data: settings }] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').or(`outlet_id.is.null,outlet_id.eq.${outletId}`).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('key, value, outlet_id')
      .or(`outlet_id.is.null,outlet_id.eq.${outletId}`)
      .in('key', ['bestseller_ids', 'upsell_ids', 'unavailable_menu_ids', 'recommendation_ids', 'auto_unavailable_menu_ids', 'force_available_menu_ids'])
  ])

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  const sortedSettings = [...(settings || [])].sort((a, b) => {
    if (a.outlet_id === null && b.outlet_id !== null) return -1
    if (a.outlet_id !== null && b.outlet_id === null) return 1
    return 0
  })

  let b, u, unav, rec, autoUnav, forceAvail
  sortedSettings.forEach(row => {
    if (row.key === 'bestseller_ids') b = row.value
    if (row.key === 'upsell_ids') u = row.value
    if (row.key === 'unavailable_menu_ids') unav = row.value
    if (row.key === 'recommendation_ids') rec = row.value
    if (row.key === 'auto_unavailable_menu_ids') autoUnav = row.value
    if (row.key === 'force_available_menu_ids') forceAvail = row.value
  })

  const initialData: MenuQueryData = {
    items: (m as any) ?? [],
    categories: (c as Category[]) ?? [],
    bestsellers: parseIds(b),
    upsells: parseIds(u),
    recommendations: parseIds(rec),
    unavailableIds: parseIds(unav),
    autoUnavailableIds: parseIds(autoUnav),
    forceAvailableIds: parseIds(forceAvail),
  }

  return <KasirMenuClient initialData={initialData} serverOutletId={outletId} />
}
