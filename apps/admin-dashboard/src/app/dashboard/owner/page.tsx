'use client'
import { useMemo } from 'react'
import { previousRange } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import { useSalesSummary } from '@/hooks/useSalesSummary'
import { useSalesHourly } from '@/hooks/useSalesHourly'
import { useMenuSales } from '@/hooks/useMenuSales'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesRealtime } from '@/hooks/useSalesRealtime'
import { PeriodFilter } from '@/components/PeriodFilter'
import { KpiCards } from '@/components/KpiCards'
import { SourceBreakdown } from '@/components/SourceBreakdown'
import { TopMenus } from '@/components/TopMenus'
import { BottomMenus } from '@/components/BottomMenus'
import { OutletLeaderboard } from '@/components/OutletLeaderboard'
import { DailyTargetBoard } from '@/components/DailyTargetBoard'
import { useRole } from '@/components/layout/RoleContext'
import type { PeriodFilterValue } from '@/lib/types'
import dynamic from 'next/dynamic'

const RevenueTrendChart = dynamic(
  () => import('@/components/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function DashboardPage() {
  const { isReadOnly } = useRole()
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
  const scopedOutlets = useMemo(
    () => (lockedOutletId ? outlets.filter((o) => o.id === lockedOutletId) : outlets),
    [outlets, lockedOutletId]
  )
  // Realtime: papan ikut refresh begitu ada order baru (paid+selesai) tanpa ganti filter.
  useSalesRealtime()
  const prevFilter = useMemo<PeriodFilterValue>(() => ({ ...filter, ...previousRange({ from: filter.from, to: filter.to }) }), [filter])

  const cur = useSalesSummary(filter, outlets)
  const prev = useSalesSummary(prevFilter, outlets)
  const hourly = useSalesHourly(filter)
  const menu = useMenuSales(filter)
  const leaderboard = useMemo(() => buildLeaderboard(cur.rows, prev.rows), [cur.rows, prev.rows])

  const isOneDay = filter.from === filter.to
  const isLoading = cur.loading || hourly.loading || menu.loading
  // Surface error dari salah satu query (jangan hanya `cur`), agar chart kosong
  // tidak disangka "tak ada data" saat sebenarnya fetch hourly/menu gagal.
  const errorMsg = cur.error || hourly.error || menu.error

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight">Kinerja Penjualan</h2>
          <p className="text-xs text-suka-gray-500 font-medium">Statistik penjualan riil dari sistem POS Kasir</p>
        </div>
        <PeriodFilter value={filter} onChange={setFilter} outlets={scopedOutlets} lockedOutletId={lockedOutletId} />
      </div>

      {errorMsg && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">Gagal memuat data: {errorMsg}</div>}
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-suka-brown font-bold text-sm">
          Memuat data analisis penjualan...
        </div>
      ) : (
        <>
          <KpiCards
            rows={cur.rows}
            prevRows={prev.rows}
            hourlyRows={hourly.rows}
          />

          {/* Indikator target harian realtime (semua outlet) */}
          <DailyTargetBoard />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <RevenueTrendChart 
                rows={isOneDay ? hourly.rows : cur.rows} 
                isHourly={isOneDay} 
              />
              <SourceBreakdown rows={cur.rows} />
            </div>
            <div className="space-y-6">
              <TopMenus rows={menu.rows} />
              <BottomMenus rows={menu.rows} />
            </div>
          </div>
          {!isReadOnly && <OutletLeaderboard entries={leaderboard} allOutlets={scopedOutlets} />}
        </>
      )}
    </div>
  )
}
