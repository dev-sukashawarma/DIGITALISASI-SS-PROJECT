'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { previousRange } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import { useSalesSummary } from '@/hooks/useSalesSummary'
import { useMenuSales } from '@/hooks/useMenuSales'
import { useDashboardStore } from '@/hooks/useDashboardStore'
import { PeriodFilter } from '@/components/PeriodFilter'
import { KpiCards } from '@/components/KpiCards'
import { SourceBreakdown } from '@/components/SourceBreakdown'
import { RevenueTrendChart } from '@/components/RevenueTrendChart'
import { TopMenus } from '@/components/TopMenus'
import { OutletLeaderboard } from '@/components/OutletLeaderboard'
import type { PeriodFilterValue } from '@/lib/types'

export default function DashboardPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([])
  const { filter, setFilter } = useDashboardStore()
  const prevFilter = useMemo<PeriodFilterValue>(() => ({ ...filter, ...previousRange({ from: filter.from, to: filter.to }) }), [filter])

  useEffect(() => {
    supabase.from('outlets').select('id,name').order('name').then(({ data }) => setOutlets(data ?? []))
  }, [supabase])

  const cur = useSalesSummary(filter)
  const prev = useSalesSummary(prevFilter)
  const menu = useMenuSales(filter)
  const leaderboard = useMemo(() => buildLeaderboard(cur.rows, prev.rows), [cur.rows, prev.rows])

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Kinerja Penjualan</h2>
          <p className="text-xs text-suka-gray-500 font-medium">Statistik penjualan riil dari sistem POS Kasir</p>
        </div>
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} />
      </div>

      {cur.error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">Gagal memuat data: {cur.error}</div>}
      
      {cur.loading ? (
        <div className="flex items-center justify-center py-12 text-suka-brown font-bold text-sm">
          Memuat data analisis penjualan...
        </div>
      ) : (
        <>
          <KpiCards rows={cur.rows} prevRows={prev.rows} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <RevenueTrendChart rows={cur.rows} />
              <SourceBreakdown rows={cur.rows} />
            </div>
            <div className="space-y-6">
              <TopMenus rows={menu.rows} />
            </div>
          </div>
          
          <OutletLeaderboard entries={leaderboard} />
        </>
      )}
    </div>
  )
}
