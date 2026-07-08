'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  TrendingUp, TrendingDown, ShoppingBag, Banknote, Clock, Store, ChevronDown, Calendar, Globe, Monitor, Layers
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'
import dynamic from 'next/dynamic'
import type { Outlet } from '@/pos-types'
import BranchFilter from '@/components/BranchFilter'
import { toast } from 'sonner'

const OverviewAreaChart = dynamic(() => import('./OverviewAreaChart'), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full flex items-center justify-center bg-gray-50/50 rounded-xl animate-pulse">
      <p className="text-gray-400 text-sm font-medium">Memuat grafik...</p>
    </div>
  )
})
import {
  CHART_RANGES, PERIOD_SHORT, resolveRange, computeAnalytics,
  type ChartRange, type OrderRow
} from '@/lib/admin-analytics'

export default function AdminOverviewView({
  initialOutlets,
  initialOrders,
  initialChartDaily
}: {
  initialOutlets: Outlet[],
  initialOrders: OrderRow[],
  initialChartDaily: { sales_date: string; omzet: number }[]
}) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders)
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  // Chart specific states
  const [chartDaily, setChartDaily] = useState<{ sales_date: string; omzet: number }[]>(initialChartDaily)
  const [chartRange, setChartRange] = useState<ChartRange>('30days')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [isChartLoading, setIsChartLoading] = useState(false)
  const [showChartRangeDropdown, setShowChartRangeDropdown] = useState(false)

  const isInitialMount = useRef(true)

  const dateRange = useMemo(
    () => resolveRange(chartRange, customStartDate, customEndDate),
    [chartRange, customStartDate, customEndDate]
  )

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let q = supabase
      .from('orders')
      .select('id, status, total_amount, created_at, outlet_id, channel, sales_source')
      .eq('status', 'completed')
      .order('created_at', { ascending: true })

    const lowerBound = dateRange.prevStart ?? dateRange.start
    if (lowerBound) q = q.gte('created_at', lowerBound.toISOString())
    if (dateRange.end) q = q.lte('created_at', dateRange.end.toISOString())

    if (selectedOutlet !== 'all') {
      q = q.eq('outlet_id', selectedOutlet)
    }

    const { data } = await q
    setOrders(data ?? [])
    setLoading(false)
  }, [selectedOutlet, dateRange])

  const fetchChartOrders = useCallback(async () => {
    setIsChartLoading(true)
    const supabase = createClient()

    const fmt = (d: Date) => {
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${d.getFullYear()}-${m}-${day}`
    }

    let q = supabase
      .from('sales_hourly_spv')
      .select('sales_date, omzet')
      .order('sales_date', { ascending: true })

    if (selectedOutlet !== 'all') {
      q = q.eq('outlet_id', selectedOutlet)
    }

    if (chartRange === 'today') {
      q = q.eq('sales_date', fmt(new Date()))
    } else if (chartRange === 'yesterday') {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      q = q.eq('sales_date', fmt(d))
    } else if (chartRange === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      q = q.gte('sales_date', fmt(d))
    } else if (chartRange === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      q = q.gte('sales_date', fmt(d))
    } else if (chartRange === 'custom' && customStartDate && customEndDate) {
      q = q.gte('sales_date', customStartDate).lte('sales_date', customEndDate)
    }

    const { data } = await q

    setChartDaily(data ?? [])
    setIsChartLoading(false)
  }, [selectedOutlet, chartRange, customStartDate, customEndDate])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    if (isInitialMount.current) {
      // it's handled by the first useEffect's ref flag, but just to be safe
      return
    }
    fetchChartOrders()
  }, [fetchChartOrders])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('realtime_orders_overview')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new.status === 'cancelled' && payload.new.void_reason) {
            toast.error(`Pesanan dibatalkan: ${payload.new.void_reason}`)
          }
          fetchOrders()
          fetchChartOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchOrders, fetchChartOrders])

  const analytics = useMemo(
    () => computeAnalytics(orders, outlets, dateRange),
    [orders, outlets, dateRange]
  )

  const chartData = useMemo(() => {
    const dailyMap: Record<string, number> = {}
    chartDaily.forEach(r => {
      dailyMap[r.sales_date] = (dailyMap[r.sales_date] || 0) + Number(r.omzet)
    })
    
    const dataList = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        revenue,
        _rawDate: date
      }))

    if (dataList.length === 1) {
      const d = new Date(dataList[0]._rawDate)
      d.setDate(d.getDate() - 1)
      dataList.unshift({
        date: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        revenue: 0,
        _rawDate: ''
      })
    }
    
    return dataList
  }, [chartDaily])

  const selectedOutletName = selectedOutlet === 'all' 
    ? 'Semua Cabang' 
    : outlets.find(o => o.id === selectedOutlet)?.name || 'Cabang Tidak Ditemukan'

  const GrowthBadge = ({ value }: { value: number }) => {
    const isPositive = value > 0
    const isNeutral = value === 0
    const Icon = isPositive ? TrendingUp : (isNeutral ? TrendingUp : TrendingDown)
    const colorClassGray = isPositive ? 'text-emerald-600 bg-emerald-100' : (isNeutral ? 'text-gray-400 bg-gray-100' : 'text-red-600 bg-red-100')
    
    return (
      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${colorClassGray} absolute top-4 right-4`}>
        {isNeutral ? <span className="text-[10px] font-bold mr-0.5">-</span> : <Icon className="w-3 h-3" />}
        {isPositive ? '+' : ''}{value}%
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative z-40">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview Ringkas</h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
            Menampilkan data untuk: <strong className="text-gray-900">{selectedOutletName}</strong>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <BranchFilter 
            outlets={outlets} 
            selectedOutlet={selectedOutlet} 
            onChange={setSelectedOutlet} 
            className="w-full sm:w-64"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
            {chartRange === 'custom' && (
              <div className="flex flex-col sm:flex-row items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-200">
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full sm:w-auto text-sm outline-none text-gray-700 bg-transparent"
                />
                <span className="hidden sm:inline text-gray-400 text-sm">-</span>
                <span className="sm:hidden text-gray-400 text-xs">sampai</span>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full sm:w-auto text-sm outline-none text-gray-700 bg-transparent"
                />
              </div>
            )}
            
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setShowChartRangeDropdown(!showChartRangeDropdown)}
                className="w-full sm:w-auto flex items-center justify-between bg-white border border-gray-200 hover:border-amber-400 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 transition-all shadow-sm outline-none whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>{CHART_RANGES[chartRange]}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 ml-2 transition-transform ${showChartRangeDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showChartRangeDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowChartRangeDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-40 w-full sm:w-48 animate-fade-in">
                    {(Object.keys(CHART_RANGES) as ChartRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => { setChartRange(r); setShowChartRangeDropdown(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                          ${chartRange === r ? 'bg-amber-50 text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}
                      >
                        {CHART_RANGES[r]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
          {/* ── KPI Cards (Today) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5 bg-gradient-to-br from-amber-400 to-amber-600 text-white relative overflow-hidden shadow-amber-500/30 shadow-lg border-0">
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
              <div className="relative">
                <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-sm">
                  <Banknote className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
                </div>
                {analytics.hasComparison && (
                  <div className="absolute top-0 right-0">
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${analytics.revenueGrowth > 0 ? 'text-emerald-100 bg-emerald-500/40' : (analytics.revenueGrowth === 0 ? 'text-white/50 bg-white/10' : 'text-red-100 bg-red-500/40')}`}>
                      {analytics.revenueGrowth > 0 ? <TrendingUp className="w-3 h-3"/> : (analytics.revenueGrowth === 0 ? <span className="font-bold">-</span> : <TrendingDown className="w-3 h-3"/>)}
                      {analytics.revenueGrowth > 0 ? '+' : ''}{analytics.revenueGrowth}%
                    </div>
                  </div>
                )}
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Pendapatan {PERIOD_SHORT[chartRange]}</p>
                <p className="text-2xl font-bold mt-0.5 leading-tight">{formatRupiah(analytics.todayRevenue)}</p>
                {analytics.hasComparison && (
                  <p className="text-[10px] text-white/60 mt-1 font-medium">Periode lalu: {formatRupiah(analytics.prevRevenue)}</p>
                )}
              </div>
            </div>

            <div className="card p-5 shadow-sm border border-gray-100 relative">
              {analytics.hasComparison && <GrowthBadge value={analytics.ordersGrowth} />}
              <div className="w-9 h-9 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                <ShoppingBag className="w-4.5 h-4.5 text-blue-500" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pesanan {PERIOD_SHORT[chartRange]}</p>
              <p className="text-3xl font-bold text-gray-900 mt-0.5">{analytics.totalOrdersCount}</p>
            </div>

            <div className="card p-5 shadow-sm border border-gray-100">
              <div className="w-9 h-9 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-500" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rata-rata Pesanan</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{formatRupiah(analytics.avgOrderValue)}</p>
            </div>

            <div className="card p-5 shadow-sm border border-gray-100">
              <div className="w-9 h-9 bg-purple-50 rounded-2xl flex items-center justify-center mb-3">
                <Clock className="w-4.5 h-4.5 text-purple-500" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jam Tersibuk</p>
              <p className="text-3xl font-bold text-gray-900 mt-0.5">
                {analytics.totalOrdersCount > 0 ? `${String(analytics.peakHour).padStart(2, '0')}:00` : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-6 shadow-sm border border-gray-100 lg:col-span-2">
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 text-lg">Tren Pendapatan Interaktif</h2>
                <p className="text-gray-400 text-xs mt-0.5">Pendapatan harian outlet terpilih</p>
              </div>

              {isChartLoading ? (
                <div className="h-72 w-full flex items-center justify-center bg-gray-50/50 rounded-xl animate-pulse">
                   <p className="text-gray-400 text-sm font-medium">Memuat grafik...</p>
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
                  Belum ada data untuk ditampilkan
                </div>
              ) : (
                <OverviewAreaChart chartData={chartData} />
              )}
            </div>

            <div className="card p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Store className="w-5 h-5 text-indigo-500" />
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">Top 5 Cabang</h2>
                  <p className="text-gray-400 text-xs">Performa {PERIOD_SHORT[chartRange]}</p>
                </div>
              </div>

              {analytics.leaderboard.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                  Belum ada transaksi pada periode ini
                </div>
              ) : (
                <div className="space-y-4">
                  {analytics.leaderboard.map((branch, idx) => {
                    const maxRev = analytics.leaderboard[0].revenue
                    const pct = (branch.revenue / maxRev) * 100
                    const isTop3 = idx < 3

                    return (
                      <div key={idx} className="relative py-1.5">
                        <div className="flex justify-between items-center mb-1.5 gap-3">
                          <div className="flex items-center gap-2.5 flex-1">
                            <div className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black shrink-0 ${isTop3 ? 'text-orange-500 bg-orange-50' : 'text-gray-400 bg-gray-50'}`}>
                              {idx + 1}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                              <span className="text-sm font-bold text-gray-800 leading-tight">
                                {branch.name}
                              </span>
                              {isTop3 && (
                                <span className="animate-pulse text-xs shrink-0 drop-shadow-sm" title="Hot Performer">
                                  🔥
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <span className="text-sm font-black text-gray-900 shrink-0">
                            {formatRupiah(branch.revenue)}
                          </span>
                        </div>
                        
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              isTop3 ? 'bg-gradient-to-r from-orange-500 to-amber-400 relative' : 'bg-gray-300'
                            }`}
                            style={{ width: `${pct}%` }}
                          >
                             {isTop3 && (
                               <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
                             )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {selectedOutlet !== 'all' && (
                    <div className="mt-4 bg-indigo-50 text-indigo-700 text-xs p-3 rounded-xl border border-indigo-100 text-center font-medium">
                      Hanya menampilkan cabang terpilih. Pilih &ldquo;Semua Cabang&rdquo; untuk perbandingan.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-gray-900 text-lg">Kontribusi Saluran Penjualan</h2>
            </div>
            <p className="text-gray-400 text-xs mb-5">Sumber transaksi: Website Online, channel eksternal & POS Kasir</p>

            {analytics.sourceBreakdown.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
                Belum ada transaksi pada periode ini
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.sourceBreakdown.map((src) => (
                  <div key={src.key} className="space-y-1.5 group">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 font-bold text-gray-800">
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${src.bg}1a` }}
                        >
                          {src.logoPath ? (
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" style={{ fill: src.bg }}>
                              <path d={src.logoPath} />
                            </svg>
                          ) : src.lucide === 'globe' ? (
                            <Globe className="w-3.5 h-3.5" style={{ color: src.bg }} />
                          ) : (
                            <Monitor className="w-3.5 h-3.5" style={{ color: src.bg }} />
                          )}
                        </span>
                        <span>{src.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium">
                          {formatRupiah(src.revenue)}{' '}
                          <span className="text-[10px] text-gray-400 font-normal">({src.orders} order)</span>
                        </span>
                        <span className="font-extrabold text-xs" style={{ color: src.bg }}>{src.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${src.percentage}%`, backgroundColor: src.bg }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
