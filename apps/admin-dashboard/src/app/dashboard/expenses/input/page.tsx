import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import ExpenseInputView from './ExpenseInputView'
import type { Outlet } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ExpenseInputPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data: outlets } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active')
    .order('name')

  return (
    <ExpenseInputView initialOutlets={(outlets as Outlet[]) ?? []} />
  )
}
