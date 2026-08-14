// apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useWasteBreakdown } from '@/hooks/useWasteBreakdown'
import { aggregateByOutlet, aggregateByDate, aggregateByBahanAndReason } from '@/lib/wasteBreakdown'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PageHeader, StatTile, Section, StatTilesSkeleton } from '@/components/ui'
import { rupiah } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingDown } from 'lucide-react'
import { useBudgetLoss } from '@/hooks/useBudgetLoss'
import { computeWasteGap } from '@/lib/wasteGap'
import { Target } from 'lucide-react'

const WasteTrendChart = dynamic(
  () => import('@/components/WasteTrendChart').then((m) => m.WasteTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function WastePage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  const { rows, loading: wasteLoading, error: wasteError } = useWasteBreakdown(filter)
  const budgetLoss = useBudgetLoss(filter)
  const loading = wasteLoading || budgetLoss.loading
  const error = wasteError || budgetLoss.error

  const totalNilai = useMemo(() => rows.reduce((s, r) => s + r.nilai, 0), [rows])
  const byOutlet = useMemo(() => aggregateByOutlet(rows), [rows])
  const byBahanAndReason = useMemo(() => aggregateByBahanAndReason(rows), [rows])
  const byDate = useMemo(() => aggregateByDate(rows), [rows])
  const totalBudget = useMemo(() => budgetLoss.rows.reduce((s, r) => s + r.budget_loss, 0), [budgetLoss.rows])
  const gap = useMemo(() => computeWasteGap(totalNilai, totalBudget), [totalNilai, totalBudget])
  const budgetByOutlet = useMemo(() => {
    const map = new Map<string, number>()
    budgetLoss.rows.forEach(r => map.set(r.outlet_id, r.budget_loss))
    return map
  }, [budgetLoss.rows])

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

      {loading ? (
        <StatTilesSkeleton count={1} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="Total Kerugian Waste"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
              sub="Approved, periode terpilih"
              icon={TrendingDown}
              accent="red"
            />
            <StatTile
              label="Budget Loss (BOM)"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalBudget} duration={1} separator="." /></>}
              sub="Alokasi Loss dari resep x qty terjual"
              icon={Target}
              accent="brown"
            />
            <StatTile
              label="Gap %"
              value={gap.gapPct === null ? 'N/A' : <><CountUp end={gap.gapPct} duration={1} decimals={1} /> %</>}
              sub={gap.gapPct === null ? 'Belum ada budget pada periode ini' : gap.gapPct > 0 ? 'Waste melebihi alokasi BOM' : 'Di bawah alokasi BOM'}
              icon={TrendingDown}
              accent={gap.gapPct === null ? 'brown' : gap.gapPct > 0 ? 'red' : 'green'}
            />
          </div>

          <Section title="Tren Waktu">
            <WasteTrendChart data={byDate} />
          </Section>

          {/* Layout berubah tergantung apakah filter outlet 'all' atau spesifik */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {filter.outletId === 'all' && (
              <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-suka-gray-100">
                  <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Ranking per Outlet</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                        <th className="py-3 px-6">Outlet</th>
                        <th className="py-3 px-6 text-right">Nilai</th>
                        <th className="py-3 px-6 text-right">Budget Loss</th>
                        <th className="py-3 px-6 text-right">Gap %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-suka-gray-100 font-medium">
                      {byOutlet.length === 0 ? (
                        <tr><td colSpan={4} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                      ) : byOutlet.map(o => {
                        const budget = budgetByOutlet.get(o.id) ?? 0
                        const rowGap = computeWasteGap(o.nilai, budget)
                        return (
                          <tr key={o.id}>
                            <td className="py-3 px-6 text-suka-ink font-bold">{o.name.replace('SUKA SHAWARMA ', '')}</td>
                            <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(o.nilai)}</td>
                            <td className="py-3 px-6 text-right text-suka-gray-600">{rupiah(budget)}</td>
                            <td className={`py-3 px-6 text-right font-bold ${rowGap.gapPct === null ? 'text-suka-gray-400' : rowGap.gapPct > 0 ? 'text-red-700' : 'text-suka-green'}`}>
                              {rowGap.gapPct === null ? 'N/A' : `${rowGap.gapPct.toFixed(1)}%`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={`bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden ${filter.outletId !== 'all' ? 'lg:col-span-2' : ''}`}>
              <div className="px-6 py-4 border-b border-suka-gray-100">
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Rincian Waste</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                      <th className="py-3 px-6">Tanggal</th>
                      <th className="py-3 px-6">Bahan Baku</th>
                      <th className="py-3 px-6">Alasan</th>
                      <th className="py-3 px-6 text-right">Qty</th>
                      <th className="py-3 px-6 text-right">HPP / satuan</th>
                      <th className="py-3 px-6 text-right">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium">
                    {byBahanAndReason.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                    ) : byBahanAndReason.map(b => (
                      <tr key={b.id}>
                        <td className="py-3 px-6 text-suka-gray-600 whitespace-nowrap">
                          {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(b.tanggal))}
                        </td>
                        <td className="py-3 px-6 text-suka-ink font-bold">{b.bahan_nama}</td>
                        <td className="py-3 px-6 text-suka-gray-600">{b.reason}</td>
                        <td className="py-3 px-6 text-right text-suka-gray-600">{b.qty_kecil} {b.satuan_kecil}</td>
                        <td className="py-3 px-6 text-right text-suka-gray-600">{rupiah(b.hpp_kecil)}</td>
                        <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(b.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
