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
  const [{ data: m }, { data: c }, { data: b }, { data: u }, { data: unav }, { data: rec }, { data: autoUnav }, { data: forceAvail }] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').or(`outlet_id.is.null,outlet_id.eq.${outletId}`).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'bestseller_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'upsell_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'recommendation_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'auto_unavailable_menu_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'force_available_menu_ids').maybeSingle(),
  ])

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  const initialData: MenuQueryData = {
    items: (m as any) ?? [],
    categories: (c as Category[]) ?? [],
    bestsellers: parseIds(b?.value),
    upsells: parseIds(u?.value),
    recommendations: parseIds(rec?.value),
    unavailableIds: parseIds(unav?.value),
    autoUnavailableIds: parseIds(autoUnav?.value),
    forceAvailableIds: parseIds(forceAvail?.value),
  }

  return <KasirMenuClient initialData={initialData} serverOutletId={outletId} />
}
