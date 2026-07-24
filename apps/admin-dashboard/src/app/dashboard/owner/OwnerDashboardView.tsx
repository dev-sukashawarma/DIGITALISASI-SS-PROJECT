'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'
import { PeriodFilter } from '@/components/PeriodFilter'
import { KpiCards } from '@/components/KpiCards'
import { SourceBreakdown } from '@/components/SourceBreakdown'
import { TopMenus } from '@/components/TopMenus'
import { BottomMenus } from '@/components/BottomMenus'
import { OutletLeaderboard } from '@/components/OutletLeaderboard'
import { DailyTargetBoard } from '@/components/DailyTargetBoard'
import { PageHeader } from '@/components/ui'
import type { PeriodFilterValue, Outlet, SalesSummaryRow } from '@/lib/types'
import type { SalesHourlyRow } from '@/hooks/useSalesHourly'
import type { AggregatedMenuSales } from '@/app/actions/menuSales'
import dynamic from 'next/dynamic'
import { useTransition } from 'react'

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
  leaderboard: any[]
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
  leaderboard
}: OwnerDashboardViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isOneDay = filter.from === filter.to

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
      {/* Normal Dashboard */}
      <div className="space-y-6 print:hidden animate-fade-in">
        <PageHeader title="Ringkasan Bisnis" description="Statistik penjualan riil dari sistem POS Kasir">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <PeriodFilter value={filter} onChange={handleFilterChange} outlets={outlets} lockedOutletId={lockedOutletId} hideSource />
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-4 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Cetak PDF
            </button>
          </div>
        </PageHeader>

        {isPending && (
          <div className="flex justify-center items-center py-10 bg-white/50 rounded-2xl animate-pulse border border-suka-orange/20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin"></div>
              <p className="text-suka-brown font-bold text-sm">Memuat data dashboard...</p>
            </div>
          </div>
        )}

        <div className={isPending ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <KpiCards
            rows={curKpiRows}
            prevRows={prevKpiRows}
            hourlyRows={hourlyRows}
          />
        </div>

        {/* Indikator target harian realtime (semua outlet) */}
        {role !== 'MITRA' && (
          <div className={isPending ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
            <DailyTargetBoard filter={filter} kpiRows={curKpiRows} />
          </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isPending ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}`}>
          <div className="lg:col-span-2 space-y-6">
            <RevenueTrendChart 
              rows={isOneDay ? hourlyRows : curKpiRows} 
              isHourly={isOneDay} 
            />
            <SourceBreakdown rows={curKpiRows} />
          </div>
          <div className="space-y-6">
            <TopMenus rows={menuRows} />
            <BottomMenus rows={menuRows} />
          </div>
        </div>
        {!isReadOnly && (
          <div className={isPending ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
            <OutletLeaderboard entries={leaderboard} allOutlets={outlets} />
          </div>
        )}
      </div>

      {/* Tampilan Khusus Cetak PDF */}
      <PrintReport 
        filter={filter} 
        outlets={outlets} 
        lockedOutletId={lockedOutletId} 
        cur={{ rows: curKpiRows }} 
        hourly={{ rows: hourlyRows }} 
        menu={{ rows: menuRows }} 
      />
    </>
  )
}

function PrintReport({ filter, outlets, lockedOutletId, cur, hourly, menu }: any) {
  const isAllOutlets = !lockedOutletId || outlets.length > 1
  const outletName = isAllOutlets ? 'Semua Outlet' : outlets[0]?.name

  const netRevenue = cur.rows.reduce((s: number, r: any) => s + r.omzet, 0)
  const totalDeductions = cur.rows.reduce((s: number, r: any) => s + (Number(r.total_deductions) || 0), 0)
  const omzet = netRevenue + totalDeductions
  const completed = cur.rows.reduce((s: number, r: any) => s + r.jumlah_order_completed, 0)
  const currentAov = completed > 0 ? Math.round(netRevenue / completed) : 0

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
                <tr key={m.menu || m.name} className={i % 2 !== 0 ? 'bg-gray-50' : ''}>
                  <td className="p-3 border-b border-gray-300 text-center font-bold text-gray-500">{i + 1}</td>
                  <td className="p-3 border-b border-gray-300 font-semibold">{m.menu || m.name}</td>
                  <td className="p-3 border-b border-gray-300 text-center font-bold text-lg">{m.qty.toLocaleString('id-ID')}</td>
                  <td className="p-3 border-b border-gray-300 text-right font-bold text-lg">{formatRp(m.revenue || m.omzet)}</td>
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
