import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import OutletsView from './OutletsView'
import type { Outlet } from '@/pos-types'

export const dynamic = 'force-dynamic'

export default async function AdminOutletsPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data } = await supabase
    .from('outlets')
    .select('*')
    .order('created_at', { ascending: true })

  const initialOutlets: Outlet[] = data || []

  return <OutletsView initialOutlets={initialOutlets} />
}
