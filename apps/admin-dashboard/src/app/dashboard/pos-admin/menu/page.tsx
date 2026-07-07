import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import MenuView from './MenuView'
import type { MenuItem, Category } from '@/pos-types'

export const dynamic = 'force-dynamic'

export default async function AdminMenuPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [itemsRes, categoriesRes] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
  ])

  const initialItems: MenuItem[] = itemsRes.data || []
  const initialCategories: Category[] = categoriesRes.data || []

  return <MenuView initialItems={initialItems} initialCategories={initialCategories} />
}
