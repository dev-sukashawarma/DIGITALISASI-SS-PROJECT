import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import ReportsView from './ReportsView'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Pre-fetch outlets to avoid loading state for filters
  const { data: outletsData } = await supabase.from('outlets').select('*').order('name')
  
  const initialOutlets = outletsData || []

  return (
    <ReportsView initialOutlets={initialOutlets as any} />
  )
}
