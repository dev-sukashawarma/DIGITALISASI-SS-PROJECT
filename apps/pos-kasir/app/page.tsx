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
  const [items_result, cats_result, outlet_result, settings_result] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('outlets').select('name').eq('id', outletId).single(),
    supabase.from('kiosk_settings').select('key, value, outlet_id')
      .or(`outlet_id.is.null,outlet_id.eq.550e8400-e29b-41d4-a716-446655440001,outlet_id.eq.${outletId}`)
      .in('key', ['cover_image_url', 'bestseller_ids', 'unavailable_menu_ids', 'auto_unavailable_menu_ids', 'force_available_menu_ids'])
  ])

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  const getSetting = (key: string, preferGlobal: boolean = false) => {
    const rows = settings_result.data?.filter(s => s.key === key) || []
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

  let cover = getSetting('cover_image_url', false)
  let bs = getSetting('bestseller_ids', false)
  let unav = getSetting('unavailable_menu_ids', false)
  let autoUnav = getSetting('auto_unavailable_menu_ids', false)
  let forceAvail = getSetting('force_available_menu_ids', false)

  const unavailableIds: string[] = parseIds(unav)
  const autoUnavailableIds: string[] = parseIds(autoUnav)
  const forceAvailableIds: string[] = parseIds(forceAvail)
  
  let rawItems = (items_result.data as MenuItem[]) ?? []
  if (items_result.data) {
    rawItems = (items_result.data as any[]).filter((item: any) => {
      if (item.available_outlets && Array.isArray(item.available_outlets) && item.available_outlets.length > 0) {
        return item.available_outlets.includes(outletId);
      }
      if (item.outlet_id && item.outlet_id !== outletId && item.outlet_id !== PUSAT_OUTLET_ID) {
        return false;
      }
      return true;
    });
  }

  const menuItems = rawItems.map(item => {
    const isManualUnav = unavailableIds.includes(item.id)
    const isAutoUnav = autoUnavailableIds.includes(item.id)
    const isForceAvail = forceAvailableIds.includes(item.id)
    if (isManualUnav || (isAutoUnav && !isForceAvail)) {
      return { ...item, is_available: false }
    }
    return item
  })

  const initialData: KioskInitialData = {
    menuItems,
    categories: (cats_result.data as Category[]) ?? [],
    bestsellerIds: parseIds(bs),
    coverUrl: cover ?? null,
    outletName: outlet_result?.data?.name ?? 'Pusat',
    outletId,
  }

  return <KioskMenuClient initialData={initialData} />
}

