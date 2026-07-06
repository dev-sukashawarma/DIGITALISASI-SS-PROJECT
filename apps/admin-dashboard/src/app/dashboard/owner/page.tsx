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
import { PageHeader } from '@/components/ui'
import type { PeriodFilterValue } from '@/lib/types'
import dynamic from 'next/dynamic'

const RevenueTrendChart = dynamic(
  () => import('@/components/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function DashboardPage() {
  const { isReadOnly, role } = useRole()
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
    <>
      {/* Normal Dashboard */}
      <div className="space-y-6 print:hidden">
        <PageHeader title="Ringkasan Bisnis" description="Statistik penjualan riil dari sistem POS Kasir">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <PeriodFilter value={filter} onChange={setFilter} outlets={scopedOutlets} lockedOutletId={lockedOutletId} />
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-4 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Cetak PDF
            </button>
          </div>
        </PageHeader>

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
            {role !== 'MITRA' && <DailyTargetBoard />}

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

      {/* Tampilan Khusus Cetak PDF */}
      {!isLoading && !errorMsg && (
        <PrintReport 
          filter={filter} 
          outlets={scopedOutlets} 
          lockedOutletId={lockedOutletId} 
          cur={cur} 
          hourly={hourly} 
          menu={menu} 
        />
      )}
    </>
  )
}

function PrintReport({ filter, outlets, lockedOutletId, cur, hourly, menu }: any) {
  const isAllOutlets = !lockedOutletId || outlets.length > 1
  const outletName = isAllOutlets ? 'Semua Outlet' : outlets[0]?.name

  const omzet = cur.rows.reduce((s: number, r: any) => s + r.omzet, 0)
  const completed = cur.rows.reduce((s: number, r: any) => s + r.jumlah_order_completed, 0)
  const currentAov = completed > 0 ? Math.round(omzet / completed) : 0

  let peakHourStr = '-'
  let peakHourOrders = 0
  if (hourly.rows.length > 0) {
    const peak = [...hourly.rows].sort((a: any, b: any) => b.jumlah_order_completed - a.jumlah_order_completed || b.omzet - a.omzet)[0]
    if (peak && peak.jumlah_order_completed > 0) {
      peakHourStr = `${peak.sales_hour.toString().padStart(2, '0')}:00`
      peakHourOrders = peak.jumlah_order_completed
    }
  }

  const sortedMenu = [...menu.rows].sort((a: any, b: any) => b.qty - a.qty).slice(0, 10) // Top 10

  const formatRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  
  // Basic date formatter helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  
  const printTime = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="hidden print:block text-black bg-white w-full py-8">
      <div className="border-b-4 border-black pb-4 mb-8">
        <h1 className="text-4xl font-extrabold uppercase tracking-tight text-center">Laporan Ringkasan Bisnis</h1>
        <h2 className="text-2xl font-bold mt-2 text-gray-700 text-center uppercase tracking-widest">Suka Shawarma</h2>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10 text-lg">
        <div>
          <p className="text-gray-500 font-bold uppercase tracking-wide text-sm">Periode Laporan</p>
          <p className="font-semibold text-xl mt-1">{formatDate(filter.from)} - {formatDate(filter.to)}</p>
        </div>
        <div>
          <p className="text-gray-500 font-bold uppercase tracking-wide text-sm">Outlet Terpilih</p>
          <p className="font-semibold text-xl mt-1">{outletName}</p>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-4 uppercase border-b-2 border-gray-300 pb-2">Indikator Kinerja Utama (KPI)</h3>
      <table className="w-full text-left mb-10 border-2 border-black border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-4 border-b-2 border-black font-bold uppercase text-sm w-1/2">Metrik</th>
            <th className="p-4 border-b-2 border-black font-bold uppercase text-sm text-right">Nilai</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-4 border-b border-gray-300 font-medium">Total Omzet Penjualan</td>
            <td className="p-4 border-b border-gray-300 text-right font-extrabold text-2xl">{formatRp(omzet)}</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="p-4 border-b border-gray-300 font-medium">Total Transaksi (Order Selesai)</td>
            <td className="p-4 border-b border-gray-300 text-right font-extrabold text-2xl">{completed.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td className="p-4 border-b border-gray-300 font-medium">Rata-rata Nilai Belanja (AOV)</td>
            <td className="p-4 border-b border-gray-300 text-right font-extrabold text-2xl">{formatRp(currentAov)}</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="p-4 border-b border-gray-300 font-medium">Jam Tersibuk (Peak Hour)</td>
            <td className="p-4 border-b border-gray-300 text-right font-extrabold text-2xl">{peakHourStr} <span className="text-base font-normal text-gray-600 block sm:inline">({peakHourOrders} order)</span></td>
          </tr>
        </tbody>
      </table>

      {sortedMenu.length > 0 && (
        <>
          <h3 className="text-xl font-bold mb-4 uppercase border-b-2 border-gray-300 pb-2">10 Menu Terlaris</h3>
          <table className="w-full text-left border-2 border-black border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-4 border-b-2 border-black font-bold uppercase text-sm w-12 text-center">No</th>
                <th className="p-4 border-b-2 border-black font-bold uppercase text-sm">Nama Menu</th>
                <th className="p-4 border-b-2 border-black font-bold uppercase text-sm text-center">Porsi Terjual</th>
                <th className="p-4 border-b-2 border-black font-bold uppercase text-sm text-right">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {sortedMenu.map((m: any, i: number) => (
                <tr key={m.menu} className={i % 2 !== 0 ? 'bg-gray-50' : ''}>
                  <td className="p-3 border-b border-gray-300 text-center font-bold text-gray-500">{i + 1}</td>
                  <td className="p-3 border-b border-gray-300 font-semibold">{m.menu}</td>
                  <td className="p-3 border-b border-gray-300 text-center font-bold text-lg">{m.qty.toLocaleString('id-ID')}</td>
                  <td className="p-3 border-b border-gray-300 text-right font-bold text-lg">{formatRp(m.omzet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-16 pt-6 border-t-2 border-gray-200 text-sm font-semibold text-gray-500 text-center">
        Dicetak pada {printTime} melalui Sistem POS Kasir Suka Shawarma
      </div>
    </div>
  )
}
