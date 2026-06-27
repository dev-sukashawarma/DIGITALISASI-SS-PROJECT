'use client'
import { useMemo } from 'react'
import { previousRange } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import { useSalesSummary } from '@/hooks/useSalesSummary'
import { useSalesHourly } from '@/hooks/useSalesHourly'
import { useMenuSales } from '@/hooks/useMenuSales'
import { useDashboardStore } from '@/hooks/useDashboardStore'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesRealtime } from '@/hooks/useSalesRealtime'
import { PeriodFilter } from '@/components/PeriodFilter'
import { KpiCards } from '@/components/KpiCards'
import { SourceBreakdown } from '@/components/SourceBreakdown'
import { RevenueTrendChart } from '@/components/RevenueTrendChart'
import { TopMenus } from '@/components/TopMenus'
import { BottomMenus } from '@/components/BottomMenus'
import { OutletLeaderboard } from '@/components/OutletLeaderboard'
import { DailyTargetBoard } from '@/components/DailyTargetBoard'
import type { PeriodFilterValue } from '@/lib/types'

export default function DashboardPage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter } = useDashboardStore()
  // Realtime: papan ikut refresh begitu ada order baru (paid+selesai) tanpa ganti filter.
  useSalesRealtime()
  const prevFilter = useMemo<PeriodFilterValue>(() => ({ ...filter, ...previousRange({ from: filter.from, to: filter.to }) }), [filter])

  const cur = useSalesSummary(filter)
  const prev = useSalesSummary(prevFilter)
  const hourly = useSalesHourly(filter)
  const menu = useMenuSales(filter)
  const leaderboard = useMemo(() => buildLeaderboard(cur.rows, prev.rows), [cur.rows, prev.rows])

  const isOneDay = filter.from === filter.to
  const isLoading = cur.loading || hourly.loading || menu.loading

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight">Kinerja Penjualan</h2>
          <p className="text-xs text-suka-gray-500 font-medium">Statistik penjualan riil dari sistem POS Kasir</p>
        </div>
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} />
      </div>

      {cur.error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">Gagal memuat data: {cur.error}</div>}
      
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
          <OutletLeaderboard entries={leaderboard} allOutlets={outlets} />
        </>
      )}
    </div>
  )
}
