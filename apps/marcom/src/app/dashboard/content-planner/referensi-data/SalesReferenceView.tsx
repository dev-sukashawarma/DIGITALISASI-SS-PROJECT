'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  BarChart3,
  TrendingUp,
  Store,
  ShoppingBag,
  Search,
  ArrowUpDown,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Filter,
  CheckCircle2,
  RefreshCw,
  Award,
  Settings2,
} from 'lucide-react'
import {
  SalesReferenceData,
  OutletOption,
  getSalesReferenceData,
} from '@/app/actions/sales-reference'

interface SalesReferenceViewProps {
  initialData: SalesReferenceData
  outlets: OutletOption[]
}

export default function SalesReferenceView({
  initialData,
  outlets,
}: SalesReferenceViewProps) {
  const [data, setData] = useState<SalesReferenceData>(initialData)
  const [isPending, startTransition] = useTransition()

  // Filter States
  const [period, setPeriod] = useState<string>(initialData.period || 'thisMonth')
  const [selectedOutletId, setSelectedOutletId] = useState<string>(initialData.outletId || 'ALL')
  const [customStartDate, setCustomStartDate] = useState<string>(initialData.startDate)
  const [customEndDate, setCustomEndDate] = useState<string>(initialData.endDate)

  // Table Search & Sort States
  const [outletSearch, setOutletSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [itemSortBy, setItemSortBy] = useState<'qty' | 'revenue'>('qty')

  // Item Table Pagination
  const [itemPage, setItemPage] = useState(1)
  const [itemPageSize, setItemPageSize] = useState(10)

  // Fetch data on filter change
  const applyFilters = (
    newPeriod: string,
    newOutletId: string,
    newStart?: string,
    newEnd?: string
  ) => {
    startTransition(async () => {
      const res = await getSalesReferenceData({
        period: newPeriod,
        outletId: newOutletId,
        startDate: newStart || customStartDate,
        endDate: newEnd || customEndDate,
      })
      setData(res)
      setItemPage(1)
    })
  }

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    if (newPeriod !== 'custom') {
      applyFilters(newPeriod, selectedOutletId)
    }
  }

  const handleOutletChange = (newOutletId: string) => {
    setSelectedOutletId(newOutletId)
    applyFilters(period, newOutletId)
  }

  const handleApplyCustomDates = () => {
    if (customStartDate && customEndDate) {
      applyFilters('custom', selectedOutletId, customStartDate, customEndDate)
    }
  }

  // Filter & search Outlet Rankings
  const filteredOutlets = useMemo(() => {
    return data.outletRankings.filter((o) =>
      o.outletName.toLowerCase().includes(outletSearch.toLowerCase())
    )
  }, [data.outletRankings, outletSearch])

  // Filter, sort & paginate Item Rankings
  const processedItems = useMemo(() => {
    const list = data.menuRankings.filter((it) =>
      it.name.toLowerCase().includes(itemSearch.toLowerCase())
    )

    list.sort((a, b) => {
      if (itemSortBy === 'revenue') {
        return b.totalRevenue - a.totalRevenue
      }
      return b.totalQty - a.totalQty
    })

    return list.map((item, index) => ({
      ...item,
      rank: index + 1,
    }))
  }, [data.menuRankings, itemSearch, itemSortBy])

  const totalItemPages = Math.max(1, Math.ceil(processedItems.length / itemPageSize))
  const safeItemPage = Math.min(itemPage, totalItemPages)
  const itemStartIndex = (safeItemPage - 1) * itemPageSize
  const paginatedItems = processedItems.slice(itemStartIndex, itemStartIndex + itemPageSize)

  // Format currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('id-ID').format(val)
  }

  const selectedOutletName = useMemo(() => {
    if (selectedOutletId === 'ALL') return 'Semua Cabang (Nasional)'
    const f = outlets.find((o) => o.id === selectedOutletId)
    return f ? f.name : 'Outlet Terpilih'
  }, [selectedOutletId, outlets])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Konten Planner • Child Module</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Referensi Data Penjualan POS
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Kompas data performa omzet kotor cabang dan ranking menu terlaris untuk acuan tema naskah, jam posting, dan aktivasi outlet tim Marcom.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#EFE8DE] text-xs font-bold text-stone-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sinkron POS Live</span>
          </div>
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF8F5] border border-[#EFE8DE] rounded-2xl w-fit flex-wrap">
        <Link
          href="/dashboard/content-planner"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <CalendarDays className="w-4 h-4 text-stone-400" />
          <span>Rencana Konten</span>
        </Link>

        <Link
          href="/dashboard/content-planner/metrik-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <BarChart3 className="w-4 h-4 text-stone-400" />
          <span>Metrik Data</span>
        </Link>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-[#D9480F] text-white shadow-xs">
          <TrendingUp className="w-4 h-4" />
          <span>Referensi Data</span>
        </div>

        <Link
          href="/dashboard/content-planner/pengaturan"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <Settings2 className="w-4 h-4 text-stone-400" />
          <span>Pengaturan Konten</span>
        </Link>
      </div>

      {/* 2 Executive Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Omzet Kotor */}
        <div className="bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Omzet Kotor ({selectedOutletName})
            </span>
            <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#1A1715]">
              {formatRupiah(data.totalOmzetKotor)}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Acuan Tunggal POS live (periode {data.startDate} s/d {data.endDate})
            </p>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <Store className="w-32 h-32 text-[#D9480F]" />
          </div>
        </div>

        {/* Total Pcs & Transaksi */}
        <div className="bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Volume Transaksi & Produk Terjual
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#1A1715]">
              {formatNumber(data.totalItemsSold)}{' '}
              <span className="text-sm font-sans font-medium text-stone-500">pcs produk</span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Dari <strong className="text-stone-700 font-mono">{formatNumber(data.totalTransactions)}</strong> transaksi order selesai
            </p>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <ShoppingBag className="w-32 h-32 text-amber-700" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Preset Tanggal Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#D9480F]" />
              <span>Periode:</span>
            </span>

            {[
              { id: 'thisMonth', label: 'Bulan Ini' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: '7days', label: '7 Hari' },
              { id: '30days', label: '30 Hari' },
              { id: 'lastMonth', label: 'Bulan Lalu' },
              { id: 'custom', label: 'Kustom' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePeriodChange(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-[#1A1715] text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-stone-600 hover:text-[#1A1715] hover:bg-stone-200/60 border border-[#EFE8DE]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filter Cabang Outlet Dropdown */}
          <div className="flex items-center gap-2 min-w-[240px]">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-[#D9480F]" />
              <span>Cabang:</span>
            </span>
            <select
              value={selectedOutletId}
              onChange={(e) => handleOutletChange(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
            >
              <option value="ALL">Semua Cabang (Nasional)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.type === 'mitra' ? '(Mitra)' : '(Internal)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if 'custom' is active */}
        {period === 'custom' && (
          <div className="pt-3 border-t border-[#EFE8DE] flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
            <span className="text-xs font-bold text-stone-600">Rentang Tanggal:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20"
              />
              <span className="text-xs text-stone-400 font-bold">s/d</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCustomDates}
              className="px-4 py-1.5 bg-[#D9480F] hover:bg-[#B83808] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Terapkan Tanggal
            </button>
          </div>
        )}

        {/* Status Loading Indicator & Filter info */}
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium pt-2 border-t border-[#EFE8DE]">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan data penjualan:{' '}
              <strong className="text-[#1A1715]">{data.startDate}</strong> s/d{' '}
              <strong className="text-[#1A1715]">{data.endDate}</strong>
            </span>
            {selectedOutletId !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-md bg-[#FFF4ED] text-[#D9480F] font-bold text-[10px] border border-[#D9480F]/20">
                Fokus: {selectedOutletName}
              </span>
            )}
          </div>

          {isPending && (
            <div className="flex items-center gap-1.5 text-[#D9480F] font-bold animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Memuat data POS...</span>
            </div>
          )}
        </div>
      </div>

      {/* DUAL COLUMN BENTO GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* KOLOM KIRI: RANKING OUTLET */}
        <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden flex flex-col">
          {/* Header Kolom Outlet */}
          <div className="p-5 border-b border-[#EFE8DE] bg-[#FAF8F5] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#1A1715]">
                    Ranking Outlet (Omzet Kotor)
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Leaderboard omzet kotor seluruh cabang SS
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-stone-200 text-stone-700">
                {filteredOutlets.length} Cabang
              </span>
            </div>

            {/* Instant Search Bar Outlet */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama cabang outlet..."
                value={outletSearch}
                onChange={(e) => setOutletSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#EFE8DE] bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
              />
            </div>
          </div>

          {/* Table Outlet */}
          <div className="overflow-x-auto max-h-[680px] overflow-y-auto divide-y divide-[#EFE8DE]">
            <table className="w-full min-w-[500px] text-left text-xs text-stone-600">
              <thead className="bg-[#FAF8F5]/80 text-stone-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-[#EFE8DE]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Cabang Outlet</th>
                  <th className="py-3 px-4 text-right">Omzet Kotor</th>
                  <th className="py-3 px-4 text-right">Trx</th>
                  <th className="py-3 px-4 w-28 text-right">Kontribusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8DE]">
                {filteredOutlets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-stone-400">
                      <Store className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                      <p className="font-semibold text-stone-600">Tidak ada outlet yang cocok.</p>
                    </td>
                  </tr>
                ) : (
                  filteredOutlets.map((item) => {
                    const isSelected = selectedOutletId === item.outletId
                    const isTop1 = item.rank === 1
                    const isTop2 = item.rank === 2
                    const isTop3 = item.rank === 3

                    return (
                      <tr
                        key={item.outletId}
                        onClick={() => handleOutletChange(item.outletId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#FFF4ED] font-semibold border-l-4 border-l-[#D9480F]'
                            : 'hover:bg-[#FAF8F5]/70'
                        }`}
                        title={`Klik untuk filter ranking menu khusus ${item.outletName}`}
                      >
                        {/* Rank Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold font-mono text-xs ${
                              isTop1
                                ? 'bg-amber-400 text-amber-950 shadow-2xs font-extrabold'
                                : isTop2
                                ? 'bg-stone-300 text-stone-800'
                                : isTop3
                                ? 'bg-amber-700/20 text-amber-800'
                                : 'text-stone-400'
                            }`}
                          >
                            {item.rank}
                          </span>
                        </td>

                        {/* Nama Outlet */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#1A1715] flex items-center gap-1.5">
                            <span className="truncate max-w-[160px] sm:max-w-xs">{item.outletName}</span>
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#D9480F] text-white font-bold uppercase">
                                Terpilih
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                item.outletType === 'mitra'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {item.outletType === 'mitra' ? 'Mitra' : 'Internal'}
                            </span>
                            {item.region && (
                              <span className="text-[10px] text-stone-400 font-medium">
                                • {item.region}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Omzet Kotor */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-bold font-mono text-[#1A1715]">
                            {formatRupiah(item.omzetKotor)}
                          </div>
                        </td>

                        {/* Transaksi */}
                        <td className="py-3.5 px-4 text-right font-mono text-stone-600">
                          {formatNumber(item.totalTrx)}
                        </td>

                        {/* Kontribusi Share */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold font-mono text-stone-800 text-[11px]">
                              {item.percentageShare.toFixed(1)}%
                            </span>
                            <div className="w-16 bg-stone-100 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div
                                className="bg-[#D9480F] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, item.percentageShare)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Outlet */}
          <div className="p-3.5 bg-[#FAF8F5] border-t border-[#EFE8DE] text-xs text-stone-500 flex items-center justify-between">
            <span>
              Total: <strong>{filteredOutlets.length}</strong> outlet
            </span>
            {selectedOutletId !== 'ALL' && (
              <button
                type="button"
                onClick={() => handleOutletChange('ALL')}
                className="text-xs font-bold text-[#D9480F] hover:underline cursor-pointer"
              >
                Reset ke Semua Cabang
              </button>
            )}
          </div>
        </div>

        {/* KOLOM KANAN: RANKING ITEM PENJUALAN */}
        <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden flex flex-col">
          {/* Header Kolom Item */}
          <div className="p-5 border-b border-[#EFE8DE] bg-[#FAF8F5] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#1A1715]">
                    Ranking Penjualan Item
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Menu terlaris {selectedOutletId === 'ALL' ? 'Nasional' : `khusus ${selectedOutletName}`}
                  </p>
                </div>
              </div>

              {/* Sorting Toggle: Pcs vs Omzet */}
              <div className="flex items-center p-1 bg-white border border-[#EFE8DE] rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setItemSortBy('qty')
                    setItemPage(1)
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    itemSortBy === 'qty'
                      ? 'bg-[#1A1715] text-white shadow-2xs'
                      : 'text-stone-600 hover:text-[#1A1715]'
                  }`}
                >
                  📦 Pcs Terbanyak
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemSortBy('revenue')
                    setItemPage(1)
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    itemSortBy === 'revenue'
                      ? 'bg-[#1A1715] text-white shadow-2xs'
                      : 'text-stone-600 hover:text-[#1A1715]'
                  }`}
                >
                  💵 Omzet Terbesar
                </button>
              </div>
            </div>

            {/* Instant Search Bar Item */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama menu / item..."
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value)
                  setItemPage(1)
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#EFE8DE] bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
              />
            </div>
          </div>

          {/* Table Item */}
          <div className="overflow-x-auto min-h-[480px]">
            <table className="w-full min-w-[500px] text-left text-xs text-stone-600">
              <thead className="bg-[#FAF8F5]/80 text-stone-500 font-bold uppercase tracking-wider text-[10px] border-b border-[#EFE8DE]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Nama Produk / Menu</th>
                  <th className="py-3 px-4 text-right">Pcs Terjual</th>
                  <th className="py-3 px-4 text-right">Nilai Omzet</th>
                  <th className="py-3 px-4 w-28 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8DE]">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-stone-400">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                      <p className="font-semibold text-stone-600">Tidak ada produk yang cocok.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const isTop1 = item.rank === 1
                    const isTop2 = item.rank === 2
                    const isTop3 = item.rank === 3
                    const displayShare =
                      itemSortBy === 'revenue' ? item.percentageRevShare : item.percentageQtyShare

                    return (
                      <tr key={item.name} className="hover:bg-[#FAF8F5]/70 transition-colors">
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold font-mono text-xs ${
                              isTop1
                                ? 'bg-amber-400 text-amber-950 shadow-2xs font-extrabold'
                                : isTop2
                                ? 'bg-stone-300 text-stone-800'
                                : isTop3
                                ? 'bg-amber-700/20 text-amber-800'
                                : 'text-stone-400'
                            }`}
                          >
                            {item.rank}
                          </span>
                        </td>

                        {/* Nama Menu */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#1A1715] truncate max-w-[160px] sm:max-w-xs">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-stone-400 font-medium">
                            {formatRupiah(Math.round(item.totalRevenue / (item.totalQty || 1)))} / pcs
                          </div>
                        </td>

                        {/* Pcs Terjual */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-mono font-bold ${
                              itemSortBy === 'qty' ? 'text-[#D9480F] text-sm' : 'text-stone-800'
                            }`}
                          >
                            {formatNumber(item.totalQty)}{' '}
                            <span className="text-[10px] font-normal text-stone-500">pcs</span>
                          </span>
                        </td>

                        {/* Nilai Omzet Item */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-mono font-bold ${
                              itemSortBy === 'revenue' ? 'text-[#D9480F] text-sm' : 'text-stone-800'
                            }`}
                          >
                            {formatRupiah(item.totalRevenue)}
                          </span>
                        </td>

                        {/* Share % */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold font-mono text-stone-800 text-[11px]">
                              {displayShare.toFixed(1)}%
                            </span>
                            <div className="w-16 bg-stone-100 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div
                                className="bg-amber-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, displayShare)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination Item */}
          <div className="p-4 bg-[#FAF8F5] border-t border-[#EFE8DE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <span>
                Menampilkan{' '}
                <strong className="text-[#1A1715]">
                  {processedItems.length > 0 ? itemStartIndex + 1 : 0}
                </strong>{' '}
                -{' '}
                <strong className="text-[#1A1715]">
                  {Math.min(itemStartIndex + itemPageSize, processedItems.length)}
                </strong>{' '}
                dari <strong className="text-[#1A1715]">{processedItems.length}</strong> produk
              </span>

              <select
                value={itemPageSize}
                onChange={(e) => {
                  setItemPageSize(Number(e.target.value))
                  setItemPage(1)
                }}
                className="px-2 py-1 bg-white border border-[#EFE8DE] rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value={10}>10 / hal</option>
                <option value={20}>20 / hal</option>
                <option value={50}>50 / hal</option>
              </select>
            </div>

            {/* Pagination Controls */}
            {totalItemPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeItemPage <= 1}
                  onClick={() => setItemPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs font-bold px-2 text-[#1A1715]">
                  {safeItemPage} / {totalItemPages}
                </span>
                <button
                  type="button"
                  disabled={safeItemPage >= totalItemPages}
                  onClick={() => setItemPage((p) => Math.min(totalItemPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
