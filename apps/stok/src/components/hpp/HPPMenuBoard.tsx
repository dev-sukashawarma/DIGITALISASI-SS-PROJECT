'use client'

import React, { useState, useMemo } from 'react'
import {
  useHPPMenuList,
  type HPPMenuItem
} from '@/hooks/useHPPMenu'
import {
  Search,
  X,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  ChevronRight,
  Percent,
  SlidersHorizontal,
  Info
} from 'lucide-react'
import { Skeleton } from '@suka/design-system/src/components/SkeletonBase'

export function HPPMenuBoard() {
  const { data: menuList = [], isLoading, isRefetching, refetch, error } = useHPPMenuList()

  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'optimal' | 'warning' | 'critical'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'fc_desc' | 'fc_asc' | 'margin_desc' | 'margin_asc' | 'hpp_desc'>('fc_desc')

  // Detail Modal State
  const [detailItem, setDetailItem] = useState<HPPMenuItem | null>(null)

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    menuList.forEach((m) => {
      if (m.kategori_nama) set.add(m.kategori_nama)
    })
    return Array.from(set).sort()
  }, [menuList])

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = menuList.length
    if (total === 0) return { total: 0, avgFc: 0, optimalCount: 0, warningCount: 0, criticalCount: 0 }

    let sumFc = 0
    let optimalCount = 0
    let warningCount = 0
    let criticalCount = 0

    menuList.forEach((m) => {
      sumFc += m.food_cost_pct
      if (m.status_food_cost === 'optimal') optimalCount++
      else if (m.status_food_cost === 'warning') warningCount++
      else criticalCount++
    })

    return {
      total,
      avgFc: Math.round((sumFc / total) * 10) / 10,
      optimalCount,
      warningCount,
      criticalCount,
    }
  }, [menuList])

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return menuList
      .filter((item) => {
        // 1. Text search
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase()
          const matchMenu = item.menu_nama.toLowerCase().includes(q)
          const matchResep = item.resep_nama.toLowerCase().includes(q)
          const matchCategory = item.kategori_nama.toLowerCase().includes(q)
          const matchIngredient = item.ingredients.some((ing) =>
            ing.nama_bahan.toLowerCase().includes(q)
          )
          if (!matchMenu && !matchResep && !matchCategory && !matchIngredient) return false
        }

        // 2. Category filter
        if (selectedCategory !== 'all' && item.kategori_nama !== selectedCategory) {
          return false
        }

        // 3. Status filter
        if (statusFilter !== 'all' && item.status_food_cost !== statusFilter) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.menu_nama.localeCompare(b.menu_nama)
          case 'fc_desc':
            return b.food_cost_pct - a.food_cost_pct
          case 'fc_asc':
            return a.food_cost_pct - b.food_cost_pct
          case 'margin_desc':
            return b.gross_margin_rp - a.gross_margin_rp
          case 'margin_asc':
            return a.gross_margin_rp - b.gross_margin_rp
          case 'hpp_desc':
            return b.total_hpp - a.total_hpp
          default:
            return 0
        }
      })
  }, [menuList, searchTerm, selectedCategory, statusFilter, sortBy])

  // Export CSV Handler
  const handleExportCsv = () => {
    if (filteredItems.length === 0) return

    const headers = [
      'Nama Menu',
      'Kategori',
      'Nama Resep',
      'Harga Jual (Rp)',
      'Total HPP (Rp)',
      'Gross Margin (Rp)',
      'Gross Margin (%)',
      'Food Cost (%)',
      'Status Food Cost',
      'Jumlah Bahan',
      'Daftar Bahan Baku'
    ]

    const rows = filteredItems.map((it) => {
      const ingredientList = it.ingredients
        .map((ing) => `${ing.nama_bahan} (${ing.qty_per_porsi} ${ing.satuan_resep} = Rp${ing.subtotal_biaya.toLocaleString('id-ID')})`)
        .join('; ')

      return [
        `"${it.menu_nama.replace(/"/g, '""')}"`,
        `"${it.kategori_nama.replace(/"/g, '""')}"`,
        `"${it.resep_nama.replace(/"/g, '""')}"`,
        it.harga_jual,
        it.total_hpp,
        it.gross_margin_rp,
        `${it.gross_margin_pct}%`,
        `${it.food_cost_pct}%`,
        `"${it.status_food_cost}"`,
        it.ingredients.length,
        `"${ingredientList.replace(/"/g, '""')}"`
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `laporan_hpp_setiap_menu_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatRp = (val: number) => {
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Metric Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Menu */}
        <div className="bg-white p-4 rounded-3xl border border-suka-brown/10 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-suka-cream/60 border border-suka-brown/10 flex items-center justify-center text-suka-orange shrink-0">
            <ChefHat className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-suka-brown/60">Total Menu Resep</p>
            <p className="text-xl sm:text-2xl font-black text-suka-brown font-display mt-0.5">
              {metrics.total} <span className="text-xs font-bold text-suka-brown/50">Item</span>
            </p>
          </div>
        </div>

        {/* Rata-rata Food Cost */}
        <div className="bg-white p-4 rounded-3xl border border-suka-brown/10 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-suka-brown/60">Rata-rata Food Cost</p>
            <p className="text-xl sm:text-2xl font-black text-suka-brown font-display mt-0.5">
              {metrics.avgFc}%
            </p>
          </div>
        </div>

        {/* Margin Sehat */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'optimal' ? 'all' : 'optimal')}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer active:scale-98 ${
            statusFilter === 'optimal'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/40'
              : 'bg-white border-suka-brown/10 hover:border-emerald-500 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'optimal' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              🟢 Sehat (&lt;35%)
            </span>
            <CheckCircle2 className={`w-4 h-4 ${statusFilter === 'optimal' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <p className={`text-xl sm:text-2xl font-black font-display ${statusFilter === 'optimal' ? 'text-white' : 'text-emerald-950'}`}>
            {metrics.optimalCount} <span className="text-xs font-bold opacity-80">Menu</span>
          </p>
        </button>

        {/* Margin Kritis */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer active:scale-98 ${
            statusFilter === 'critical'
              ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-400/40'
              : 'bg-white border-suka-brown/10 hover:border-red-500 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'critical' ? 'text-red-100' : 'text-red-700'}`}>
              🔴 Kritis (&gt;45%)
            </span>
            <AlertTriangle className={`w-4 h-4 ${statusFilter === 'critical' ? 'text-white' : 'text-red-600'}`} />
          </div>
          <p className={`text-xl sm:text-2xl font-black font-display ${statusFilter === 'critical' ? 'text-white' : 'text-red-950'}`}>
            {metrics.criticalCount} <span className="text-xs font-bold opacity-80">Menu</span>
          </p>
        </button>
      </div>

      {/* ── Toolbar & Filters ── */}
      <div className="p-4 sm:p-5 bg-white rounded-3xl border border-suka-brown/10 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-brown/40" />
            <input
              type="text"
              placeholder="Cari menu, resep, atau nama bahan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-suka-cream/40 border border-suka-brown/10 rounded-2xl text-xs font-bold text-suka-brown placeholder:text-suka-brown/40 focus:outline-none focus:border-suka-orange transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-brown/40 hover:text-suka-brown"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons: Sort & Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-suka-cream/40 border border-suka-brown/10 rounded-2xl px-3 py-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-suka-brown/50 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-suka-brown outline-none cursor-pointer pr-1"
              >
                <option value="fc_desc">Food Cost Tertinggi (%)</option>
                <option value="fc_asc">Food Cost Terendah (%)</option>
                <option value="margin_asc">Margin Terendah (Rp)</option>
                <option value="margin_desc">Margin Tertinggi (Rp)</option>
                <option value="hpp_desc">HPP Termahal (Rp)</option>
                <option value="name">Nama Menu (A-Z)</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-2.5 rounded-2xl bg-suka-cream/40 hover:bg-suka-cream border border-suka-brown/10 text-suka-brown transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 text-suka-orange ${isRefetching ? 'animate-spin' : ''}`} />
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-suka-brown hover:bg-[#3d3128] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-suka-orange" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-suka-brown/5 pt-3">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-suka-brown text-white shadow-2xs'
                : 'bg-suka-cream/40 text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown'
            }`}
          >
            Semua Kategori ({menuList.length})
          </button>
          {categories.map((cat) => {
            const count = menuList.filter((m) => m.kategori_nama === cat).length
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-suka-brown text-white shadow-2xs'
                    : 'bg-suka-cream/40 text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown'
                }`}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Gagal memuat data HPP menu: {String(error)}</span>
        </div>
      )}

      {/* ── Main Data Table ── */}
      <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-suka-cream/50 border border-suka-brown/10 flex items-center justify-center text-suka-brown/40">
              <ChefHat className="w-7 h-7" />
            </div>
            <p className="font-black text-sm text-suka-brown">Tidak ada menu yang sesuai filter</p>
            <p className="text-xs text-suka-brown/50">Coba ubah kata kunci pencarian atau kategori filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-suka-cream/40 border-b border-suka-brown/10 text-[10px] font-black uppercase tracking-wider text-suka-brown/60">
                  <th className="py-3 px-4">Menu & Kategori</th>
                  <th className="py-3 px-4 text-right">Harga Jual</th>
                  <th className="py-3 px-4 text-right">Total HPP</th>
                  <th className="py-3 px-4 text-right">Gross Margin</th>
                  <th className="py-3 px-4 text-center">Food Cost (%)</th>
                  <th className="py-3 px-4 text-center">Bahan Baku</th>
                  <th className="py-3 px-4 text-center">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/5 font-sans">
                {filteredItems.map((item) => {
                  let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  let badgeText = '🟢 Optimal'
                  if (item.status_food_cost === 'critical') {
                    badgeBg = 'bg-red-50 text-red-800 border-red-200'
                    badgeText = '🔴 Kritis'
                  } else if (item.status_food_cost === 'warning') {
                    badgeBg = 'bg-amber-50 text-amber-800 border-amber-200'
                    badgeText = '🟡 Waspada'
                  }

                  return (
                    <tr
                      key={item.resep_id}
                      onClick={() => setDetailItem(item)}
                      className="hover:bg-suka-cream/20 transition-colors cursor-pointer group"
                    >
                      {/* Menu Name & Category */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-suka-brown text-sm group-hover:text-suka-orange transition-colors">
                          {item.menu_nama}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-suka-cream border border-suka-brown/10 text-suka-brown/70">
                            {item.kategori_nama}
                          </span>
                          <span className="text-[10px] text-suka-brown/40 truncate max-w-[180px]">
                            {item.resep_nama}
                          </span>
                        </div>
                      </td>

                      {/* Harga Jual */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-suka-brown text-xs">
                        {item.harga_jual > 0 ? formatRp(item.harga_jual) : (
                          <span className="text-suka-brown/40 italic">Belum diatur</span>
                        )}
                      </td>

                      {/* Total HPP */}
                      <td className="py-3.5 px-4 text-right font-black text-suka-orange text-sm">
                        {formatRp(item.total_hpp)}
                      </td>

                      {/* Gross Margin */}
                      <td className="py-3.5 px-4 text-right">
                        <div className={`font-black ${item.gross_margin_rp >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {formatRp(item.gross_margin_rp)}
                        </div>
                        <div className="text-[10px] font-bold text-suka-brown/50">
                          {item.gross_margin_pct}% margin
                        </div>
                      </td>

                      {/* Food Cost % */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeBg}`}>
                            {item.food_cost_pct}% ({badgeText})
                          </span>
                          <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.status_food_cost === 'optimal'
                                  ? 'bg-emerald-500'
                                  : item.status_food_cost === 'warning'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(item.food_cost_pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Jumlah Bahan */}
                      <td className="py-3.5 px-4 text-center font-bold text-suka-brown/70 text-xs">
                        {item.ingredients.length} bahan
                      </td>

                      {/* Aksi Button */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailItem(item)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-suka-cream/50 hover:bg-suka-cream text-suka-brown border border-suka-brown/10 rounded-xl text-xs font-bold transition-all shadow-2xs group-hover:border-suka-orange cursor-pointer"
                        >
                          <span>Resep</span>
                          <ChevronRight className="w-3.5 h-3.5 text-suka-orange" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Resep / BOM Modal ── */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl shadow-2xl border border-suka-brown/10 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-suka-cream/60 to-white border-b border-suka-brown/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-suka-orange text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-suka-brown leading-tight">
                      {detailItem.menu_nama}
                    </h3>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-suka-cream border border-suka-brown/10 text-suka-orange">
                      {detailItem.kategori_nama}
                    </span>
                  </div>
                  <p className="text-xs text-suka-brown/60 mt-0.5">
                    Resep: <span className="font-bold text-suka-brown">{detailItem.resep_nama}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-2 rounded-2xl bg-suka-cream/40 hover:bg-suka-cream text-suka-brown transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Financial Summary Bar */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-suka-cream/20 border-b border-suka-brown/10 text-center shrink-0">
              <div className="p-2.5 bg-white rounded-2xl border border-suka-brown/10">
                <p className="text-[9px] font-black uppercase text-suka-brown/50 tracking-wider">Harga Jual</p>
                <p className="text-sm sm:text-base font-black text-suka-brown mt-0.5">
                  {formatRp(detailItem.harga_jual)}
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-2xl border border-suka-brown/10">
                <p className="text-[9px] font-black uppercase text-suka-orange tracking-wider">Total HPP</p>
                <p className="text-sm sm:text-base font-black text-suka-orange mt-0.5">
                  {formatRp(detailItem.total_hpp)}
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-2xl border border-suka-brown/10">
                <p className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Gross Margin</p>
                <p className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">
                  {formatRp(detailItem.gross_margin_rp)} ({detailItem.gross_margin_pct}%)
                </p>
              </div>
            </div>

            {/* Modal Body: Ingredients Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                  <span>Komposisi Bahan Baku ({detailItem.ingredients.length} item)</span>
                </h4>
                <span className="text-[10px] text-suka-brown/60 font-bold">
                  Food Cost Ratio: <span className="font-black text-suka-orange">{detailItem.food_cost_pct}%</span>
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-suka-brown/10 overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-suka-cream/40 border-b border-suka-brown/10 text-[9px] font-black uppercase tracking-wider text-suka-brown/60">
                      <th className="py-2.5 px-3">Bahan Baku</th>
                      <th className="py-2.5 px-3 text-center">Takaran Porsi</th>
                      <th className="py-2.5 px-3 text-right">Harga Beli Vendor</th>
                      <th className="py-2.5 px-3 text-right">Subtotal Biaya</th>
                      <th className="py-2.5 px-3 text-right">Kontribusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-brown/5 font-sans">
                    {detailItem.ingredients.map((ing) => (
                      <tr key={ing.bahan_baku_id} className="hover:bg-suka-cream/20">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-suka-brown text-xs">{ing.nama_bahan}</div>
                          <div className="text-[9px] text-suka-brown/50">
                            Stok ref: {ing.faktor_konversi} {ing.satuan_kecil || ing.satuan_resep}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-suka-brown">
                          {ing.qty_per_porsi} <span className="text-[10px] font-normal text-suka-brown/60">{ing.satuan_resep}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="font-bold text-suka-brown/80">{formatRp(ing.harga_beli_master)}</div>
                          <div className="text-[9px] text-suka-brown/50 font-medium bg-suka-cream/30 inline-block px-1.5 py-0.5 rounded mt-0.5">
                            Rp {ing.biaya_per_satuan_resep.toLocaleString('id-ID', { maximumFractionDigits: 2 })} / {ing.satuan_kecil || ing.satuan_resep}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-suka-orange">
                          {formatRp(ing.subtotal_biaya)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-[10px] font-bold text-suka-brown/70 bg-suka-cream/60 px-1.5 py-0.5 rounded-md border border-suka-brown/10">
                            {ing.kontribusi_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-suka-cream/60 border-t-2 border-suka-brown/10 font-black text-xs">
                      <td colSpan={3} className="py-3 px-3 text-suka-brown uppercase tracking-wider">
                        Total HPP Bahan Baku Per Porsi
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-suka-orange">
                        {formatRp(detailItem.total_hpp)}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-suka-brown">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Informative Note */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Perhitungan HPP ini dihitung secara otomatis berdasarkan takaran baku dalam resep (BOM) dikalikan harga pembelian master bahan baku dari vendor.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-suka-brown/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-5 py-2.5 bg-suka-brown hover:bg-[#3d3128] text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
