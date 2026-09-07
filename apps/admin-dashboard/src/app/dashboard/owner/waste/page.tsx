// apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
'use client'

import { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useWasteSummary } from '@/hooks/useWasteSummary'
import { useWasteIncidents, type WasteIncidentRow } from '@/hooks/useWasteIncidents'
import { useBudgetLoss } from '@/hooks/useBudgetLoss'
import { useSalesDaily } from '@/hooks/useSalesDaily'
import { aggregateByOutlet, aggregateByReason, aggregateByDate } from '@/lib/wasteBreakdown'
import { aggregateByBahanWithSpread } from '@/lib/wasteMetrics'
import { previousRange } from '@/lib/period'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PageHeader, Section, StatTilesSkeleton } from '@/components/ui'
import { WasteKpiRow } from '@/components/waste/WasteKpiRow'
import { WasteOutletRanking } from '@/components/waste/WasteOutletRanking'
import { WasteReasonBreakdown } from '@/components/waste/WasteReasonBreakdown'
import { WasteBahanRanking } from '@/components/waste/WasteBahanRanking'
import { WasteIncidentTable } from '@/components/waste/WasteIncidentTable'
import { WasteIncidentDetailModal } from '@/components/waste/WasteIncidentDetailModal'

const WasteTrendChart = dynamic(
  () => import('@/components/WasteTrendChart').then((m) => m.WasteTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function WastePage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<WasteIncidentRow | null>(null)

  const prev = useMemo(() => previousRange({ from: filter.from, to: filter.to }), [filter.from, filter.to])

  const summary = useWasteSummary(filter)
  const summaryPrev = useWasteSummary(filter, { rangeOverride: prev })
  const incidents = useWasteIncidents(filter, page)
  const budgetLoss = useBudgetLoss(filter)
  const sales = useSalesDaily(filter, outlets)

  // Ganti filter -> kembali ke halaman 1, supaya tidak terjebak di halaman
  // yang sudah tidak ada pada hasil baru.
  useEffect(() => { setPage(1) }, [filter.from, filter.to, filter.outletId])

  // summaryPrev & sales ikut digate: kalau tidak, tile sempat menampilkan
  // "N/A" palsu (delta & % omzet) sebelum datanya datang.
  const loading = summary.loading || summaryPrev.loading || budgetLoss.loading || sales.loading
  const error = summary.error || summaryPrev.error || budgetLoss.error || incidents.error || sales.error

  const totalNilai = useMemo(() => summary.rows.reduce((s, r) => s + r.nilai, 0), [summary.rows])
  const totalPrevious = useMemo(() => summaryPrev.rows.reduce((s, r) => s + r.nilai, 0), [summaryPrev.rows])
  const totalInsiden = useMemo(() => summary.rows.reduce((s, r) => s + r.jumlah_insiden, 0), [summary.rows])
  const totalBudget = useMemo(() => budgetLoss.rows.reduce((s, r) => s + r.budget_loss, 0), [budgetLoss.rows])

  const byOutlet = useMemo(() => aggregateByOutlet(summary.rows), [summary.rows])
  const byReason = useMemo(() => aggregateByReason(summary.rows), [summary.rows])
  const byDate = useMemo(() => aggregateByDate(summary.rows), [summary.rows])
  const byBahan = useMemo(() => aggregateByBahanWithSpread(summary.rows), [summary.rows])

  const omzetByOutlet = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of sales.rows) map.set(r.outlet_id, (map.get(r.outlet_id) ?? 0) + r.omzet)
    return map
  }, [sales.rows])

  const budgetByOutlet = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of budgetLoss.rows) map.set(r.outlet_id, r.budget_loss)
    return map
  }, [budgetLoss.rows])

  const totalOmzet = useMemo(() => {
    let sum = 0
    for (const [outletId, omzet] of omzetByOutlet) {
      if (filter.outletId === 'all' || outletId === filter.outletId) sum += omzet
    }
    return sum
  }, [omzetByOutlet, filter.outletId])

  const showOutletColumn = filter.outletId === 'all'

  return (
    <div className="space-y-6">
      <PageHeader title="Kerugian Waste" description="Rincian waste bahan baku yang sudah di-approve">
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} hideSource />
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data waste: {error}
        </div>
      )}

      {summary.truncated && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-100 text-sm">
          Rentang tanggal terlalu panjang — data dipotong di 1.000 baris, angka di bawah ini tidak lengkap. Persempit rentangnya.
        </div>
      )}

      {loading ? (
        <StatTilesSkeleton count={4} />
      ) : (
        <>
          <WasteKpiRow
            totalNilai={totalNilai}
            totalPrevious={totalPrevious}
            totalOmzet={totalOmzet}
            totalBudget={totalBudget}
            totalInsiden={totalInsiden}
            outletCount={byOutlet.length}
          />

          <Section title="Tren Waktu">
            <WasteTrendChart data={byDate} />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {showOutletColumn && (
              <WasteOutletRanking rows={byOutlet} budgetByOutlet={budgetByOutlet} omzetByOutlet={omzetByOutlet} />
            )}
            <div className={showOutletColumn ? '' : 'lg:col-span-2'}>
              <WasteReasonBreakdown rows={byReason} total={totalNilai} />
            </div>
          </div>

          <WasteBahanRanking rows={byBahan} />

          <WasteIncidentTable
            rows={incidents.rows}
            totalCount={incidents.totalCount}
            page={page}
            onPageChange={setPage}
            onSelect={setSelected}
            showOutletColumn={showOutletColumn}
            loading={incidents.loading}
          />
        </>
      )}

      <WasteIncidentDetailModal isOpen={selected !== null} onClose={() => setSelected(null)} row={selected} />
    </div>
  )
}
