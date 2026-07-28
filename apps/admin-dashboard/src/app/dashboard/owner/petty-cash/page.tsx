import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange } from '@/lib/period'
import { getPettyCashData } from '@/app/actions/ownerDashboard'
import PettyCashPageClient from './PettyCashPageClient'
import type { SalesSource, PeriodFilterValue } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function PettyCashOwnerPage({ searchParams }: { searchParams: Promise<any> }) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  const sp = await searchParams

  const { data: user } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role, outlet_id').eq('id', user.user?.id).single()
  const isReadOnly = profile?.role === 'MITRA'
  const lockedOutletId = isReadOnly ? profile?.outlet_id : null

  const defaultRange = presetRange('today')
  const filter: PeriodFilterValue = {
    from: sp.from || defaultRange.from,
    to: sp.to || defaultRange.to,
    outletId: lockedOutletId || sp.outletId || 'all',
    source: (sp.source as SalesSource) || 'all'
  }

  const { data: outlets = [] } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active, marquee_warning_threshold')
    .neq('id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('name')

  const scopedOutlets = lockedOutletId 
    ? (outlets ?? []).filter(o => o.id === lockedOutletId) 
    : (outlets ?? [])

  // Query REAL database records for Petty Cash (Transactions + Daily Summaries)
  const { transactions, dailySummaries } = await getPettyCashData(filter, scopedOutlets)

  return (
    <PettyCashPageClient
      filter={filter}
      outlets={scopedOutlets}
      lockedOutletId={lockedOutletId}
      pettyCashTransactions={transactions}
      dailySummaries={dailySummaries}
    />
  )
}
