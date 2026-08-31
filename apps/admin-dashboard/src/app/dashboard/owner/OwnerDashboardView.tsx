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
import { Clock, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import { presetRange, diffDays } from '@/lib/period'

const RevenueTrendChart = dynamic(
  () => import('@/components/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

function formatLastUpdated(dateIso?: string) {
  if (!dateIso) return ''
  try {
    const d = new Date(dateIso)
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' WIB'
  } catch {
    return ''
  }
}

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
  curCogs?: number
  prevCogs?: number
  curOpex?: number
  prevOpex?: number
  curCogsOpex?: number
  prevCogsOpex?: number
  cogsBreakdown?: { cogs: number; opex: number }
  buyOneGetOne?: { transactions: number; giftUnits: number }
  lastUpdated?: string
  isCached?: boolean
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
  curCogs,
  prevCogs,
  curOpex,
  prevOpex,
  curCogsOpex,
  prevCogsOpex,
  cogsBreakdown,
  buyOneGetOne,
  lastUpdated,
  isCached,
}: OwnerDashboardViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isOneDay = filter.from === filter.to
  const p30 = presetRange('30d')
  const is30Days = (filter.from === p30.from && filter.to === p30.to) || diffDays(filter.from, filter.to) === 30
  const lastUpdatedFormatted = formatLastUpdated(lastUpdated)

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

        {/* Status Sinkronisasi / Last Updated */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 -mt-3 mb-2 text-xs">
          <div className="flex items-center gap-2">
            {isCached ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[11px] shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Terakhir diperbarui: <strong>{lastUpdatedFormatted}</strong> (Data Lampau Tersimpan)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-bold text-[11px] shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Realtime · Sinkronisasi POS: <strong>{lastUpdatedFormatted}</strong></span>
              </span>
            )}
          </div>
          <button
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white hover:bg-suka-gray-50 border border-suka-gray-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Muat ulang data dari database"
          >
            <RefreshCw className={`w-3 h-3 text-suka-orange ${isPending ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>

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
            curCogs={curCogs}
            prevCogs={prevCogs}
            curOpex={curOpex}
            prevOpex={prevOpex}
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
