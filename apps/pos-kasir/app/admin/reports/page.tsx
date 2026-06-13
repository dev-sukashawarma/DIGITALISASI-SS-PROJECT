'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  FileText, Calendar, ChevronDown, Award, Clock, Banknote,
  QrCode, CreditCard, Package, Download, Search, CheckCircle2, XCircle, Printer
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cleanItemName } from '@/lib/order-item-name'
import { formatRupiah } from '@/lib/validations'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts'
import type { Outlet } from '@/types'
import BranchFilter from '@/components/BranchFilter'

interface OrderRow {
  id: string
  order_number: number
  status: string
  payment_method: string | null
  total_amount: number
  created_at: string
  outlet_id: string
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

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
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

  const fetchOutlets = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('outlets').select('*').order('name')
    if (data) setOutlets(data)
  }, [])

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

    const { data } = await q
    setOrders(data ?? [])
    setLoading(false)
  }, [range, selectedOutlet, customStartDate, customEndDate])

  useEffect(() => { fetchOutlets() }, [fetchOutlets])
  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ─── Derived Analytics ───
  const analytics = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed')
    const totalOrders = completed.length
    const totalRevenue = completed.reduce((s, o) => s + o.total_amount, 0)

    // Payment method breakdown
    const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
    completed.forEach(o => {
      const method = o.payment_method || 'unknown'
      if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, revenue: 0 }
      paymentBreakdown[method].count++
      paymentBreakdown[method].revenue += o.total_amount
    })

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
    const cancelled = orders.filter(o => o.status === 'cancelled').length
    const successRate = orders.length > 0 ? Math.round((completed.length / orders.length) * 100) : 0

    return {
      completedOrders: completed,
      paymentBreakdown,
      bestSellers,
      categoryData,
      totalOrders,
      successRate,
      cancelledCount: cancelled,
      totalRevenue
    }
  }, [orders])

  const selectedOutletName = selectedOutlet === 'all' 
    ? 'Semua Cabang' 
    : outlets.find(o => o.id === selectedOutlet)?.name || 'Cabang Tidak Ditemukan'

  const PAYMENT_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
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

            <div className="relative flex items-center gap-2">
              <button
                onClick={() => setShowRangePicker(!showRangePicker)}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm"
              >
                <Calendar className="w-4 h-4 text-amber-500" />
                {RANGE_LABELS[range]}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showRangePicker ? 'rotate-180' : ''}`} />
              </button>

              {range === 'custom' && (
                <div className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200">
                  <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-transparent outline-none font-medium text-gray-700"/>
                  <span>-</span>
                  <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-transparent outline-none font-medium text-gray-700"/>
                </div>
              )}

              {showRangePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRangePicker(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 w-48 animate-fade-in">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          {[1,2,3,4].map(i => <div key={i} className="card h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
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

          <div className="grid grid-cols-1 gap-6">
            {/* ── Best Sellers ── */}
            <div className="card p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Award className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-gray-900 text-lg">Top 10 Produk Terlaris</h2>
              </div>

              {analytics.bestSellers.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">Belum ada data penjualan</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {analytics.bestSellers.slice(0, 10).map((item, idx) => {
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
        </>
      )}
    </div>
  )
}
