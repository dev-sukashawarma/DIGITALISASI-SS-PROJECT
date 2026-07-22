'use client'

import { useState, useMemo, useEffect, useDeferredValue } from 'react'
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
import { db } from '@/lib/db'
import { fetchWithTimeout } from '@/lib/offline-utils'

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

async function fetchOutletAnalytics(
  outletId: string,
  range: DateRange,
  customStart: string,
  customEnd: string,
  channelFilter: string = 'all',
  paymentFilter: string = 'all',
  statusFilter: string = 'all'
): Promise<any> {
  try {
    const supabase = createClient()

    let p_start = new Date()
    let p_end = new Date()

    if (range === 'today') {
      p_start.setHours(0, 0, 0, 0)
    } else if (range === 'yesterday') {
      p_start.setDate(p_start.getDate() - 1)
      p_start.setHours(0, 0, 0, 0)
      p_end.setHours(0, 0, 0, 0)
    } else if (range === '7days') {
      p_start.setDate(p_start.getDate() - 7)
      p_start.setHours(0, 0, 0, 0)
    } else if (range === '30days') {
      p_start.setDate(p_start.getDate() - 30)
      p_start.setHours(0, 0, 0, 0)
    } else if (range === 'all') {
      p_start = new Date(0)
    } else if (range === 'custom' && customStart && customEnd) {
      p_start = new Date(customStart)
      p_start.setHours(0, 0, 0, 0)
      p_end = new Date(customEnd)
      p_end.setHours(23, 59, 59, 999)
    }

    let ordersQuery = supabase
      .from('orders')
      .select('id, status, payment_method, channel, sales_source, total_amount, discount_amount, promo_subsidy, created_at, order_items(id, menu_item_name, quantity, subtotal)')
      .eq('outlet_id', outletId)
      .gte('created_at', p_start.toISOString())
      .lte('created_at', p_end.toISOString())

    if (statusFilter !== 'all') {
      ordersQuery = ordersQuery.eq('status', statusFilter)
    }
    if (paymentFilter !== 'all') {
      ordersQuery = ordersQuery.eq('payment_method', paymentFilter)
    }
    if (channelFilter !== 'all') {
      if (channelFilter === 'offline') {
        ordersQuery = ordersQuery.is('channel', null)
      } else if (channelFilter === 'food_apps') {
        ordersQuery = ordersQuery.in('channel', ['gofood', 'grabfood', 'shopeefood', 'tiktokgo', 'tiktok', 'tiktok_go'])
      } else if (channelFilter === 'tiktokgo' || channelFilter === 'tiktok') {
        ordersQuery = ordersQuery.in('channel', ['tiktokgo', 'tiktok', 'tiktok_go'])
      } else {
        ordersQuery = ordersQuery.eq('channel', channelFilter)
      }
    }

    const { data: ordersData, error } = await fetchWithTimeout(ordersQuery.then(res => res))
    if (error) throw error

    const completedOrders = (ordersData || []).filter((o: any) => o.status === 'completed')
    const totalRevenue = completedOrders.reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0)
    
    // Total Potongan: Meliputi diskon order, diskon item menu POS, dan subsidi promo Food Apps di semua channel
    const totalDeductions = completedOrders.reduce((s: number, o: any) => {
      const disc = Number(o.discount_amount) || 0
      const promo = Number(o.promo_subsidy) || 0
      if (disc > 0 || promo > 0) {
        return s + disc + promo
      }
      const itemSubtotal = (o.order_items || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)
      const itemDiff = itemSubtotal > Number(o.total_amount) ? itemSubtotal - Number(o.total_amount) : 0
      return s + itemDiff
    }, 0)

    const netRevenue = Math.max(0, totalRevenue - totalDeductions)
    const totalOrders = completedOrders.length
    const pendingCount = (ordersData || []).filter((o: any) => o.status === 'pending').length
    const canceledCount = (ordersData || []).filter((o: any) => o.status === 'cancelled').length
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

    const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
    const hourly = Array(24).fill(0)
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}

    completedOrders.forEach((o: any) => {
      // Payment Breakdown
      const pm = o.payment_method || 'unknown'
      if (!paymentBreakdown[pm]) paymentBreakdown[pm] = { count: 0, revenue: 0 }
      paymentBreakdown[pm].count++
      paymentBreakdown[pm].revenue += Number(o.total_amount) || 0

      // Hourly (Asia/Jakarta +7)
      const d = new Date(o.created_at)
      const h = (d.getUTCHours() + 7) % 24
      hourly[h]++

      // Best Sellers
      if (Array.isArray(o.order_items)) {
        o.order_items.forEach((oi: any) => {
          const name = oi.menu_item_name || 'Item'
          if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 }
          itemMap[name].qty += Number(oi.quantity) || 0
          itemMap[name].revenue += Number(oi.subtotal) || 0
        })
      }
    })

    const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10)

    let maxHourlyCount = 0
    let peakHour: number | null = null
    for (let i = 0; i < 24; i++) {
      if (hourly[i] > maxHourlyCount) {
        maxHourlyCount = hourly[i]
        peakHour = i
      }
    }

    const analyticsResult = {
      totalRevenue,
      totalDeductions,
      netRevenue,
      totalOrders,
      avgOrderValue,
      pendingCount,
      canceledCount,
      paymentBreakdown,
      hourly,
      peakHour,
      bestSellers,
      categoryData: []
    }

    await db.app_state.put({
      key: `reports_analytics:${outletId}:${range}:${channelFilter}:${paymentFilter}:${statusFilter}`,
      value: analyticsResult,
      synced_at: Date.now()
    }).catch(() => {})

    return analyticsResult
  } catch (err) {
    console.warn('Network error fetching report analytics, falling back to Dexie cache', err)
    const cached = await db.app_state.get(`reports_analytics:${outletId}:${range}:${channelFilter}:${paymentFilter}:${statusFilter}`).catch(() => undefined)
    return cached?.value ?? {
      totalRevenue: 0, totalDeductions: 0, netRevenue: 0, totalOrders: 0, avgOrderValue: 0, pendingCount: 0, canceledCount: 0,
      paymentBreakdown: {}, hourly: Array(24).fill(0), dailyEntries: [], bestSellers: [], categoryData: []
    }
  }
}

async function fetchPaginatedOrders(
  outletId: string,
  range: DateRange,
  customStart: string,
  customEnd: string,
  search: string,
  page: number,
  limit: number,
  channelFilter: string = 'all',
  paymentFilter: string = 'all',
  statusFilter: string = 'all'
) {
  try {
    const supabase = createClient()
    
    let p_start = new Date()
    let p_end = new Date()
    
    if (range === 'today') {
      p_start.setHours(0, 0, 0, 0)
    } else if (range === 'yesterday') {
      p_start.setDate(p_start.getDate() - 1)
      p_start.setHours(0, 0, 0, 0)
      p_end.setHours(0, 0, 0, 0)
    } else if (range === '7days') {
      p_start.setDate(p_start.getDate() - 7)
      p_start.setHours(0, 0, 0, 0)
    } else if (range === '30days') {
      p_start.setDate(p_start.getDate() - 30)
      p_start.setHours(0, 0, 0, 0)
    } else if (range === 'all') {
      p_start = new Date(0)
    } else if (range === 'custom' && customStart && customEnd) {
      p_start = new Date(customStart)
      p_start.setHours(0, 0, 0, 0)
      p_end = new Date(customEnd)
      p_end.setHours(23, 59, 59, 999)
    }

    let q = supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .eq('outlet_id', outletId)
      .gte('created_at', p_start.toISOString())
      .lte('created_at', p_end.toISOString())
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter)
    }
    if (paymentFilter !== 'all') {
      q = q.eq('payment_method', paymentFilter)
    }
    if (channelFilter !== 'all') {
      if (channelFilter === 'offline') {
        q = q.is('channel', null)
      } else if (channelFilter === 'food_apps') {
        q = q.in('channel', ['gofood', 'grabfood', 'shopeefood', 'tiktokgo', 'tiktok', 'tiktok_go'])
      } else if (channelFilter === 'tiktokgo' || channelFilter === 'tiktok') {
        q = q.in('channel', ['tiktokgo', 'tiktok', 'tiktok_go'])
      } else {
        q = q.eq('channel', channelFilter)
      }
    }

    if (search.trim()) {
      const s = search.trim()
      q = q.or(`payment_method.ilike.%${s}%,channel.ilike.%${s}%`)
    }

    const offset = (page - 1) * limit
    q = q.range(offset, offset + limit - 1)

    const { data, count, error } = await fetchWithTimeout(q.then(res => res))
    if (error) throw error
    return { data: data || [], total: count ?? (data?.length || 0) }
  } catch(err) {
    return { data: [], total: 0 }
  }
}

async function fetchReportShifts(outletId: string, range: DateRange, customStart: string, customEnd: string): Promise<ShiftRow[]> {
  try {
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

    const { data, error } = await fetchWithTimeout(q.then(res => res))
    if (error) throw error

    const now = Date.now()
    if (data) {
      await db.shifts_cache.bulkPut(data.map((shift: any) => ({
        id: shift.id,
        shift_data: shift,
        synced_at: now
      })))
    }
    return data ?? []
  } catch (err) {
    console.warn('Network error fetching report shifts, falling back to Dexie cache', err)
    const cachedShifts = await db.shifts_cache.toArray()
    let results = cachedShifts.map(s => s.shift_data) as ShiftRow[]
    results.sort((a, b) => {
      const ta = a.end_time ? new Date(a.end_time).getTime() : 0
      const tb = b.end_time ? new Date(b.end_time).getTime() : 0
      return tb - ta
    })
    return results
  }
}

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>('today')
  const [showRangePicker, setShowRangePicker] = useState(false)

  // Custom Date
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Filter States
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Outlet Data (outletName sudah di-cache di useMyOutlet, tidak perlu query terpisah lagi)
  const { outletId, outletName: rawOutletName } = useMyOutlet()
  const outletName = rawOutletName || 'Memuat...'

  // Table State
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
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

  const { data: analyticsData, isLoading: loading } = useQuery({
    queryKey: ['reports', outletId, range, customStart, customEnd, channelFilter, paymentFilter, statusFilter],
    queryFn: () => fetchOutletAnalytics(outletId as string, range, customStart, customEnd, channelFilter, paymentFilter, statusFilter),
    enabled: !!outletId && isCustomReady,
    staleTime: 30000,
    retry: false,
  })

  const { data: searchResults, isLoading: loadingSearch } = useQuery({
    queryKey: ['reportSearch', outletId, range, customStart, customEnd, deferredSearchQuery, currentPage, channelFilter, paymentFilter, statusFilter],
    queryFn: () => fetchPaginatedOrders(outletId as string, range, customStart, customEnd, deferredSearchQuery, currentPage, itemsPerPage, channelFilter, paymentFilter, statusFilter),
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

  const analytics = useMemo(() => {
    const base = analyticsData || {}
    
    // Hitung total selisih laci (variance) dari tutup shift
    const totalCashVariance = (shifts || []).reduce((s, shift) => s + (shift.variance || 0), 0)

    let totalRevenue = base.totalRevenue || 0
    let totalDeductions = base.totalDeductions || 0
    let netRevenue = Math.max(0, totalRevenue - totalDeductions)
    let totalOrders = base.totalOrders || 0
    let pendingCount = base.pendingCount || 0
    let canceledCount = base.canceledCount || 0
    let avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

    let hourly = Array.isArray(base.hourly) && base.hourly.length === 24 ? base.hourly : Array(24).fill(0)
    let dailyEntries = Array.isArray(base.dailyEntries) ? base.dailyEntries : []
    let bestSellers = Array.isArray(base.bestSellers) ? base.bestSellers : []
    let categoryData = Array.isArray(base.categoryData) ? base.categoryData : []
    let paymentBreakdown = base.paymentBreakdown || {}

    // Kalkulasi Jam Tersibuk (Peak Hour) jika API tidak menyediakannya
    let peakHour = base.peakHour;
    if (peakHour == null && hourly && Array.isArray(hourly)) {
      let maxCount = 0;
      let peakIndex = null;
      for (let i = 0; i < hourly.length; i++) {
        if (hourly[i] > maxCount) {
          maxCount = hourly[i];
          peakIndex = i;
        }
      }
      if (maxCount > 0) {
        peakHour = peakIndex;
      }
    }

    return {
      totalRevenue,
      totalDeductions,
      netRevenue,
      totalOrders,
      pendingCount,
      canceledCount,
      paymentBreakdown,
      hourly,
      dailyEntries,
      bestSellers,
      categoryData,
      avgOrderValue,
      totalCashVariance,
      peakHour
    }
  }, [analyticsData, shifts])

  const maxHourly = Math.max(...(analytics.hourly || Array(24).fill(0)), 1)
  const maxDaily = (analytics.dailyEntries && analytics.dailyEntries.length > 0)
    ? Math.max(...analytics.dailyEntries.map((e: [string, number]) => e[1] || 0), 1)
    : 1

  const PAYMENT_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    cash: { label: 'Tunai', color: '#10b981', bg: 'bg-emerald-50', icon: Banknote },
    qris: { label: 'QRIS', color: '#3b82f6', bg: 'bg-blue-50', icon: QrCode },
    card: { label: 'Kartu', color: '#8b5cf6', bg: 'bg-purple-50', icon: CreditCard },
    unknown: { label: 'Lainnya', color: '#6b7280', bg: 'bg-gray-50', icon: Package },
  }

  const totalProcessed = analytics.totalOrders + analytics.canceledCount;
  const successRate = totalProcessed > 0 
    ? Math.round((analytics.totalOrders / totalProcessed) * 100)
    : 0;
  const failureRate = totalProcessed > 0 
    ? 100 - successRate
    : 0;

  const paginatedData = searchResults?.data || []
  const totalItems = searchResults?.total || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)


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

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Filter Channel / Food Apps */}
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setCurrentPage(1); }}
            className="bg-white border border-gray-200 hover:border-gray-300 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm outline-none cursor-pointer"
          >
            <option value="all">Semua Channel</option>
            <option value="food_apps">Semua Food Apps</option>
            <option value="offline">POS Kasir (Walk-in)</option>
            <option value="gofood">GoFood</option>
            <option value="grabfood">GrabFood</option>
            <option value="shopeefood">ShopeeFood</option>
            <option value="tiktokgo">TikTok Go</option>
          </select>

          {/* Filter Metode Bayar */}
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
            className="bg-white border border-gray-200 hover:border-gray-300 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm outline-none cursor-pointer"
          >
            <option value="all">Semua Metode</option>
            <option value="cash">Tunai</option>
            <option value="qris">QRIS</option>
            <option value="card">Kartu</option>
          </select>

          {/* Filter Status Transaksi */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="bg-white border border-gray-200 hover:border-gray-300 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm outline-none cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
          {/* ── KPI Cards (6 Spacious Cards) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Revenue (Omzet Kotor) */}
            <div className="card p-5 bg-amber-500 text-white relative overflow-hidden flex flex-col justify-between min-w-0">
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="min-w-0">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-2">
                  <Banknote className="w-4 h-4 text-white" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Omzet Kotor</p>
                <p className="text-xl sm:text-2xl font-black mt-1 leading-tight whitespace-nowrap">{formatRupiah(analytics.totalRevenue)}</p>
              </div>
              <p className="text-[10px] text-white/70 mt-2 font-medium">*Sebelum potongan promo/diskon</p>
            </div>

            {/* Total Deductions (Potongan Promo & Diskon) */}
            <div className="card p-5 bg-rose-500 text-white relative overflow-hidden flex flex-col justify-between min-w-0">
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="min-w-0">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-2">
                  <Minus className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Total Potongan</p>
                <p className="text-xl sm:text-2xl font-black mt-1 leading-tight whitespace-nowrap">-{formatRupiah(analytics.totalDeductions)}</p>
              </div>
              <p className="text-[10px] text-white/70 mt-2 font-medium">*Promo Food Apps & Diskon</p>
            </div>

            {/* Net Revenue (Pendapatan Bersih) */}
            <div className="card p-5 bg-emerald-600 text-white relative overflow-hidden flex flex-col justify-between min-w-0">
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="min-w-0">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-2">
                  <TrendingUp className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <p className="text-xs font-bold text-white/90 uppercase tracking-wider">Pendapatan Bersih</p>
                <p className="text-xl sm:text-2xl font-black mt-1 leading-tight whitespace-nowrap">{formatRupiah(analytics.netRevenue)}</p>
              </div>
              <p className="text-[10px] text-white/90 mt-2 font-bold">✓ Bebas biaya potongan</p>
            </div>

            {/* Total Orders */}
            <div className="card p-5 flex flex-col justify-between min-w-0">
              <div className="min-w-0">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
                  <ShoppingBag className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pesanan Sukses</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{analytics.totalOrders}</p>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Transaksi berhasil diproses</p>
            </div>

            {/* Average Order */}
            <div className="card p-5 flex flex-col justify-between min-w-0">
              <div className="min-w-0">
                <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rata-rata / Order</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1 whitespace-nowrap">{formatRupiah(analytics.avgOrderValue)}</p>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Rata-rata belanja per pesanan</p>
            </div>

            {/* Peak Hour */}
            <div className="card p-5 flex flex-col justify-between min-w-0">
              <div className="min-w-0">
                <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 text-indigo-500" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Jam Tersibuk</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">
                  {analytics.totalOrders > 0 && analytics.peakHour != null ? `${String(analytics.peakHour).padStart(2, '0')}:00` : '—'}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Jam dengan pesanan terbanyak</p>
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
                    <p className="text-lg font-black text-red-700">{analytics.canceledCount}</p>
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
                    .sort((a, b) => (b[1] as any).count - (a[1] as any).count)
                    .map(([method, data]: [string, any]) => {
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
                          {analytics.categoryData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => [`${value} item`, 'Terjual']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 px-2">
                    {analytics.categoryData.map((entry: any, index: number) => (
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
                    {analytics.dailyEntries.map(([date, rev]: [string, number]) => {
                      const pct = (rev / maxDaily) * 100
                      const dayLabel = new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      return (
                        <div key={date} className="flex-1 flex flex-col justify-end items-center gap-1 h-full group relative min-w-0 max-w-[60px]">
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
                {analytics.hourly.map((count: number, hour: number) => {
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
                {analytics.hourly.map((_: any, hour: number) => (
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
                  {analytics.bestSellers.slice(0, 10).map((item: any, idx: number) => {
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
                              <p className="text-sm font-semibold text-gray-800 print-dark-text truncate">{cleanItemName(item.name)}</p>
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
              disabled={analytics.totalOrders === 0}
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
                    paginatedData.map((order: any) => (
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
                        <td className="px-5 py-4 text-gray-600 truncate max-w-[250px] font-medium" title={(order.order_items || []).map((i: any) => cleanItemName(i.menu_item_name)).join(', ')}>
                          {(order.order_items || []).map((i: any) => cleanItemName(i.menu_item_name)).join(', ')}
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
                  Menampilkan {totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems}
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
