import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import CategoriesView, { type CategoryRow } from './CategoriesView'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Jumlah menu per kategori dihitung di database (embed count), bukan menarik
  // seluruh menu ke server/browser.
  const withCount = await supabase
    .from('categories')
    .select('id, name, sort_order, menu_items(count)')
    .order('sort_order')
    .order('name')

  let initialCategories: CategoryRow[]
  if (!withCount.error) {
    initialCategories = (withCount.data ?? []).map(c => ({
      id: c.id,
      name: c.name,
      sort_order: c.sort_order,
      menu_count: (c.menu_items as { count: number }[] | null)?.[0]?.count ?? 0,
    }))
  } else {
    // Jangan sampai daftar kategori hilang hanya karena hitungan menu gagal.
    const { data } = await supabase.from('categories').select('id, name, sort_order').order('sort_order').order('name')
    initialCategories = (data ?? []).map(c => ({ ...c, menu_count: null }))
  }

  return <CategoriesView initialCategories={initialCategories} />
}
