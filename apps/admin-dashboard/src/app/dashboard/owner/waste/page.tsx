// apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useWasteBreakdown } from '@/hooks/useWasteBreakdown'
import { aggregateByOutlet, aggregateByReason, aggregateByBahan, aggregateByDate } from '@/lib/wasteBreakdown'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PageHeader, StatTile, Section, StatTilesSkeleton } from '@/components/ui'
import { rupiah } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingDown } from 'lucide-react'

const WasteTrendChart = dynamic(
  () => import('@/components/WasteTrendChart').then((m) => m.WasteTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function WastePage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  const { rows, loading, error } = useWasteBreakdown(filter)

  const totalNilai = useMemo(() => rows.reduce((s, r) => s + r.nilai, 0), [rows])
  const byOutlet = useMemo(() => aggregateByOutlet(rows), [rows])
  const byReason = useMemo(() => aggregateByReason(rows), [rows])
  const byBahan = useMemo(() => aggregateByBahan(rows), [rows])
  const byDate = useMemo(() => aggregateByDate(rows), [rows])

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Total Kerugian Waste"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
              sub="Approved, periode terpilih"
              icon={TrendingDown}
              accent="red"
            />
          </div>

          <Section title="Tren Waktu">
            <WasteTrendChart data={byDate} />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium">
                    {byOutlet.length === 0 ? (
                      <tr><td colSpan={2} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                    ) : byOutlet.map(o => (
                      <tr key={o.id}>
                        <td className="py-3 px-6 text-suka-ink font-bold">{o.name.replace('SUKA SHAWARMA ', '')}</td>
                        <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(o.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-suka-gray-100">
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Per Alasan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                      <th className="py-3 px-6">Alasan</th>
                      <th className="py-3 px-6 text-right">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium">
                    {byReason.length === 0 ? (
                      <tr><td colSpan={2} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                    ) : byReason.map(r => (
                      <tr key={r.reason}>
                        <td className="py-3 px-6 text-suka-ink font-bold">{r.reason}</td>
                        <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(r.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-suka-gray-100">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Bahan Baku Paling Sering Waste</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                    <th className="py-3 px-6">Bahan Baku</th>
                    <th className="py-3 px-6 text-right">Qty</th>
                    <th className="py-3 px-6 text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 font-medium">
                  {byBahan.length === 0 ? (
                    <tr><td colSpan={3} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                  ) : byBahan.map(b => (
                    <tr key={b.id}>
                      <td className="py-3 px-6 text-suka-ink font-bold">{b.name}</td>
                      <td className="py-3 px-6 text-right text-suka-gray-600">{b.qty}</td>
                      <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(b.nilai)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
