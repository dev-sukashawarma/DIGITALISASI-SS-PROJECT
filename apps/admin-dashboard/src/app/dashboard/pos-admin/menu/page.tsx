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

  const [itemsRes, categoriesRes] = await Promise.all([
    itemsQuery,
    supabase.from('categories').select('*').order('sort_order'),
  ])

  const initialItems: MenuItem[] = itemsRes.data || []
  const initialCategories: Category[] = categoriesRes.data || []

  return <MenuView initialItems={initialItems} initialCategories={initialCategories} />
}
