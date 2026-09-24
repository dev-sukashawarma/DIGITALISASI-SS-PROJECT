import { getPosSupabase } from '@/lib/supabase-pos'
import type { Category, MenuItem } from '@/types/menu'
import CategoryPageClient from './CategoryPageClient'

export const dynamic = 'force-dynamic'

export default async function MarcomCategoryPage() {
  const supabase = getPosSupabase()

  const [categoriesRes, itemsRes] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('id, name, category_id').order('sort_order'),
  ])

  const initialCategories: Category[] = (categoriesRes.data as Category[]) || []
  const initialItems: MenuItem[] = (itemsRes.data as MenuItem[]) || []

  return (
    <CategoryPageClient
      initialCategories={initialCategories}
      initialItems={initialItems}
    />
  )
}
