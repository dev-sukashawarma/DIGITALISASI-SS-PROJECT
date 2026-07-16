import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import MenuView from './MenuView'
import type { MenuItem, Category } from '@/pos-types'

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

  let itemsQuery = supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order')
  if (q) {
    itemsQuery = itemsQuery.ilike('name', `%${q}%`)
  }

  const [itemsRes, categoriesRes, settingsRes] = await Promise.all([
    itemsQuery,
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('key, value').eq('outlet_id', '550e8400-e29b-41d4-a716-446655440001').in('key', ['upsell_ids', 'bestseller_ids', 'recommendation_ids'])
  ])

  const initialItems: MenuItem[] = itemsRes.data || []
  const initialCategories: Category[] = categoriesRes.data || []
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
      initialUpsells={upsellIds}
      initialBestsellers={bestsellerIds}
      initialRecommendations={recommendationIds}
    />
  )
}

