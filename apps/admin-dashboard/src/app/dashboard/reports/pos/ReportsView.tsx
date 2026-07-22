'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  FileText, Calendar, ChevronDown, ChevronUp, Award, Banknote,
  QrCode, CreditCard, Package, Search, CheckCircle2, XCircle, Printer, Wallet
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cleanItemName } from '@/lib/order-item-name'
import { formatRupiah } from '@/lib/validations'
import OrderSourceBadge from '@/components/OrderSourceBadge'
import { resolveOrderSource } from '@/lib/order-source'
import dynamic from 'next/dynamic'

const CategoryPieChart = dynamic(() => import('./CategoryPieChart'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded-full"></div>
})
import type { Outlet } from '@/pos-types'
import BranchFilter from '@/components/BranchFilter'

interface ShiftRow {
  id: string
  outlet_id: string
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
  total_amount: number
  created_at: string
  outlet_id: string
  channel: string | null
  sales_source: string | null
  order_items: {
    id: string
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[]
}

type DateRangeType = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'

const RANGE_LABELS: Record<DateRangeType, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  all: 'Semua Waktu',
  custom: 'Kustom Tanggal',
}

interface ReportsViewProps {
  initialOutlets: Outlet[]
}

export default function ReportsView({ initialOutlets }: ReportsViewProps) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  
  // Date Range State
  const [range, setRange] = useState<DateRangeType>('today')
  const [showRangePicker, setShowRangePicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Table State
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Modal State for Shift Expenses
  const [selectedShiftForExpenses, setSelectedShiftForExpenses] = useState<ShiftRow | null>(null)
  const [shiftExpenses, setShiftExpenses] = useState<any[]>([])
  const [loadingShiftExpenses, setLoadingShiftExpenses] = useState(false)
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null)

  const openShiftExpenses = async (shift: ShiftRow) => {
    setSelectedShiftForExpenses(shift)
    setLoadingShiftExpenses(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('petty_cash_expenses')
      .select('*')
      .eq('outlet_id', shift.outlet_id)
      .gte('created_at', shift.start_time)
      .lte('created_at', shift.end_time || new Date().toISOString())
      .order('created_at', { ascending: true })
    
    setShiftExpenses(data || [])
    setLoadingShiftExpenses(false)
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let q = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      
    // Filter Outlet
    if (selectedOutlet !== 'all') {
      q = q.eq('outlet_id', selectedOutlet)
    }

    // Filter Date
    if (range === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      q = q.gte('created_at', today.toISOString())
    } else if (range === 'yesterday') {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      d.setHours(0, 0, 0, 0)
      const endD = new Date()
      endD.setHours(0, 0, 0, 0)
      q = q.gte('created_at', d.toISOString()).lt('created_at', endD.toISOString())
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
    } else if (range === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(customEndDate)
      end.setHours(23, 59, 59, 999)
      q = q.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
    }

    // Fetch Shifts
    let qShifts = supabase
      .from('shifts')
      .select('*')
      .eq('status', 'closed')
      .order('end_time', { ascending: false })
      
    if (selectedOutlet !== 'all') {
      qShifts = qShifts.eq('outlet_id', selectedOutlet)
    }

    if (range === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      qShifts = qShifts.gte('end_time', today.toISOString())
    } else if (range === 'yesterday') {
      const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0)
      const endD = new Date(); endD.setHours(0, 0, 0, 0)
      qShifts = qShifts.gte('end_time', d.toISOString()).lt('end_time', endD.toISOString())
    } else if (range === '7days') {
      const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0)
      qShifts = qShifts.gte('end_time', d.toISOString())
    } else if (range === '30days') {
      const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0)
      qShifts = qShifts.gte('end_time', d.toISOString())
    } else if (range === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate); start.setHours(0, 0, 0, 0)
      const end = new Date(customEndDate); end.setHours(23, 59, 59, 999)
      qShifts = qShifts.gte('end_time', start.toISOString()).lte('end_time', end.toISOString())
    }

    const [{ data: ordersData }, { data: shiftsData }] = await Promise.all([q, qShifts])
    setOrders(ordersData ?? [])
    setShifts(shiftsData ?? [])
    setLoading(false)
  }, [range, selectedOutlet, customStartDate, customEndDate])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ─── Available Channels ───
  const availableChannels = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>()
    orders.forEach(o => {
      const src = resolveOrderSource(o.channel, o.sales_source)
      if (!map.has(src.key)) {
        map.set(src.key, { key: src.key, label: src.label })
      }
    })
    return Array.from(map.values())
  }, [orders])

  // ─── Derived Analytics ───
  const analytics = useMemo(() => {
    const filteredOrders = selectedChannel === 'all' 
      ? orders 
      : selectedChannel === 'food_apps'
        ? orders.filter(o => ['shopeefood', 'grabfood', 'gofood'].includes(resolveOrderSource(o.channel, o.sales_source).key))
        : orders.filter(o => resolveOrderSource(o.channel, o.sales_source).key === selectedChannel)

    const completed = filteredOrders.filter(o => o.status === 'completed')
    const totalOrders = completed.length
    let totalRevenue = completed.reduce((s, o) => s + o.total_amount, 0)

    // Hitung total selisih laci (variance) dari tutup shift
    const totalCashVariance = shifts.reduce((s, shift) => s + (shift.variance || 0), 0)

    // Payment method breakdown
    const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
    completed.forEach(o => {
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

    // Best sellers & Category Breakdown
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    let mainFoodQty = 0
    let addOnsQty = 0

    completed.forEach(o => {
      o.order_items.forEach(oi => {
        const key = cleanItemName(oi.menu_item_name)
        if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 }
        itemMap[key].qty += oi.quantity
        itemMap[key].revenue += oi.subtotal
        
        // Simple logic to detect Category: if parentId exists or "Extra" in name -> Add-on
        if (oi.menu_item_name.includes('|PARENT|') || oi.menu_item_name.toLowerCase().includes('extra')) {
          addOnsQty += oi.quantity
        } else {
          mainFoodQty += oi.quantity
        }
      })
    })
    
    const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty)
    const categoryData = [
      { name: 'Menu Utama', value: mainFoodQty, color: '#f59e0b' },
      { name: 'Ekstra / Topping', value: addOnsQty, color: '#10b981' }
    ].filter(d => d.value > 0)

    // Success vs Failure
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled').length
    const successRate = filteredOrders.length > 0 ? Math.round((completed.length / filteredOrders.length) * 100) : 0

    // Deductions calculation
    const totalDeductions = completed.reduce((s, o) => s + (Number((o as any).discount_amount) || 0) + (Number((o as any).promo_subsidy) || 0), 0)
    const netRevenue = Math.max(0, totalRevenue - totalDeductions)

    return {
      completedOrders: completed,
      paymentBreakdown,
      bestSellers,
      categoryData,
      totalOrders,
      successRate,
      cancelledCount: cancelled,
      totalRevenue,
      totalDeductions,
      netRevenue
    }
  }, [orders, shifts, selectedChannel])

  const selectedOutletName = selectedOutlet === 'all' 
    ? 'Semua Cabang' 
    : outlets.find(o => o.id === selectedOutlet)?.name || 'Cabang Tidak Ditemukan'

  const PAYMENT_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    cash: { label: 'Tunai', color: '#10b981', bg: 'bg-emerald-50', icon: Banknote },
    qris: { label: 'QRIS', color: '#3b82f6', bg: 'bg-blue-50', icon: QrCode },
    card: { label: 'Kartu', color: '#8b5cf6', bg: 'bg-purple-50', icon: CreditCard },
    unknown: { label: 'Lainnya', color: '#6b7280', bg: 'bg-gray-50', icon: Package },
  }

  // Table filtering and pagination
  const filteredTableData = useMemo(() => {
    let result = analytics.completedOrders
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o => 
        o.order_number.toString().includes(q) || 
        o.order_items.some(i => i.menu_item_name.toLowerCase().includes(q))
      )
    }
    return result
  }, [analytics.completedOrders, searchQuery])

  const paginatedData = filteredTableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filteredTableData.length / itemsPerPage)


  // Item Breakdown (Rekap)
  const itemBreakdownData = useMemo(() => {
    const map = new Map<string, { name: string; groupLabel: string; qty: number; grossRevenue: number; netRevenue: number }>()
    
    filteredTableData.forEach(order => {
      // Hitung subtotal kotor dari seluruh item di pesanan ini
      const orderSubtotal = order.order_items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
      
      // Jika ada diskon/pajak di tingkat pesanan, distribusikan secara proporsional ke tiap item
      const ratio = orderSubtotal > 0 ? (order.total_amount / orderSubtotal) : 1

      order.order_items.forEach(item => {
        const cleanName = cleanItemName(item.menu_item_name)
        const src = resolveOrderSource(order.channel, order.sales_source)
        
        let groupLabel = 'OFFLINE'
        if (['shopeefood', 'grabfood', 'gofood'].includes(src.key)) {
          groupLabel = 'FOOD APPS'
        } else if (src.key === 'online') {
          groupLabel = 'WEB ONLINE'
        }
        
        const key = `${cleanName}-${groupLabel}`
        
        if (!map.has(key)) {
          map.set(key, {
            name: cleanName,
            groupLabel,
            qty: 0,
            grossRevenue: 0,
            netRevenue: 0
          })
        }
        
        const existing = map.get(key)!
        existing.qty += item.quantity
        existing.grossRevenue += item.subtotal
        existing.netRevenue += (item.subtotal * ratio)
      })
    })
    
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
  }, [filteredTableData])

  const [itemBreakdownSearch, setItemBreakdownSearch] = useState('')
  const [itemBreakdownFilter, setItemBreakdownFilter] = useState('all')
  const [itemBreakdownSortColumn, setItemBreakdownSortColumn] = useState<'name' | 'groupLabel' | 'qty' | 'grossRevenue'>('qty')
  const [itemBreakdownSortDirection, setItemBreakdownSortDirection] = useState<'asc' | 'desc'>('desc')

  const filteredItemBreakdownData = useMemo(() => {
    let result = itemBreakdownData
    if (itemBreakdownFilter !== 'all') {
      result = result.filter(item => item.groupLabel === itemBreakdownFilter)
    }
    if (itemBreakdownSearch) {
      const q = itemBreakdownSearch.toLowerCase()
      result = result.filter(item => item.name.toLowerCase().includes(q) || item.groupLabel.toLowerCase().includes(q))
    }
    
    result = [...result].sort((a, b) => {
      let valA = a[itemBreakdownSortColumn]
      let valB = b[itemBreakdownSortColumn]
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return itemBreakdownSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        return itemBreakdownSortDirection === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
      }
    })
    
    return result
  }, [itemBreakdownData, itemBreakdownFilter, itemBreakdownSearch, itemBreakdownSortColumn, itemBreakdownSortDirection])

  const [itemBreakdownPage, setItemBreakdownPage] = useState(1)
  const paginatedItemBreakdown = filteredItemBreakdownData.slice((itemBreakdownPage - 1) * itemsPerPage, itemBreakdownPage * itemsPerPage)
  const totalItemBreakdownPages = Math.ceil(filteredItemBreakdownData.length / itemsPerPage)

  const toggleItemBreakdownSort = (col: 'name' | 'groupLabel' | 'qty' | 'grossRevenue') => {
    if (itemBreakdownSortColumn === col) {
      setItemBreakdownSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setItemBreakdownSortColumn(col)
      setItemBreakdownSortDirection('desc')
    }
  }

  const renderItemBreakdownSortIcon = (col: 'name' | 'groupLabel' | 'qty' | 'grossRevenue') => {
    if (itemBreakdownSortColumn !== col) return <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-30 transition-opacity" />
    return itemBreakdownSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }
  const downloadPDF = () => {
    window.print()
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in" id="report-content">

      {/* ── Header Web (Hidden on Print) ── */}
      <div className="no-print flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <FileText className="w-7 h-7 text-amber-500" />
              Laporan & Analitik Detail
            </h1>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              Menampilkan data untuk: <strong className="text-gray-900">{selectedOutletName}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BranchFilter 
              outlets={outlets} 
              selectedOutlet={selectedOutlet} 
              onChange={setSelectedOutlet} 
            />

            <select
              value={selectedChannel}
              onChange={e => setSelectedChannel(e.target.value)}
              className="bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm outline-none cursor-pointer"
            >
              <option value="all">Semua Channel</option>
              <option value="food_apps">Semua Food Apps</option>
              {availableChannels.map(ch => (
                <option key={ch.key} value={ch.key}>{ch.label}</option>
              ))}
            </select>

            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
              <button
                onClick={() => setShowRangePicker(!showRangePicker)}
                className="w-full sm:w-auto flex items-center justify-between gap-2 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  {RANGE_LABELS[range]}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showRangePicker ? 'rotate-180' : ''}`} />
              </button>

              {range === 'custom' && (
                <div className="flex flex-col sm:flex-row items-center gap-2 text-sm bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200">
                  <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full sm:w-auto bg-transparent outline-none font-medium text-gray-700"/>
                  <span className="hidden sm:inline">-</span>
                  <span className="sm:hidden text-gray-400 text-xs">sampai</span>
                  <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full sm:w-auto bg-transparent outline-none font-medium text-gray-700"/>
                </div>
              )}

              {showRangePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRangePicker(false)} />
                  <div className="absolute left-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 w-48 animate-fade-in">
                    {(Object.keys(RANGE_LABELS) as DateRangeType[]).map((r) => (
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
          <p className="text-gray-900 text-sm mt-2 font-bold">Generated by Enterprise POS System</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-1">Informasi Laporan</p>
          <p className="text-base font-bold text-gray-900">Cabang: <span className="text-gray-900">{selectedOutletName}</span></p>
          <p className="text-sm font-bold text-gray-900">Periode: {RANGE_LABELS[range]}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
          {[1,2,3].map(i => <div key={i} className="card h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
          {/* ── KPI Cards (Omzet Kotor, Potongan, Pendapatan Bersih) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-amber-500 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Omzet Kotor</p>
                <p className="text-2xl font-black mt-1">{formatRupiah(analytics.totalRevenue)}</p>
              </div>
              <p className="text-[10px] text-white/70 mt-2 font-medium">*Sebelum potongan promo/diskon</p>
            </div>

            <div className="bg-rose-500 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Total Potongan</p>
                <p className="text-2xl font-black mt-1">-{formatRupiah(analytics.totalDeductions)}</p>
              </div>
              <p className="text-[10px] text-white/70 mt-2 font-medium">*Promo Food Apps & Diskon Menu</p>
            </div>

            <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
              <div>
                <p className="text-xs font-bold text-white/90 uppercase tracking-wider">Pendapatan Bersih</p>
                <p className="text-2xl font-black mt-1">{formatRupiah(analytics.netRevenue)}</p>
              </div>
              <p className="text-[10px] text-white/90 mt-2 font-bold">✓ Bebas biaya potongan</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Success vs Failure Rate */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Status Transaksi</h2>
              <p className="text-gray-400 print-dark-text text-xs mb-5">Pesanan Lunas vs Batal</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Selesai</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Pembayaran sukses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700 text-lg">{analytics.completedOrders.length}</p>
                    <p className="text-[10px] font-bold text-emerald-600">{analytics.successRate}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-red-500" />
                    <div>
                      <p className="text-sm font-bold text-red-800">Dibatalkan</p>
                      <p className="text-[10px] text-red-600 font-medium">Kadaluarsa / Batal Kasir</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-700 text-lg">{analytics.cancelledCount}</p>
                    <p className="text-[10px] font-bold text-red-600">{100 - analytics.successRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Breakdown */}
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
                                <p className="text-sm font-bold text-gray-800">{meta.label}</p>
                                <p className="text-[10px] text-gray-400">{data.count} pesanan</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">{pct}%</p>
                              <p className="text-[10px] text-gray-400">{formatRupiah(data.revenue)}</p>
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

            {/* Category Breakdown (Donut Chart) */}
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
                    <CategoryPieChart data={analytics.categoryData} />
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

          <div className="grid grid-cols-1 gap-6">
            {/* ── Best Sellers ── */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Award className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-gray-900 text-lg">Item Yang Terjual</h2>
              </div>

              {analytics.bestSellers.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">Belum ada data penjualan</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {analytics.bestSellers.map((item, idx) => {
                    const maxQty = analytics.bestSellers[0].qty
                    const pct = (item.qty / maxQty) * 100
                    const medals = ['🥇', '🥈', '🥉']
                    return (
                      <div key={item.name} className="group">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="w-6 text-center text-sm">
                            {idx < 3 ? medals[idx] : <span className="text-gray-400 font-bold text-xs">#{idx + 1}</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                <span className="text-xs text-gray-500 font-medium">{item.qty} terjual</span>
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
                    <th className="px-5 py-4">Sumber</th>
                    <th className="px-5 py-4">Metode Bayar</th>
                    <th className="px-5 py-4 text-right">Total Transaksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-gray-400 font-medium">Data tidak ditemukan</td>
                    </tr>
                  ) : (
                    paginatedData.map((order) => {
                      const orderSubtotal = order.order_items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
                      const discount = orderSubtotal - order.total_amount;
                      
                      return (
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
                          <td className="px-5 py-4 text-gray-600 font-medium">
                            <div className="flex flex-col gap-1.5">
                              {order.order_items.map((i, idx) => (
                                <div key={idx} className="whitespace-normal leading-tight text-[13px] flex items-start gap-1.5">
                                  <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">{i.quantity}x</span> 
                                  <span>{cleanItemName(i.menu_item_name)}</span>
                                </div>
                              ))}
                              {discount > 0 && (
                                <div className="whitespace-normal leading-tight text-[12px] flex items-start gap-1.5 mt-0.5 pt-1.5 border-t border-gray-100/60">
                                  <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">Promo</span>
                                  <span className="text-red-500">- {formatRupiah(discount)}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <OrderSourceBadge channel={order.channel} salesSource={order.sales_source} size="sm" />
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold rounded-lg uppercase">
                              {order.payment_method || '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="font-bold text-gray-900 text-base">{formatRupiah(order.total_amount)}</div>
                            {discount > 0 && (
                              <div className="text-[11px] font-medium text-red-500 mt-1">
                                (Diskon: -{formatRupiah(discount)})
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="bg-amber-50/50 font-bold text-gray-900 border-t border-amber-200">
                  <tr>
                    <td colSpan={4} className="px-5 py-4 text-right uppercase tracking-wider text-xs text-amber-800">
                      Total Keseluruhan
                    </td>
                    <td className="px-5 py-4">
                      <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-xs">
                        {filteredTableData.length} Transaksi
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-base text-amber-700">
                      {formatRupiah(filteredTableData.reduce((acc, curr) => acc + curr.total_amount, 0))}
                    </td>
                  </tr>
                </tfoot>
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
          
          {/* Rekap Rincian Item Terjual */}
          <div className="card p-6 shadow-sm border border-gray-100 mt-6 overflow-hidden no-print">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Rekap Rincian Item Terjual</h2>
                <p className="text-gray-400 text-xs mt-0.5">Ringkasan total kuantitas per item berdasarkan sumber pesanan</p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm font-medium"
                    placeholder="Cari item..."
                    value={itemBreakdownSearch}
                    onChange={(e) => { setItemBreakdownSearch(e.target.value); setItemBreakdownPage(1); }}
                  />
                </div>
                <select
                  value={itemBreakdownFilter}
                  onChange={e => { setItemBreakdownFilter(e.target.value); setItemBreakdownPage(1); }}
                  className="w-full sm:w-auto bg-white border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm outline-none cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="FOOD APPS">FOOD APPS</option>
                  <option value="WEB ONLINE">WEB ONLINE</option>
                  <option value="OFFLINE">OFFLINE</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100 select-none">
                  <tr>
                    <th 
                      className="px-5 py-4 cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Nama Item {renderItemBreakdownSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="px-5 py-4 cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('groupLabel')}
                    >
                      <div className="flex items-center gap-2">
                        Sumber Pesanan {renderItemBreakdownSortIcon('groupLabel')}
                      </div>
                    </th>
                    <th 
                      className="px-5 py-4 text-center cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('qty')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Total Qty Terjual {renderItemBreakdownSortIcon('qty')}
                      </div>
                    </th>
                    <th 
                      className="px-5 py-4 text-right cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('grossRevenue')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Total Pendapatan {renderItemBreakdownSortIcon('grossRevenue')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedItemBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-gray-400 font-medium">Data tidak ditemukan</td>
                    </tr>
                  ) : (
                    paginatedItemBreakdown.map((item, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                          <td className="px-5 py-4 font-bold text-gray-900 uppercase">
                            {item.groupLabel} {item.name}
                          </td>
                          <td className="px-5 py-4 uppercase text-gray-500 font-bold text-xs">
                            {item.groupLabel}
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-gray-900">
                            {item.qty}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-gray-900">
                            {formatRupiah(item.grossRevenue)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {filteredItemBreakdownData.length > 0 && (
                  <tfoot className="bg-amber-50/50 font-bold text-gray-900 border-t border-amber-200">
                    <tr>
                      <td colSpan={2} className="px-5 py-3 text-right uppercase tracking-wider text-xs text-amber-800">
                        Total Harga Kotor
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-xs">
                          {filteredItemBreakdownData.reduce((acc, curr) => acc + curr.qty, 0)} Item
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-base text-amber-700">
                        {formatRupiah(filteredItemBreakdownData.reduce((acc, curr) => acc + curr.grossRevenue, 0))}
                      </td>
                    </tr>
                    {(() => {
                       const totalGross = filteredItemBreakdownData.reduce((acc, curr) => acc + curr.grossRevenue, 0)
                       const totalNet = filteredItemBreakdownData.reduce((acc, curr) => acc + curr.netRevenue, 0)
                       const discount = totalGross - totalNet
                       if (discount > 0) {
                         return (
                           <tr>
                             <td colSpan={3} className="px-5 py-3 text-right uppercase tracking-wider text-xs text-red-600">
                               Potongan Diskon / Promo
                             </td>
                             <td className="px-5 py-3 text-right text-base text-red-600">
                               - {formatRupiah(discount)}
                             </td>
                           </tr>
                         )
                       }
                       return null
                    })()}
                    <tr>
                      <td colSpan={3} className="px-5 py-4 text-right uppercase tracking-wider text-sm text-gray-900 font-extrabold border-t border-amber-200">
                        Total Pendapatan Bersih
                      </td>
                      <td className="px-5 py-4 text-right text-lg text-emerald-600 font-extrabold border-t border-amber-200">
                        {formatRupiah(filteredItemBreakdownData.reduce((acc, curr) => acc + curr.netRevenue, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            
            {totalItemBreakdownPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs font-medium text-gray-400">
                  Menampilkan {((itemBreakdownPage - 1) * itemsPerPage) + 1} - {Math.min(itemBreakdownPage * itemsPerPage, filteredItemBreakdownData.length)} dari {filteredItemBreakdownData.length}
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setItemBreakdownPage(p => Math.max(1, p - 1))}
                    disabled={itemBreakdownPage === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Sebelumnya
                  </button>
                  <button 
                    onClick={() => setItemBreakdownPage(p => Math.min(totalItemBreakdownPages, p + 1))}
                    disabled={itemBreakdownPage === totalItemBreakdownPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Laporan Tutup Shift */}
          <div className="card p-6 shadow-sm border border-gray-100 mt-6 overflow-hidden no-print">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Laporan Laci Cash</h2>
              <p className="text-gray-400 text-xs mt-0.5 mb-6">Rekonsiliasi kas laci dan petty cash (uang operasional)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shifts.length === 0 ? (
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

                  return (
                    <div key={shift.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                      {/* Header Kartu */}
                      <div className="bg-amber-50 px-5 py-4 border-b border-amber-100 flex items-center gap-4">
                        <div className="bg-amber-100 p-2.5 rounded-lg text-amber-700">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-amber-900 text-sm mb-0.5">Shift {dateStr}</h3>
                          <p className="text-xs font-medium text-amber-700/80">{startTimeStr} - {endTimeStr}</p>
                        </div>
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
                              <span className="text-sm font-medium text-gray-500">Diserahkan Kasir</span>
                              <span className="font-extrabold text-gray-900 text-base">{formatRupiah(shift.actual_ending_cash)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-400">Menurut Sistem</span>
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
                              <span className="text-sm font-medium text-gray-500">Sisa Uang (Fisik)</span>
                              <span className="font-extrabold text-blue-700 text-base">{formatRupiah(shift.actual_ending_petty_cash || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-400">Menurut Sistem</span>
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
                      
                      {/* Footer Kartu */}
                      <div className="bg-gray-50 border-t border-gray-100 p-3 flex justify-end">
                        <button 
                          onClick={() => openShiftExpenses(shift)}
                          className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-amber-200/50"
                        >
                          <FileText className="w-4 h-4" />
                          Rincian Pengeluaran Petty Cash
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      {selectedShiftForExpenses && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Rincian Pengeluaran Petty Cash</h3>
                <p className="text-xs text-gray-500 mt-1">Shift: {new Date(selectedShiftForExpenses.start_time).toLocaleString('id-ID')}</p>
              </div>
              <button 
                onClick={() => setSelectedShiftForExpenses(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              {loadingShiftExpenses ? (
                <div className="flex justify-center py-10 text-gray-400">Memuat data pengeluaran...</div>
              ) : shiftExpenses.length === 0 ? (
                <div className="flex justify-center py-10 text-gray-400 font-medium text-sm">Tidak ada pengeluaran petty cash di shift ini.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3">Waktu</th>
                        <th className="px-4 py-3">Kategori</th>
                        <th className="px-4 py-3">Catatan</th>
                        <th className="px-4 py-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {shiftExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-amber-50/50">
                          <td className="px-4 py-3 text-gray-500 font-medium text-xs">
                            {new Date(exp.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-gray-700 capitalize font-medium">
                            {exp.category?.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3 text-gray-600 italic">
                            {exp.description}
                            {exp.receipt_url && (
                              <button onClick={() => setSelectedReceiptUrl(exp.receipt_url || null)} className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                <FileText className="w-3 h-3" />
                                Lihat Bukti
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            {formatRupiah(exp.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedShiftForExpenses(null)}
                className="px-4 py-2 font-bold text-gray-600 hover:text-gray-900 transition-colors bg-white border border-gray-200 rounded-xl shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Image Modal */}
      {selectedReceiptUrl && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in" 
          onClick={() => setSelectedReceiptUrl(null)}
        >
          {/* Image Container */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-4 pb-24" 
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={selectedReceiptUrl} 
              alt="Bukti Pengeluaran" 
              className="max-w-full max-h-full object-contain rounded-lg" 
            />
          </div>

          {/* Close Button (Bottom Center) */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-[10000] pointer-events-none">
            <button 
              onClick={() => setSelectedReceiptUrl(null)} 
              className="pointer-events-auto bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-bold rounded-full px-8 py-3.5 backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 shadow-2xl"
            >
              <XCircle className="w-5 h-5" />
              Tutup Gambar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
