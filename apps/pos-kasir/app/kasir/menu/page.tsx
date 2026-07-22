import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import KasirMenuClient, { type MenuQueryData } from './KasirMenuClient'
import type { MenuItem, Category } from '@/types'

export const dynamic = 'force-dynamic'

export default async function KasirMenuServerPage() {
  const supabase = await createClient()

  // 1. Dapatkan sesi pengguna saat ini
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const headersList = await headers()
    const host = headersList.get('host') || ''
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
    
    // Portal berjalan di 3010
    const portalUrl = isLocal ? 'http://localhost:3010' : (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
    redirect(portalUrl)
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
  const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

  const [{ data: m }, { data: c }, { data: settings }] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('key, value, outlet_id')
      .or(`outlet_id.is.null,outlet_id.eq.${PUSAT_OUTLET_ID},outlet_id.eq.${outletId}`)
      .in('key', ['bestseller_ids', 'upsell_ids', 'unavailable_menu_ids', 'recommendation_ids', 'auto_unavailable_menu_ids', 'force_available_menu_ids'])
  ])

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
    return best?.value
  }

  let b = getSetting('bestseller_ids', false)
  let u = getSetting('upsell_ids', false)
  let unav = getSetting('unavailable_menu_ids', false)
  let rec = getSetting('recommendation_ids', false)
  let autoUnav = getSetting('auto_unavailable_menu_ids', false)
  let forceAvail = getSetting('force_available_menu_ids', false)

  let filteredItems = (m as any) ?? [];
  if (m) {
    filteredItems = m.filter((item: any) => {
      if (item.available_outlets && Array.isArray(item.available_outlets) && item.available_outlets.length > 0) {
        return item.available_outlets.includes(outletId);
      }
      if (item.outlet_id && item.outlet_id !== outletId && item.outlet_id !== PUSAT_OUTLET_ID) {
        return false;
      }
      return true;
    });
  }

  const initialData: MenuQueryData = {
    items: filteredItems,
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


