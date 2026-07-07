import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import PromoView from './PromoView'

export const dynamic = 'force-dynamic'

export default async function AdminPromoPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Fetch data in parallel
  const [menuRes, outletsRes] = await Promise.all([
    supabase.from('menu_items').select('id, name, price').eq('is_available', true).order('sort_order'),
    supabase.from('outlets').select('id, name').eq('is_active', true)
  ])
  
  const initialMenuItems = menuRes.data || []
  const initialOutlets = outletsRes.data || []
  
  let initialPromos: any[] = []
  if (initialOutlets.length > 0) {
    const promoRes = await supabase.from('outlet_promos').select('*').eq('outlet_id', initialOutlets[0].id)
    initialPromos = promoRes.data || []
  }

  return (
    <PromoView 
      initialMenuItems={initialMenuItems} 
      initialOutlets={initialOutlets} 
      initialPromos={initialPromos} 
    />
  )
}
