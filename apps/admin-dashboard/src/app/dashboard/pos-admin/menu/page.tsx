/**
 * Dashboard POS Admin - Menu Page
 * Author: rendydev404 <rendyakun50@gmail.com>
 */
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import MenuView from './MenuView'
import type { MenuItem, Category, SalesChannel, Outlet } from '@/pos-types'

export const dynamic = 'force-dynamic'

export default async function AdminMenuPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  let itemsQuery = supabase.from('menu_items').select('*, categories(id,name,sort_order), package_items:menu_packages!package_id(id, menu_item_id, quantity, or_menu_item_id)').order('sort_order')

  let [itemsRes, categoriesRes, settingsRes, channelsRes, outletsRes] = await Promise.all([
    itemsQuery,
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('key, value').eq('outlet_id', '550e8400-e29b-41d4-a716-446655440001').in('key', ['upsell_ids', 'bestseller_ids', 'recommendation_ids']),
    supabase.from('sales_channels').select('*').eq('is_active', true).order('name'),
    supabase.from('outlets').select('*').eq('is_active', true).order('name')
  ])

  if (itemsRes.error) {
    console.error("Error fetching items with package_items:", itemsRes.error);
    let fallbackQuery = supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order');
    itemsRes = await fallbackQuery;
  }

  const initialItems: MenuItem[] = itemsRes.data || []
  const initialCategories: Category[] = categoriesRes.data || []
  const initialChannels: SalesChannel[] = channelsRes.data || []
  const initialOutlets: Outlet[] = outletsRes.data || []
  let initialPromos: any[] = []
  const activeOutletIds = initialOutlets.map(outlet => outlet.id)
  if (activeOutletIds.length > 0) {
    const promosRes = await supabase
      .from('outlet_promos')
      .select('scope, menu_item_id, outlet_id, is_active, start_date, end_date, daily_start_time, daily_end_time, daily_schedule')
      .eq('is_active', true)
      .in('outlet_id', activeOutletIds)

    if (promosRes.error) {
      console.error('Error fetching menu promo badges:', promosRes.error)
    } else {
      initialPromos = promosRes.data || []
    }
  }
  const settingsData = settingsRes.data || []
  
  const parseIds = (key: string) => {
    try {
      const val = settingsData.find(s => s.key === key)?.value
      return val ? JSON.parse(val) : []
    } catch { return [] }
  }

  const upsellIds = parseIds('upsell_ids')
  const bestsellerIds = parseIds('bestseller_ids')
  const recommendationIds = parseIds('recommendation_ids')

  return (
    <MenuView 
      initialItems={initialItems} 
      initialCategories={initialCategories} 
      initialChannels={initialChannels}
      initialOutlets={initialOutlets}
      initialPromos={initialPromos}
      initialUpsells={upsellIds}
      initialBestsellers={bestsellerIds}
      initialRecommendations={recommendationIds}
      searchQuery={q}
    />
  )
}

