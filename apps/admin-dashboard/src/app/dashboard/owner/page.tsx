import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange, previousRange } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import { getBuyOneGetOneSummary, getOwnerDashboardDataFast } from '@/app/actions/ownerDashboard'
import OwnerDashboardView from './OwnerDashboardView'
import type { SalesSource, PeriodFilterValue } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export const dynamic = 'force-dynamic'

export default async function OwnerDashboardPage({ searchParams }: { searchParams: Promise<any> }) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  
  const sp = await searchParams
  
  // 1. Fetch User Role & Locked Outlet
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role, outlet_id').eq('id', user?.id || '').single()
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

  // 3. Fetch Outlets (Exclude Test Outlets)
  const { data: rawOutlets = [] } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active, marquee_warning_threshold')
    .neq('id', TEST_OUTLET_ID)
    .order('name')
    
  const outlets = (rawOutlets ?? []).filter(o => !isTestOutlet(o))
  const allOutletsWithSS = [
    { id: 'ss-online', name: 'SS ONLINE', type: 'online' } as any,
    ...outlets
  ]
  const scopedOutlets = lockedOutletId 
    ? outlets.filter(o => o.id === lockedOutletId) 
    : allOutletsWithSS

  // 4. Run Fast Aggregations in parallel (semua agregasi di PostgreSQL via RPC)
  const [curData, prevData] = await Promise.all([
    getOwnerDashboardDataFast(filter, scopedOutlets),
    getOwnerDashboardDataFast(prevFilter, scopedOutlets),
  ])
  const buyOneGetOne = curData.buyOneGetOne || { transactions: 0, giftUnits: 0 }
  // menu_rows sudah include dalam respons RPC masing-masing periode
  const menuSales     = curData.menuRows
  const prevMenuSales = prevData.menuRows

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
      prevMenuRows={prevMenuSales}
      leaderboard={leaderboard}
      curCogsOpex={curData.totalCogsOpex}
      prevCogsOpex={prevData.totalCogsOpex}
      cogsBreakdown={{ cogs: curData.totalCogs, opex: curData.totalOpex }}
      buyOneGetOne={buyOneGetOne}
    />
  )
}
