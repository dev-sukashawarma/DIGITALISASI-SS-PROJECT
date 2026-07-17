import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import PromoView from './PromoView'

export const dynamic = 'force-dynamic'

export default async function AdminPromoPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  let orderOnline: any = null
  try {
    orderOnline = createOrderOnlineAdminClient()
  } catch (err) {
    console.warn('Order Online client not configured, skipping sync checks.')
  }

  // Fetch data in parallel
  const [menuRes, outletsRes, ooPromosRes] = await Promise.all([
    supabase.from('menu_items').select('id, name, price').eq('is_available', true).order('sort_order'),
    supabase.from('outlets').select('id, name').eq('is_active', true),
    orderOnline ? orderOnline.from('promos').select('applies_to, item_ids').catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
  ])
  
  const initialMenuItems = menuRes.data || []
  const initialOutlets = outletsRes.data || []
  const ooPromos = ooPromosRes.data || []
  
  let initialPromos: any[] = []
  if (initialOutlets.length > 0) {
    const promoRes = await supabase.from('outlet_promos').select('*').eq('outlet_id', initialOutlets[0].id)
    initialPromos = promoRes.data?.map(p => {
      // Determine if it exists in Order Online
      let isSynced = false
      if (ooPromos && ooPromos.length > 0) {
        isSynced = ooPromos.some((oop: any) => {
          if (p.scope === 'global' && oop.applies_to === 'all') return true
          if (p.scope === 'item' && oop.applies_to === 'item' && oop.item_ids?.includes(p.menu_item_id)) return true
          return false
        })
      }

      return {
        ...p,
        discount_value: p.discount_value === 0.01 ? 0 : p.discount_value,
        sync_to_order_online: isSynced
      }
    }) || []
  }

  return (
    <PromoView 
      initialMenuItems={initialMenuItems} 
      initialOutlets={initialOutlets} 
      initialPromos={initialPromos} 
    />
  )
}
