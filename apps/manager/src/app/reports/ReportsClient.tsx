'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingBag, Banknote,
  Calendar, ChevronDown, Clock, CreditCard, QrCode,
  Package, Minus, CheckCircle2, XCircle
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar
} from 'recharts'

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'

const RANGE_LABELS: Record<DateRange, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  all: 'Semua Waktu',
  custom: 'Kustom Tanggal',
}

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

interface ReportsClientProps {
  analytics: any
  outlets: any[]
  initialFilters: {
    range: string
    customStart: string
    customEnd: string
    channelFilter: string
    paymentFilter: string
    statusFilter: string
    outletFilter: string
  }
  isLockedOutlet: boolean
}

export default function ReportsClient({ analytics, outlets, initialFilters, isLockedOutlet }: ReportsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [showRangePicker, setShowRangePicker] = useState(false)

  // Sync state with URL to avoid local state if possible
  const range = (searchParams.get('range') || initialFilters.range) as DateRange
  const customStart = searchParams.get('customStart') || initialFilters.customStart
  const customEnd = searchParams.get('customEnd') || initialFilters.customEnd
  const channelFilter = searchParams.get('channel') || initialFilters.channelFilter
  const paymentFilter = searchParams.get('payment') || initialFilters.paymentFilter
  const statusFilter = searchParams.get('status') || initialFilters.statusFilter
  const outletFilter = searchParams.get('outlet_id') || initialFilters.outletFilter

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const updateCustomRange = (start: string, end: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', 'custom')
    if (start) params.set('customStart', start)
    if (end) params.set('customEnd', end)
    router.push(`${pathname}?${params.toString()}`)
  }

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

  const maxHourly = Math.max(...(analytics.hourly || Array(24).fill(0)), 1)

  return (
    <div className="space-y-6 pb-10 animate-fade-in" id="report-content">
      
      {/* ── Header Web (Hidden on Print) ── */}
      <div className="no-print flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-suka-brown/10">
        <div>
          <h1 className="text-2xl font-black text-suka-brown tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-suka-orange" />
            Laporan & Analitik Cabang
          </h1>
          <p className="text-suka-gray-500 text-sm mt-0.5">Insight performa bisnis secara real-time</p>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          
          {/* Filter Channel / Food Apps */}
          <select
            value={channelFilter}
            onChange={(e) => updateFilters('channel', e.target.value)}
            className="bg-white border border-suka-brown/20 hover:border-suka-brown/40 px-3.5 py-2.5 rounded-xl text-sm font-bold text-suka-brown transition-all shadow-sm outline-none cursor-pointer"
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
            onChange={(e) => updateFilters('payment', e.target.value)}
            className="bg-white border border-suka-brown/20 hover:border-suka-brown/40 px-3.5 py-2.5 rounded-xl text-sm font-bold text-suka-brown transition-all shadow-sm outline-none cursor-pointer"
          >
            <option value="all">Semua Metode</option>
            <option value="cash">Tunai</option>
            <option value="qris">QRIS</option>
            <option value="card">Kartu</option>
          </select>

          {/* Custom Date Picker (if selected) */}
          {range === 'custom' && (
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-suka-gray-50 px-3 py-2 rounded-xl border border-suka-brown/20 w-full sm:w-auto order-last sm:order-first">
              <input
                type="date"
                value={customStart}
                onChange={(e) => updateCustomRange(e.target.value, customEnd)}
                className="w-full sm:w-auto bg-transparent text-sm font-bold text-suka-brown outline-none"
              />
              <span className="hidden sm:inline text-suka-gray-400 text-sm">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => updateCustomRange(customStart, e.target.value)}
                className="w-full sm:w-auto bg-transparent text-sm font-bold text-suka-brown outline-none"
              />
            </div>
          )}

          {/* Date range picker */}
          <div className="relative">
            <button
              onClick={() => setShowRangePicker(!showRangePicker)}
              className="flex items-center justify-between min-w-[160px] gap-2 bg-white border border-suka-brown/20 hover:border-suka-brown/40 px-4 py-2.5 rounded-xl text-sm font-bold text-suka-brown transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-suka-orange" />
                {RANGE_LABELS[range] || 'Filter Waktu'}
              </div>
              <ChevronDown className={`w-4 h-4 text-suka-gray-400 transition-transform ${showRangePicker ? 'rotate-180' : ''}`} />
            </button>

            {showRangePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRangePicker(false)} />
                <div className="absolute right-0 top-full mt-2 bg-white border border-suka-brown/10 rounded-2xl shadow-xl py-2 z-50 w-48 animate-fade-in">
                  {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        if (r !== 'custom') updateFilters('range', r)
                        else updateFilters('range', 'custom')
                        setShowRangePicker(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                        ${range === r ? 'bg-suka-orange/10 text-suka-orange font-black' : 'text-suka-gray-600 hover:bg-suka-gray-50 font-bold'}`}
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

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue (Omzet Kotor) */}
        <div className="bg-suka-orange p-5 rounded-2xl text-white relative overflow-hidden flex flex-col justify-between min-w-0 shadow-[0_4px_20px_rgba(249,115,22,0.2)]">
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
          <div className="min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Banknote className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Omzet Kotor</p>
            <p className="text-2xl sm:text-3xl font-black mt-1 leading-tight whitespace-nowrap">{formatRupiah(analytics.totalRevenue)}</p>
          </div>
          <p className="text-[10px] text-white/70 mt-3 font-medium">*Sebelum potongan promo/diskon</p>
        </div>

        {/* Total Orders */}
        <div className="bg-white border border-suka-brown/10 p-5 rounded-2xl flex flex-col justify-between min-w-0 shadow-sm">
          <div className="min-w-0">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <ShoppingBag className="w-5 h-5 text-blue-500" strokeWidth={2} />
            </div>
            <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider">Pesanan Sukses</p>
            <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-1">{analytics.totalOrders}</p>
          </div>
          <p className="text-[10px] text-suka-gray-400 mt-3 font-medium">Transaksi berhasil diproses</p>
        </div>

        {/* Average Order */}
        <div className="bg-white border border-suka-brown/10 p-5 rounded-2xl flex flex-col justify-between min-w-0 shadow-sm">
          <div className="min-w-0">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-purple-500" strokeWidth={2} />
            </div>
            <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider">Rata-rata / Order</p>
            <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-1 whitespace-nowrap">{formatRupiah(analytics.avgOrderValue)}</p>
          </div>
          <p className="text-[10px] text-suka-gray-400 mt-3 font-medium">Rata-rata belanja per pesanan</p>
        </div>

        {/* Peak Hour */}
        <div className="bg-white border border-suka-brown/10 p-5 rounded-2xl flex flex-col justify-between min-w-0 shadow-sm">
          <div className="min-w-0">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-indigo-500" strokeWidth={2} />
            </div>
            <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider">Jam Tersibuk</p>
            <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-1">
              {analytics.totalOrders > 0 && analytics.peakHour != null ? `${String(analytics.peakHour).padStart(2, '0')}:00` : '—'}
            </p>
          </div>
          <p className="text-[10px] text-suka-gray-400 mt-3 font-medium">Jam dengan pesanan terbanyak</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Status Transaksi ── */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-suka-brown/10 md:col-span-1">
          <h2 className="font-black text-suka-brown text-lg mb-1">Status Transaksi</h2>
          <p className="text-suka-gray-400 text-xs mb-5 font-medium">Pesanan Lunas vs Batal</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-suka-green/10 rounded-xl border border-suka-green/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-suka-green/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-suka-green" />
                </div>
                <div>
                  <p className="text-sm font-black text-suka-brown">Selesai</p>
                  <p className="text-[10px] font-bold text-suka-green">Pembayaran sukses</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-suka-brown">{analytics.totalOrders}</p>
                <p className="text-[11px] font-bold text-suka-green">{successRate}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-suka-brown">Dibatalkan</p>
                  <p className="text-[10px] font-bold text-red-600">Kadaluarsa / Batal Kasir</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-suka-brown">{analytics.canceledCount}</p>
                <p className="text-[11px] font-bold text-red-500">{failureRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Payment Method Breakdown ── */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-suka-brown/10 md:col-span-2">
          <h2 className="font-black text-suka-brown text-lg mb-1">Distribusi Pembayaran</h2>
          <p className="text-suka-gray-400 text-xs mb-5 font-medium">Rincian per metode bayar</p>

          {Object.keys(analytics.paymentBreakdown).length === 0 ? (
            <div className="flex items-center justify-center h-40 bg-suka-gray-50 rounded-xl border border-dashed border-suka-brown/20 text-suka-gray-400 text-sm font-bold">
              Belum ada data pembayaran
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-48 h-48 shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(analytics.paymentBreakdown).map(([k, v]: [string, any]) => ({
                        name: PAYMENT_META[k]?.label || k,
                        value: v.count,
                        color: PAYMENT_META[k]?.color || '#cbd5e1'
                      }))}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none"
                    >
                      {Object.entries(analytics.paymentBreakdown).map(([k]: [string, any], index) => (
                        <Cell key={`cell-${index}`} fill={PAYMENT_META[k]?.color || '#cbd5e1'} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val: any) => [`${val} Transaksi`, 'Jumlah']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-suka-brown">{analytics.totalOrders}</span>
                  <span className="text-[10px] font-bold text-suka-gray-400">Total</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                {Object.entries(analytics.paymentBreakdown)
                  .sort((a: any, b: any) => b[1].revenue - a[1].revenue)
                  .map(([method, data]: [string, any]) => {
                    const meta = PAYMENT_META[method] || PAYMENT_META.unknown
                    const Icon = meta.icon
                    const percent = analytics.totalRevenue > 0 ? (data.revenue / analytics.totalRevenue) * 100 : 0
                    return (
                      <div key={method} className="bg-suka-gray-50 p-3 rounded-xl flex items-center justify-between border border-suka-brown/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bg}`}>
                            <Icon className="w-5 h-5" style={{ color: meta.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-suka-brown">{meta.label}</p>
                            <p className="text-[10px] font-bold text-suka-gray-500">{data.count} Transaksi</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-suka-brown">{formatRupiah(data.revenue)}</p>
                          <p className="text-[10px] font-bold" style={{ color: meta.color }}>{percent.toFixed(1)}%</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Item Yang Terjual (Ranking Menu) ── */}
      {analytics.bestSellers && analytics.bestSellers.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-suka-brown/10">
          <div className="flex items-center gap-3 mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-suka-orange w-5 h-5"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
            <h2 className="font-black text-suka-brown text-lg">Item Yang Terjual</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {analytics.bestSellers.map((item: any, index: number) => {
              const maxQty = analytics.bestSellers[0]?.qty || 1;
              const percentage = (item.qty / maxQty) * 100;
              const isTop3 = index < 3;
              
              return (
                <div key={index} className="group relative">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 min-w-0 pr-4">
                      {isTop3 ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-blue-500 w-4 h-4 shrink-0"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                      ) : (
                        <span className="text-[11px] font-bold text-suka-gray-400 w-5 shrink-0 text-left">#{index + 1}</span>
                      )}
                      <span className="text-xs font-bold text-suka-brown truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-suka-gray-400 font-medium">{item.qty} terjual</span>
                      <span className="text-xs font-black text-suka-brown">{formatRupiah(item.revenue)}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-transparent rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 bg-suka-orange"
                      style={{ width: `${Math.max(percentage, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )
}
