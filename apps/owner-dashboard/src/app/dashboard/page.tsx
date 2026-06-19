'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { presetRange, previousRange } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import type { PeriodFilterValue } from '@/lib/types'
import { useSalesSummary } from '@/hooks/useSalesSummary'
import { useMenuSales } from '@/hooks/useMenuSales'
import { PeriodFilter } from '@/components/PeriodFilter'
import { KpiCards } from '@/components/KpiCards'
import { SourceBreakdown } from '@/components/SourceBreakdown'
import { RevenueTrendChart } from '@/components/RevenueTrendChart'
import { TopMenus } from '@/components/TopMenus'
import { OutletLeaderboard } from '@/components/OutletLeaderboard'

export default function DashboardPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([])
  const [filter, setFilter] = useState<PeriodFilterValue>(() => ({ ...presetRange('7d'), outletId: 'all', source: 'all' }))
  const prevFilter = useMemo<PeriodFilterValue>(() => ({ ...filter, ...previousRange({ from: filter.from, to: filter.to }) }), [filter])

  useEffect(() => {
    supabase.from('outlets').select('id,name').order('name').then(({ data }) => setOutlets(data ?? []))
  }, [supabase])

  const cur = useSalesSummary(filter)
  const prev = useSalesSummary(prevFilter)
  const menu = useMenuSales(filter)
  const leaderboard = useMemo(() => buildLeaderboard(cur.rows, prev.rows), [cur.rows, prev.rows])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-suka-brown">Owner Dashboard — Penjualan</h1>
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} />
      </div>

      {cur.error && <p className="text-red-600 text-sm">Gagal memuat data: {cur.error}</p>}
      {cur.loading ? <p className="text-gray-500">Memuat…</p> : (
        <>
          <KpiCards rows={cur.rows} />
          <SourceBreakdown rows={cur.rows} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><RevenueTrendChart rows={cur.rows} /></div>
            <TopMenus rows={menu.rows} />
          </div>
          <OutletLeaderboard entries={leaderboard} />
        </>
      )}
    </div>
  )
}
