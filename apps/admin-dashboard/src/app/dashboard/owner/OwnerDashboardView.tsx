// @ts-nocheck
'use client'

import { useEffect, useRef, useTransition } from 'react'
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
import { Printer } from 'lucide-react'
import dynamic from 'next/dynamic'

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
  leaderboard,
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

      {/* Normal Dashboard Screen */}
      <div className="space-y-6 print:hidden animate-fade-in">
        {/* Header Dashboard */}
        <PageHeader title="Ringkasan Bisnis" description="Statistik penjualan riil dari sistem POS Kasir">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <PeriodFilter value={filter} onChange={handleFilterChange} outlets={outlets} lockedOutletId={lockedOutletId} hideSource />
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-4 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Printer size={15} /> Cetak PDF
            </button>
          </div>
        </PageHeader>

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
            rows={curKpiRows}
            prevRows={prevKpiRows}
            hourlyRows={hourlyRows}
          />

          {/* Indikator target harian realtime */}
          {role !== 'MITRA' && (
            <DailyTargetBoard filter={filter} kpiRows={curKpiRows} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            <OutletLeaderboard entries={leaderboard} allOutlets={outlets} />
          )}
        </div>
      </div>

      {/* Print View PDF Report */}
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

  const formatRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const printTime = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="hidden print:block text-black bg-white w-full py-8">
      <div className="border-b-4 border-black pb-4 mb-8">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-center">
          Laporan Ringkasan Bisnis
        </h1>
        <h2 className="text-xl font-bold mt-2 text-gray-700 text-center uppercase tracking-widest">Suka Shawarma</h2>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8 text-base">
        <div>
          <p className="text-gray-500 font-bold uppercase text-xs">Periode Laporan</p>
          <p className="font-semibold text-lg mt-1">{formatDate(filter.from)} - {formatDate(filter.to)}</p>
        </div>
        <div>
          <p className="text-gray-500 font-bold uppercase text-xs">Outlet Terpilih</p>
          <p className="font-semibold text-lg mt-1">{outletName}</p>
        </div>
      </div>

      <h3 className="text-lg font-bold mb-3 uppercase border-b-2 border-gray-300 pb-1">KPI Ringkasan Bisnis</h3>
      <table className="w-full text-left mb-8 border-2 border-black border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 border-b-2 border-black font-bold uppercase w-1/2">Metrik</th>
            <th className="p-3 border-b-2 border-black font-bold uppercase text-right">Nilai</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 border-b border-gray-300 font-medium">Total Omzet Penjualan</td>
            <td className="p-3 border-b border-gray-300 text-right font-extrabold text-xl">{formatRp(omzet)}</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="p-3 border-b border-gray-300 font-medium">Total Transaksi Selesai</td>
            <td className="p-3 border-b border-gray-300 text-right font-extrabold text-xl">{completed.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td className="p-3 border-b border-gray-300 font-medium">Rata-rata Nilai Belanja (AOV)</td>
            <td className="p-3 border-b border-gray-300 text-right font-extrabold text-xl">{formatRp(currentAov)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-12 pt-4 border-t-2 border-gray-300 text-xs font-semibold text-gray-500 text-center">
        Dicetak pada {printTime} melalui Sistem Dashboard Owner Suka Shawarma
      </div>
    </div>
  )
}

