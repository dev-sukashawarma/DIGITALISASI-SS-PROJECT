// @ts-nocheck
'use client'

import { useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'
import { PeriodFilter } from '@/components/PeriodFilter'
import { KpiCards } from '@/components/KpiCards'
import { SourceBreakdown } from '@/components/SourceBreakdown'
import { TopMenus } from '@/components/TopMenus'
import { OutletLeaderboard } from '@/components/OutletLeaderboard'
import { DailyTargetBoard } from '@/components/DailyTargetBoard'
import { PageHeader } from '@/components/ui'
import type { PeriodFilterValue, Outlet, SalesSummaryRow } from '@/lib/types'
import type { SalesHourlyRow } from '@/hooks/useSalesHourly'
import type { AggregatedMenuSales } from '@/app/actions/menuSales'
import dynamic from 'next/dynamic'
import { presetRange, diffDays } from '@/lib/period'

const RevenueTrendChart = dynamic(
  () => import('@/components/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

interface OwnerDashboardViewProps {
  filter: PeriodFilterValue
  outlets: Outlet[]
  lockedOutletId: string | null
  isReadOnly: boolean
  role?: string
  curKpiRows: SalesSummaryRow[]
  prevKpiRows: SalesSummaryRow[]
  hourlyRows: SalesHourlyRow[]
  menuRows: AggregatedMenuSales[]
  prevMenuRows?: AggregatedMenuSales[]
  leaderboard: any[]
  curCogsOpex?: number
  prevCogsOpex?: number
  cogsBreakdown?: { cogs: number; opex: number }
  buyOneGetOne?: { transactions: number; giftUnits: number }
}

function RealtimeRefresher() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const debounceRef = useRef<any>(null)

  useEffect(() => {
    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        router.refresh()
      }, 800)
    }

    const channel = supabase
      .channel('owner-sales-realtime-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  return null
}

export default function OwnerDashboardView({
  filter,
  outlets,
  lockedOutletId,
  isReadOnly,
  role,
  curKpiRows,
  prevKpiRows,
  hourlyRows,
  menuRows,
  prevMenuRows,
  leaderboard,
  curCogsOpex,
  prevCogsOpex,
  cogsBreakdown,
  buyOneGetOne,
}: OwnerDashboardViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isOneDay = filter.from === filter.to
  const p30 = presetRange('30d')
  const is30Days = (filter.from === p30.from && filter.to === p30.to) || diffDays(filter.from, filter.to) === 30

  const handleFilterChange = (newFilter: PeriodFilterValue) => {
    const params = new URLSearchParams()
    if (newFilter.from) params.set('from', newFilter.from)
    if (newFilter.to) params.set('to', newFilter.to)
    if (newFilter.outletId !== 'all') params.set('outletId', newFilter.outletId)
    if (newFilter.source !== 'all') params.set('source', newFilter.source)
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <>
      <RealtimeRefresher />

      {/* Normal Dashboard Screen */}
      <div className="space-y-6 animate-fade-in">
        {/* Header Dashboard */}
        <PageHeader title="Ringkasan Bisnis" description="Statistik penjualan riil dari sistem POS Kasir">
          <PeriodFilter value={filter} onChange={handleFilterChange} outlets={outlets} lockedOutletId={lockedOutletId} hideSource />
        </PageHeader>

        {/* Loading Spinner Indicator */}
        {isPending && (
          <div className="flex justify-center items-center py-10 bg-white/50 rounded-2xl animate-pulse border border-suka-orange/20">
            <div className="flex flex-col items-center gap-3">

              <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin"></div>
              <p className="text-suka-brown font-bold text-sm">Memuat data dashboard...</p>
            </div>
          </div>
        )}

        <div className={isPending ? 'opacity-50 pointer-events-none transition-opacity space-y-6' : 'transition-opacity space-y-6'}>
          <KpiCards
            rows={curKpiRows || []}
            prevRows={prevKpiRows || []}
            hourlyRows={hourlyRows || []}
            menuRows={menuRows || []}
            prevMenuRows={prevMenuRows || []}
            curCogsOpex={curCogsOpex}
            prevCogsOpex={prevCogsOpex}
            cogsBreakdown={cogsBreakdown}
          />

          {/* Indikator target harian realtime (hanya tampil saat filter 1 hari: hari ini / kemarin) */}
          {role !== 'MITRA' && filter.outletId !== 'ss-online' && isOneDay && (
            <DailyTargetBoard filter={filter} kpiRows={curKpiRows || []} />
          )}

          {/* Leaderboard Kinerja Outlet (Full Width di atas saat filter 30 hari) */}
          {is30Days && !isReadOnly && filter.outletId !== 'ss-online' && (
            <OutletLeaderboard entries={leaderboard || []} allOutlets={outlets} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <RevenueTrendChart 
                rows={isOneDay ? (hourlyRows || []) : (curKpiRows || [])} 
                isHourly={isOneDay} 
              />
              <SourceBreakdown rows={curKpiRows || []} outletId={filter.outletId} />
            </div>
            <div className="space-y-6">
              <TopMenus rows={menuRows || []} />
            </div>
          </div>

          {/* Leaderboard Kinerja Outlet (posisi default bawah saat bukan filter 30 hari) */}
          {!is30Days && !isReadOnly && filter.outletId !== 'ss-online' && (
            <OutletLeaderboard entries={leaderboard || []} allOutlets={outlets} />
          )}
        </div>
      </div>
    </>
  )
}
