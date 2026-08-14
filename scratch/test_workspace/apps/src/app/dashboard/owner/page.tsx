import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange, previousRange } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import { getOwnerDashboardData } from '@/app/actions/ownerDashboard'
import { getAggregatedMenuSales } from '@/app/actions/menuSales'
import OwnerDashboardView from './OwnerDashboardView'
import type { SalesSource, PeriodFilterValue } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function OwnerDashboardPage({ searchParams }: { searchParams: Promise<any> }) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  
  const sp = await searchParams
  
  // 1. Fetch User Role & Locked Outlet
  const { data: user } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role, outlet_id').eq('id', user.user?.id).single()
  const isReadOnly = profile?.role === 'MITRA'
  const lockedOutletId = isReadOnly ? profile?.outlet_id : null

  // 2. Build Filter from searchParams or Default
  const defaultRange = presetRange('today')
  const filter: PeriodFilterValue = {
    from: sp.from || defaultRange.from,
    to: sp.to || defaultRange.to,
    outletId: lockedOutletId || sp.outletId || 'all',
    source: (sp.source as SalesSource) || 'all'
  }
  const prevFilter: PeriodFilterValue = { 
    ...filter, 
    ...previousRange({ from: filter.from, to: filter.to }) 
  }

  // 3. Fetch Outlets
  const { data: outlets = [] } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active, marquee_warning_threshold')
    .neq('id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('name')
    
  const scopedOutlets = lockedOutletId 
    ? (outlets ?? []).filter(o => o.id === lockedOutletId) 
    : (outlets ?? [])

  // 4. Run Aggregations in parallel on Node Server
  const [curData, prevData, menuSales] = await Promise.all([
    getOwnerDashboardData(filter, scopedOutlets),
    getOwnerDashboardData(prevFilter, scopedOutlets),
    getAggregatedMenuSales(filter),
  ])

  const leaderboard = buildLeaderboard(curData.kpiRows, prevData.kpiRows)

  // 5. Send pre-computed data to Client View
  return (
    <OwnerDashboardView 
      filter={filter}
      outlets={scopedOutlets}
      lockedOutletId={lockedOutletId}
      isReadOnly={isReadOnly}
      role={profile?.role}
      curKpiRows={curData.kpiRows}
      prevKpiRows={prevData.kpiRows}
      hourlyRows={curData.hourlyRows}
      menuRows={menuSales}
      leaderboard={leaderboard}
    />
  )
}
