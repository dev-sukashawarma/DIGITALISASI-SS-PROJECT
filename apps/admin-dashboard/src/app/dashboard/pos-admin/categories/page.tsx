import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import CategoriesView from './CategoriesView'
import type { Category } from '@/pos-types'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  const initialCategories: Category[] = data || []

  return <CategoriesView initialCategories={initialCategories} />
}
