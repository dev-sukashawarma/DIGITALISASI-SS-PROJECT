'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingBag, Banknote,
  Calendar, ChevronDown, Award, Clock, CreditCard, QrCode,
  Package, ArrowUpRight, ArrowDownRight, Minus, FileText, Download, Printer, Search, CheckCircle2, XCircle, Wallet
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { cleanItemName } from '@/lib/order-item-name'
import { formatRupiah } from '@/lib/validations'
import ChannelBadge from '@/components/ChannelBadge'

interface ShiftRow {
  id: string
  start_time: string
  end_time: string | null
  status: string
  starting_cash: number
  expected_ending_cash: number
  actual_ending_cash: number
  variance: number
  expected_ending_petty_cash: number
  actual_ending_petty_cash: number
  petty_cash_variance: number
}

interface OrderRow {
  id: string
  order_number: number
  status: string
  payment_method: string | null
  channel: string | null
  total_amount: number
  created_at: string
  order_items: {
    id: string
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[]
}

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'

const RANGE_LABELS: Record<DateRange, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  all: 'Semua Waktu',
  custom: 'Kustom Tanggal',
}

async function fetchReportOrders(outletId: string, range: DateRange, customStart: string, customEnd: string): Promise<OrderRow[]> {
  const supabase = createClient()

  let q = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (range === 'today') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    q = q.gte('created_at', today.toISOString())
  } else if (range === 'yesterday') {
    const yest = new Date()
    yest.setDate(yest.getDate() - 1)
    yest.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    q = q.gte('created_at', yest.toISOString()).lt('created_at', today.toISOString())
  } else if (range === '7days') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    q = q.gte('created_at', d.toISOString())
  } else if (range === '30days') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    q = q.gte('created_at', d.toISOString())
  } else if (range === 'custom' && customStart && customEnd) {
    const s = new Date(customStart)
    s.setHours(0, 0, 0, 0)
    const e = new Date(customEnd)
    e.setHours(23, 59, 59, 999)
    q = q.gte('created_at', s.toISOString()).lte('created_at', e.toISOString())
  }

  const { data } = await q
  return data ?? []
}

async function fetchReportShifts(outletId: string, range: DateRange, customStart: string, customEnd: string): Promise<ShiftRow[]> {
  const supabase = createClient()

  let q = supabase
    .from('shifts')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('status', 'closed')
    .order('end_time', { ascending: false })

  if (range === 'today') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    q = q.gte('end_time', today.toISOString())
  } else if (range === 'yesterday') {
    const yest = new Date()
    yest.setDate(yest.getDate() - 1)
    yest.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    q = q.gte('end_time', yest.toISOString()).lt('end_time', today.toISOString())
  } else if (range === '7days') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    q = q.gte('end_time', d.toISOString())
  } else if (range === '30days') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    q = q.gte('end_time', d.toISOString())
  } else if (range === 'custom' && customStart && customEnd) {
    const s = new Date(customStart)
    s.setHours(0, 0, 0, 0)
    const e = new Date(customEnd)
    e.setHours(23, 59, 59, 999)
    q = q.gte('end_time', s.toISOString()).lte('end_time', e.toISOString())
  }

  const { data } = await q
  return data ?? []
}

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>('today')
  const [showRangePicker, setShowRangePicker] = useState(false)

  // Custom Date
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Outlet Data (outletName sudah di-cache di useMyOutlet, tidak perlu query terpisah lagi)
  const { outletId, outletName: rawOutletName } = useMyOutlet()
  const outletName = rawOutletName || 'Memuat...'

  // Table State
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Banner setelah tutup shift (redirect dari halaman Kas & Shift dengan ?shift=closed)
  const [justClosedShift, setJustClosedShift] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('shift') === 'closed') {
      setJustClosedShift(true)
      // Bersihkan query agar refresh tidak memunculkan banner lagi
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const isCustomReady = range !== 'custom' || (!!customStart && !!customEnd)

  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey: ['reports', outletId, range, customStart, customEnd],
    queryFn: () => fetchReportOrders(outletId as string, range, customStart, customEnd),
    enabled: !!outletId && isCustomReady,
    staleTime: 30000,
    retry: false,
  })

  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ['reportShifts', outletId, range, customStart, customEnd],
    queryFn: () => fetchReportShifts(outletId as string, range, customStart, customEnd),
    enabled: !!outletId && isCustomReady,
    staleTime: 30000,
    retry: false,
  })

  // Setelah tutup shift, gulir otomatis ke laporan rekonsiliasi laci
  useEffect(() => {
    if (justClosedShift && !loadingShifts && shifts.length > 0) {
      const t = setTimeout(() => {
        document.getElementById('laporan-laci-cash')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
      return () => clearTimeout(t)
    }
  }, [justClosedShift, loadingShifts, shifts.length])

  // ─── Derived Analytics ───
  const analytics = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'completed')
    const canceledOrders = orders.filter(o => o.status === 'cancelled' || o.status === 'expired')
    const pendingCount = orders.filter(o => o.status === 'pending').length

    let totalRevenue = completedOrders.reduce((s, o) => s + o.total_amount, 0)
    const totalOrders = completedOrders.length
    
    // Hitung total selisih laci (variance) dari tutup shift
    const totalCashVariance = shifts.reduce((s, shift) => s + (shift.variance || 0), 0)

    // Payment method breakdown
    const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
    completedOrders.forEach(o => {
      const method = o.payment_method || 'unknown'
      if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, revenue: 0 }
      paymentBreakdown[method].count++
      paymentBreakdown[method].revenue += o.total_amount
    })

    // Koreksi pendapatan tunai dengan selisih fisik laci (Opsi B: Source of truth = Fisik Kasir)
    if (paymentBreakdown['cash']) {
      paymentBreakdown['cash'].revenue += totalCashVariance
    }
    
    // Sesuaikan juga Total Pendapatan
    totalRevenue += totalCashVariance

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

    // Category breakdown
    let totalMain = 0
    let totalExtras = 0
    completedOrders.forEach(o => {
      o.order_items.forEach(oi => {
        const lowerName = oi.menu_item_name.toLowerCase()
        const isExtra = lowerName.includes('ekstra') || lowerName.includes('topping') || lowerName.includes('keju') || lowerName.includes('daging') || lowerName.includes('pedas')
        if (isExtra) {
          totalExtras += oi.quantity
        } else {
          totalMain += oi.quantity
        }
      })
    })

    const categoryData = []
    if (totalMain > 0) categoryData.push({ name: 'Menu Utama', value: totalMain, color: '#f59e0b' }) // amber-500
    if (totalExtras > 0) categoryData.push({ name: 'Ekstra / Topping', value: totalExtras, color: '#10b981' }) // emerald-500

    // Best sellers
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    completedOrders.forEach(o => {
      o.order_items.forEach(oi => {
        const key = cleanItemName(oi.menu_item_name)
        if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 }
        itemMap[key].qty += oi.quantity
        itemMap[key].revenue += oi.subtotal
      })
    })
    const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty)

    // Hourly distribution (0-23)
    const hourly = Array(24).fill(0)
    completedOrders.forEach(o => {
      const hour = new Date(o.created_at).getHours()
      hourly[hour]++
    })
    const peakHour = hourly.indexOf(Math.max(...hourly))

    // Daily revenue (for trend chart)
    const dailyMap: Record<string, number> = {}
    completedOrders.forEach(o => {
      const dateKey = new Date(o.created_at).toISOString().split('T')[0]
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + o.total_amount
    })
    const dailyEntries = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]))

    return {
      completedOrders,
      canceledOrders,
      pendingCount,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      paymentBreakdown,
      categoryData,
      bestSellers,
      hourly,
      peakHour,
      dailyEntries,
    }
  }, [orders])

  const maxHourly = Math.max(...analytics.hourly, 1)
  const maxDaily = analytics.dailyEntries.length > 0
    ? Math.max(...analytics.dailyEntries.map(e => e[1]), 1)
    : 1

  const PAYMENT_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    cash: { label: 'Tunai', color: '#10b981', bg: 'bg-emerald-50', icon: Banknote },
    qris: { label: 'QRIS', color: '#3b82f6', bg: 'bg-blue-50', icon: QrCode },
    card: { label: 'Kartu', color: '#8b5cf6', bg: 'bg-purple-50', icon: CreditCard },
    unknown: { label: 'Lainnya', color: '#6b7280', bg: 'bg-gray-50', icon: Package },
  }

  const successRate = analytics.totalOrders + analytics.canceledOrders.length > 0 
    ? Math.round((analytics.totalOrders / (analytics.totalOrders + analytics.canceledOrders.length)) * 100)
    : 0
  const failureRate = 100 - successRate

  // Pagination for table
  const filteredTableData = useMemo(() => {
    return analytics.completedOrders.filter(o => {
      const searchStr = searchQuery.toLowerCase()
      const matchesId = String(o.order_number).includes(searchStr)
      const matchesItem = o.order_items.some(i => i.menu_item_name.toLowerCase().includes(searchStr))
      return matchesId || matchesItem
    })
  }, [analytics.completedOrders, searchQuery])

  const totalPages = Math.ceil(filteredTableData.length / itemsPerPage)
  const paginatedData = filteredTableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)


  const downloadPDF = () => {
    window.print()
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in" id="report-content">

      {/* ── Banner sukses tutup shift ── */}
      {justClosedShift && (
        <div className="no-print p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Shift berhasil ditutup!</p>
            <p className="text-sm text-emerald-700 mt-0.5">
              Hasil hitung uang shift Anda ada di bagian <b>Laporan Laci Cash</b> di bawah. Halaman akan gulir otomatis ke sana.
            </p>
          </div>
        </div>
      )}

      {/* ── Header Web (Hidden on Print) ── */}
      <div className="no-print flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-amber-500" />
            Laporan & Analitik Cabang
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Insight bisnis Anda secara real-time</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          {/* Custom Date Picker (if selected) */}
          {range === 'custom' && (
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 w-full sm:w-auto order-last sm:order-first">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full sm:w-auto bg-transparent text-sm font-medium text-gray-700 outline-none"
              />
              <span className="hidden sm:inline text-gray-400 text-sm">-</span>
              <span className="sm:hidden text-gray-400 text-xs">sampai</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full sm:w-auto bg-transparent text-sm font-medium text-gray-700 outline-none"
              />
            </div>
          )}

          {/* Date range picker */}
          <div className="relative">
            <button
              onClick={() => setShowRangePicker(!showRangePicker)}
              className="flex items-center justify-between min-w-[160px] gap-2 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                {RANGE_LABELS[range]}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showRangePicker ? 'rotate-180' : ''}`} />
            </button>

            {showRangePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRangePicker(false)} />
                <div className="absolute left-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 w-48 animate-fade-in">
                  {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => { setRange(r); setShowRangePicker(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                        ${range === r ? 'bg-amber-50 text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {RANGE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Header Print (Only Visible on Print) ── */}
      <div className="hidden print:flex bg-white py-4 mb-6 border-b-2 border-gray-900 items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-amber-500" />
            Laporan Analitik Performa
          </h1>
          <p className="text-gray-900 text-sm mt-2 font-bold">Generated by Kiosk POS Kasir</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-1">Informasi Laporan</p>
          <p className="text-base font-bold text-gray-900">Cabang: <span className="text-gray-900">{outletName}</span></p>
          <p className="text-sm font-bold text-gray-900">Periode: {RANGE_LABELS[range]}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          {[1,2,3,4].map(i => <div key={i} className="card h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
          {/* ── KPI Cards (Kasir specific + combined) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="card p-5 bg-amber-500 text-white col-span-2 md:col-span-1 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
              <div className="relative">
                <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                  <Banknote className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Total Pendapatan</p>
                <p className="text-xl font-bold mt-0.5 leading-tight">{formatRupiah(analytics.totalRevenue)}</p>
              </div>
            </div>

            {/* Total Orders */}
            <div className="card p-5">
              <div className="w-9 h-9 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                <ShoppingBag className="w-4.5 h-4.5 text-blue-500" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Pesanan Sukses</p>
              <p className="text-3xl font-bold text-gray-900 mt-0.5">{analytics.totalOrders}</p>
            </div>

            {/* Average Order */}
            <div className="card p-5">
              <div className="w-9 h-9 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-500" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rata-rata / Pesanan</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{formatRupiah(analytics.avgOrderValue)}</p>
            </div>

            {/* Peak Hour */}
            <div className="card p-5">
              <div className="w-9 h-9 bg-purple-50 rounded-2xl flex items-center justify-center mb-3">
                <Clock className="w-4.5 h-4.5 text-purple-500" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jam Tersibuk</p>
              <p className="text-3xl font-bold text-gray-900 mt-0.5">
                {analytics.totalOrders > 0 ? `${String(analytics.peakHour).padStart(2, '0')}:00` : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ── Status Transaksi (Admin feature) ── */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Status Transaksi</h2>
              <p className="text-gray-400 print-dark-text text-xs mb-5">Pesanan Lunas vs Batal</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Selesai</p>
                      <p className="text-[10px] font-medium text-emerald-600">Pembayaran sukses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-700">{analytics.totalOrders}</p>
                    <p className="text-[10px] font-bold text-emerald-500">{successRate}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-900">Dibatalkan</p>
                      <p className="text-[10px] font-medium text-red-600">Kadaluarsa / Batal Kasir</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-red-700">{analytics.canceledOrders.length}</p>
                    <p className="text-[10px] font-bold text-red-500">{failureRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Payment Method Breakdown ── */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Distribusi Pembayaran</h2>
              <p className="text-gray-400 print-dark-text text-xs mb-5">Rincian per metode bayar</p>

              {Object.keys(analytics.paymentBreakdown).length === 0 ? (
                <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                  Belum ada data
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(analytics.paymentBreakdown)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([method, data]) => {
                      const meta = PAYMENT_META[method] || PAYMENT_META.unknown
                      const Icon = meta.icon
                      const pct = analytics.totalOrders > 0 ? Math.round((data.count / analytics.totalOrders) * 100) : 0
                      return (
                        <div key={method}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 ${meta.bg} rounded-xl flex items-center justify-center`}>
                                <Icon className="w-4 h-4" style={{ color: meta.color }} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-800 print-dark-text">{meta.label}</p>
                                <p className="text-[10px] text-gray-400 print-dark-text">{data.count} pesanan</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">{pct}%</p>
                              <p className="text-[10px] text-gray-400 print-dark-text">{formatRupiah(data.revenue)}</p>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: meta.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* ── Category Breakdown (Admin feature) ── */}
            <div className="card p-6 shadow-sm border border-gray-100 flex flex-col">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Kategori Produk</h2>
              <p className="text-gray-400 print-dark-text text-xs mb-4">Proporsi item terjual</p>

              {analytics.categoryData.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-gray-400 print-dark-text text-sm">
                  Belum ada data
                </div>
              ) : (
                <div className="flex flex-col h-full justify-center">
                  <div className="h-32 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analytics.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => [`${value} item`, 'Terjual']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 px-2">
                    {analytics.categoryData.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
                          <span className="text-sm font-bold text-gray-700 print-dark-text">{entry.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{entry.value} item</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Kasir specific charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend Chart */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">Tren Pendapatan</h2>
                  <p className="text-gray-400 print-dark-text text-xs mt-0.5">Pendapatan harian dalam periode</p>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-500 text-sm font-semibold bg-emerald-50 px-3 py-1.5 rounded-full">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {analytics.dailyEntries.length} hari
                </div>
              </div>

              {analytics.dailyEntries.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 print-dark-text text-sm">
                  Belum ada data untuk ditampilkan
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end justify-center gap-2 h-48">
                    {analytics.dailyEntries.map(([date, rev]) => {
                      const pct = (rev / maxDaily) * 100
                      const dayLabel = new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      return (
                        <div key={date} className="flex-1 flex flex-col justify-end items-center gap-1 h-full group relative min-w-[30px] max-w-[60px]">
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg no-print">
                            {dayLabel}: {formatRupiah(rev)}
                          </div>
                          <div
                            className="w-full rounded-t-lg bg-gradient-to-t from-amber-400 to-amber-300 hover:from-amber-500 transition-all cursor-pointer min-h-[4px]"
                            style={{ height: `${Math.max(pct, 3)}%` }}
                          />
                          <span className="text-[10px] text-gray-400 print-dark-text font-medium truncate w-full text-center leading-tight">
                            {analytics.dailyEntries.length <= 14 ? dayLabel : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Hourly Distribution */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-5 h-5 text-purple-500" />
                <h2 className="font-bold text-gray-900 text-lg">Distribusi Per Jam</h2>
              </div>

              <div className="flex items-end gap-[3px] h-40">
                {analytics.hourly.map((count, hour) => {
                  const pct = (count / maxHourly) * 100
                  const isActive = hour >= 8 && hour <= 22
                  const isPeak = hour === analytics.peakHour && count > 0
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-semibold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 no-print">
                        {String(hour).padStart(2, '0')}:00 — {count} pesanan
                      </div>
                      <div
                        className={`w-full rounded-t-md transition-all cursor-pointer min-h-[2px]
                          ${isPeak
                            ? 'bg-gradient-to-t from-purple-500 to-purple-400 print:from-purple-800 print:to-purple-700'
                            : isActive
                              ? 'bg-gradient-to-t from-purple-300 to-purple-200 hover:from-purple-400 print:from-purple-500 print:to-purple-400'
                              : 'bg-gray-200 hover:bg-gray-300 print:bg-gray-400'}`}
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-[3px] mt-1">
                {analytics.hourly.map((_, hour) => (
                  <div key={hour} className="flex-1 text-center">
                    <span className="text-[7px] text-gray-400 print-dark-text font-medium">
                      {hour % 3 === 0 ? `${String(hour).padStart(2, '0')}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* ── Best Sellers ── */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Award className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-gray-900 text-lg">Top 10 Produk Terlaris</h2>
              </div>

              {analytics.bestSellers.length === 0 ? (
                <div className="py-8 text-center text-gray-400 print-dark-text text-sm">Belum ada data penjualan</div>
              ) : (
                <div className="space-y-3">
                  {analytics.bestSellers.slice(0, 10).map((item, idx) => {
                    const maxQty = analytics.bestSellers[0].qty
                    const pct = (item.qty / maxQty) * 100
                    const medals = ['🥇', '🥈', '🥉']
                    return (
                      <div key={item.name} className="group">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="w-6 text-center text-sm">
                            {idx < 3 ? medals[idx] : <span className="text-gray-400 print-dark-text font-bold text-xs">#{idx + 1}</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-800 print-dark-text truncate">{item.name}</p>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                <span className="text-xs text-gray-500 print-dark-text font-medium">{item.qty} terjual</span>
                                <span className="text-xs font-bold text-gray-900">{formatRupiah(item.revenue)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 no-print">

            <button
              onClick={downloadPDF}
              disabled={analytics.completedOrders.length === 0}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-5 h-5" />
              <span>Cetak / Download PDF Eksekutif</span>
            </button>
          </div>
          
          {/* Advanced Data Table Transaksi */}
          <div className="card p-6 shadow-sm border border-gray-100 mt-6 overflow-hidden no-print">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Histori Transaksi Detail</h2>
                <p className="text-gray-400 text-xs mt-0.5">Semua transaksi sukses pada periode ini</p>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm font-medium"
                    placeholder="Cari no antrian / item..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4">No. Antrian</th>
                    <th className="px-5 py-4">Waktu</th>
                    <th className="px-5 py-4">Nama Item</th>
                    <th className="px-5 py-4">Channel</th>
                    <th className="px-5 py-4">Metode Bayar</th>
                    <th className="px-5 py-4 text-right">Total Transaksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-gray-400 font-medium">Data tidak ditemukan</td>
                    </tr>
                  ) : (
                    paginatedData.map((order) => (
                      <tr key={order.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md">#{order.order_number}</span>
                        </td>
                        <td className="px-5 py-4 text-gray-500 font-medium text-xs">
                          {new Date(order.created_at).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-5 py-4 text-gray-600 truncate max-w-[250px] font-medium" title={order.order_items.map(i => cleanItemName(i.menu_item_name)).join(', ')}>
                          {order.order_items.map(i => cleanItemName(i.menu_item_name)).join(', ')}
                        </td>
                        <td className="px-5 py-4">
                          {order.channel ? (
                            <ChannelBadge channel={order.channel} size="sm" />
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold rounded-lg uppercase">
                            {order.payment_method || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-gray-900 text-base">{formatRupiah(order.total_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs font-medium text-gray-400">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredTableData.length)} dari {filteredTableData.length}
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Sebelumnya
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Laporan Tutup Shift */}
          <div id="laporan-laci-cash" className="card p-6 shadow-sm border border-gray-100 mt-6 overflow-hidden no-print scroll-mt-6">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Laporan Laci Cash</h2>
              <p className="text-gray-400 text-xs mt-0.5 mb-6">Perbandingan uang menurut sistem vs hasil hitung manual kasir saat tutup shift</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loadingShifts ? (
                <div className="col-span-full p-10 text-center bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-gray-400 font-medium">Memuat data shift...</p>
                </div>
              ) : shifts.length === 0 ? (
                <div className="col-span-full p-10 text-center bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-gray-400 font-medium">Data shift tidak ditemukan</p>
                </div>
              ) : (
                shifts.map((shift) => {
                  const dateStr = new Date(shift.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  const startTimeStr = new Date(shift.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  const endTimeStr = shift.end_time ? new Date(shift.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Berjalan';
                  
                  const variance = shift.variance || 0;
                  const pcVariance = shift.petty_cash_variance || 0;
                  const totalDiff = variance + pcVariance;

                  return (
                    <div key={shift.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                      {/* Header Kartu */}
                      <div className="bg-amber-50 px-5 py-4 border-b border-amber-100 flex items-center gap-4">
                        <div className="bg-amber-100 p-2.5 rounded-lg text-amber-700">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-amber-900 text-sm mb-0.5">Shift {dateStr}</h3>
                          <p className="text-xs font-medium text-amber-700/80">{startTimeStr} - {endTimeStr}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                          totalDiff === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          totalDiff > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {totalDiff === 0 ? '✅ Uang Pas' :
                           totalDiff > 0 ? `Uang Lebih ${formatRupiah(totalDiff)}` :
                           `Uang Kurang ${formatRupiah(Math.abs(totalDiff))}`}
                        </span>
                      </div>
                      
                      {/* Body Kartu */}
                      <div className="p-5 flex-1 flex flex-col gap-4">
                        {/* Box Uang Laci */}
                        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100 flex-1">
                          <div className="flex items-center gap-2 mb-4">
                            <Wallet className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-gray-700 text-xs tracking-wider uppercase">Uang Laci (Sales)</span>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-500">Hitungan Manual Kasir</span>
                              <span className="font-extrabold text-gray-900 text-base">{formatRupiah(shift.actual_ending_cash)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-400">Perhitungan Sistem</span>
                              <span className="text-xs font-semibold text-gray-500">{formatRupiah(shift.expected_ending_cash)}</span>
                            </div>
                          </div>
                          
                          <div className="pt-3 mt-4 border-t border-gray-200/60 flex justify-between items-center">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status Uang Laci</span>
                            <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${
                              variance > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                              variance < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 
                              'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {variance > 0 ? `Lebih ${formatRupiah(variance)}` : 
                               variance < 0 ? `Kurang ${formatRupiah(Math.abs(variance))}` : 
                               'Pas (Balance)'}
                            </span>
                          </div>
                        </div>

                        {/* Box Petty Cash */}
                        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100 flex-1">
                          <div className="flex items-center gap-2 mb-4">
                            <Banknote className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-gray-700 text-xs tracking-wider uppercase">Dana Operasional</span>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-500">Hitungan Manual Kasir</span>
                              <span className="font-extrabold text-blue-700 text-base">{formatRupiah(shift.actual_ending_petty_cash || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-400">Perhitungan Sistem</span>
                              <span className="text-xs font-semibold text-gray-500">{formatRupiah(shift.expected_ending_petty_cash || 0)}</span>
                            </div>
                          </div>
                          
                          <div className="pt-3 mt-4 border-t border-gray-200/60 flex justify-between items-center">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status Operasional</span>
                            <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${
                              pcVariance > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                              pcVariance < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 
                              'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {pcVariance > 0 ? `Lebih ${formatRupiah(pcVariance)}` : 
                               pcVariance < 0 ? `Kurang ${formatRupiah(Math.abs(pcVariance))}` : 
                               'Pas (Balance)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
