import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import TargetsView from './TargetsView'

export const dynamic = 'force-dynamic'

export default async function OwnerTargetsPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Pre-fetch data for the view
  const [
    { data: targets },
    { data: globalRow },
    { data: historyData }
  ] = await Promise.all([
    supabase.rpc('get_current_targets'),
    supabase
      .from('daily_sales_targets')
      .select('target_amount')
      .is('outlet_id', null)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('owner_messages_overview').select('*').limit(50)
  ])

  const initialTargets = (targets || []) as any[]
  const initialGlobalDefault = globalRow?.target_amount ? Number(globalRow.target_amount) : 0
  const initialHistory = (historyData || []) as any[]

  return (
    <TargetsView
      initialTargets={initialTargets}
      initialGlobalDefault={initialGlobalDefault}
      initialHistory={initialHistory}
    />
  )
}
