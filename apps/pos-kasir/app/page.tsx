import { createClient } from '@/lib/supabase/server'
import KioskMenuClient, { type KioskInitialData } from './KioskMenuClient'
import type { MenuItem, Category } from '@/types'

export const dynamic = 'force-dynamic' // Ensure fresh menu/session per request

const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default async function KioskHomePage() {
  const supabase = await createClient()

  // 1. Sesi & outlet (redirect ke portal ditangani middleware; di sini fallback aman saja)
  const { data: { user } } = await supabase.auth.getUser()

  let outletId = PUSAT_OUTLET_ID

  if (user) {
    const { data: profile } = await supabase.from('outlet_staff').select('outlet_id, role').eq('id', user.id).single()
    outletId = profile?.outlet_id || PUSAT_OUTLET_ID
  }

  // 2. Fetch data menu SSR — paralel, satu round-trip dari server ke Supabase
  const [items_result, cats_result, cover_result, bs_result, outlet_result, unav_result, auto_unav_result, force_avail_result] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').or(`outlet_id.is.null,outlet_id.eq.${outletId}`).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'cover_image_url').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'bestseller_ids').maybeSingle(),
    supabase.from('outlets').select('name').eq('id', outletId).single(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'auto_unavailable_menu_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'force_available_menu_ids').maybeSingle(),
  ])

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  const unavailableIds: string[] = parseIds(unav_result?.data?.value)
  const autoUnavailableIds: string[] = parseIds(auto_unav_result?.data?.value)
  const forceAvailableIds: string[] = parseIds(force_avail_result?.data?.value)
  
  const rawItems = (items_result.data as MenuItem[]) ?? []
  const menuItems = rawItems.map(item => {
    const isGlobal = item.outlet_id === null
    if (isGlobal) {
      const isManualUnav = unavailableIds.includes(item.id)
      const isAutoUnav = autoUnavailableIds.includes(item.id)
      const isForceAvail = forceAvailableIds.includes(item.id)
      if (isManualUnav || (isAutoUnav && !isForceAvail)) {
        return { ...item, is_available: false }
      }
    }
    return item
  })

  const initialData: KioskInitialData = {
    menuItems,
    categories: (cats_result.data as Category[]) ?? [],
    bestsellerIds: parseIds(bs_result?.data?.value),
    coverUrl: cover_result?.data?.value ?? null,
    outletName: outlet_result?.data?.name ?? 'Pusat',
    outletId,
  }

  return <KioskMenuClient initialData={initialData} />
}
