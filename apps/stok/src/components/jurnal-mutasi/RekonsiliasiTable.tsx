'use client'

import React, { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Truck,
  TrendingDown,
  TrendingUp,
  Search,
  ArrowUpDown,
  Info,
  Utensils,
  BookOpen,
  Package,
  Store,
} from 'lucide-react'
import type { ReconciliationItem, ReconciliationPeriodInfo, MenuBomBreakdownItem } from '@/app/actions/jurnalMutasi'
import { formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit'
import { nilaiToleransiSelisih } from '@/lib/stok/selisih'
import { DrillDownTimeline } from './DrillDownTimeline'

interface RekonsiliasiTableProps {
  outletId: string
  items: ReconciliationItem[]
  startDate: string
  endDate: string
  period?: ReconciliationPeriodInfo
  menuBreakdown?: MenuBomBreakdownItem[]
  outletName?: string
}

const CATEGORIES = ['ALL', 'FOOD & BEVERAGE', 'BUMBU', 'PACKAGING', 'OPERASIONAL'] as const

const KATEGORI_ORDER: { key: string; label: string }[] = [
  { key: 'FOOD & BEVERAGE', label: '🥩 Food & Beverage' },
  { key: 'BUMBU', label: '🌶️ Bumbu' },
  { key: 'PACKAGING', label: '📦 Packaging' },
  { key: 'OPERASIONAL', label: '📋 Operasional' },
]

export function RekonsiliasiTable({
  outletId,
  items,
  startDate,
  endDate,
  period,
  menuBreakdown,
  outletName,
}: RekonsiliasiTableProps) {
  const isAll = outletId === 'ALL'
  const [viewMode, setViewMode] = useState<'bahan' | 'menu'>('bahan')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedMenuIds, setExpandedMenuIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [onlyVariance, setOnlyVariance] = useState(false)
  const [sortBy, setSortBy] = useState<
    'selisih_rp_desc' | 'nama_asc' | 'pakai_rp_desc' | 'masuk_rp_desc' | 'waste_rp_desc'
  >(isAll ? 'pakai_rp_desc' : 'selisih_rp_desc')

  const effectiveSortBy = isAll && sortBy === 'selisih_rp_desc' ? 'pakai_rp_desc' : sortBy
  const tableColSpan = isAll ? 5 : 10

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const toggleExpandMenu = (id: string) => {
    setExpandedMenuIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAllMenus = () => {
    if (!menuBreakdown) return
    setExpandedMenuIds(new Set(menuBreakdown.map((m) => m.menu_item_id)))
  }

  const collapseAllMenus = () => {
    setExpandedMenuIds(new Set())
  }

  const formatQty = (item: ReconciliationItem, qtySmall: number | null) => {
    if (qtySmall === null) return 'Belum input'
    return formatTriUnitSaldoFromGram(
      qtySmall,
      item.satuan,
      item.satuan_tengah,
      item.faktor_tengah,
      item.satuan_kecil,
      item.faktor_tampilan
    )
  }

  const formatRp = (n: number | null) => {
    if (n === null) return '-'
    return `Rp ${Math.round(n).toLocaleString('id-ID')}`
  }

  // Filter & Sort
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchNama = item.nama.toLowerCase().includes(q)
          const matchKategori = item.kategori?.toLowerCase().includes(q)
          if (!matchNama && !matchKategori) return false
        }

        // Category filter
        if (selectedCategory !== 'ALL' && item.kategori !== selectedCategory) {
          return false
        }

        // Only variance filter (hanya berlaku untuk outlet tunggal)
        if (!isAll && onlyVariance && Math.abs(item.selisih_qty) <= 0.01) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (effectiveSortBy === 'selisih_rp_desc') {
          // Sort by absolute nominal discrepancy descending
          return Math.abs(b.selisih_rp) - Math.abs(a.selisih_rp)
        }
        if (effectiveSortBy === 'pakai_rp_desc') {
          return b.pakai_rp - a.pakai_rp
        }
        if (effectiveSortBy === 'masuk_rp_desc') {
          return b.masuk_rp_master - a.masuk_rp_master
        }
        if (effectiveSortBy === 'waste_rp_desc') {
          return b.waste_rp - a.waste_rp
        }
        return a.nama.localeCompare(b.nama)
      })
  }, [items, searchQuery, selectedCategory, onlyVariance, effectiveSortBy, isAll])

  const filteredTotals = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        acc.masukRp += item.masuk_rp_master || 0
        acc.pakaiRp += item.pakai_rp || 0
        acc.wasteRp += item.waste_rp || 0
        return acc
      },
      { masukRp: 0, pakaiRp: 0, wasteRp: 0 }
    )
  }, [filteredItems])

  // Kelompok kategori sama dengan papan monitoring (CrewList/SPVTable)
  const groupedItems = useMemo(() => {
    const known = new Set(KATEGORI_ORDER.map((c) => c.key))
    const groups = KATEGORI_ORDER.map((c) => ({
      key: c.key,
      label: c.label,
      rows: filteredItems.filter((i) => (i.kategori || '').toUpperCase() === c.key),
    }))
    groups.push({
      key: 'LAINNYA',
      label: '🗂️ Lainnya',
      rows: filteredItems.filter((i) => !known.has((i.kategori || '').toUpperCase())),
    })
    return groups.filter((g) => g.rows.length > 0)
  }, [filteredItems])

  const filteredMenus = useMemo(() => {
    if (!menuBreakdown) return []
    return menuBreakdown.filter((menu) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const matchMenu = menu.menu_item_name.toLowerCase().includes(q)
      const matchIngredient = menu.ingredients.some((ing) => ing.nama_bahan.toLowerCase().includes(q))
      return matchMenu || matchIngredient
    })
  }, [menuBreakdown, searchQuery])

  const totalPorsiTerjual = useMemo(() => {
    return filteredMenus.reduce((sum, m) => sum + m.total_porsi, 0)
  }, [filteredMenus])

  return (
    <div className="space-y-4">
      {/* View Switcher: Bahan Baku vs Tiap Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-suka-brown/10 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-suka-cream/30 rounded-2xl border border-suka-brown/15 w-fit">
          <button
            onClick={() => setViewMode('bahan')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'bahan'
                ? 'bg-white text-suka-brown shadow-2xs'
                : 'text-suka-brown/60 hover:text-suka-brown'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Tabel Bahan Baku ({items.length})</span>
          </button>
          <button
            onClick={() => setViewMode('menu')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'menu'
                ? 'bg-white text-suka-orange shadow-2xs'
                : 'text-suka-brown/60 hover:text-suka-brown'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 text-suka-orange" />
            <span>Pemakaian Bahan Tiap Menu ({menuBreakdown?.length || 0})</span>
          </button>
        </div>

        {outletId === 'ALL' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-[11px] font-black text-orange-950">
            <Store className="w-3.5 h-3.5 text-suka-orange shrink-0" />
            <span>Mode Konsolidasi: {outletName || 'Seluruh Outlet'}</span>
          </div>
        )}
      </div>

      {viewMode === 'menu' ? (
        <div className="space-y-3">
          {/* Menu Overview Header Bar */}
          <div className="bg-white p-4 rounded-3xl border border-suka-brown/10 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Menu / Bahan */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-brown/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama menu POS atau nama bahan baku..."
                  className="w-full pl-9 pr-4 py-2.5 bg-suka-cream/20 border border-suka-brown/15 rounded-2xl text-xs text-suka-brown placeholder:text-suka-brown/40 outline-none focus:border-suka-orange font-medium"
                />
              </div>

              {/* Action Buttons: Buka/Tutup Semua */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAllMenus}
                  className="px-3 py-2 bg-suka-cream/30 hover:bg-suka-cream text-suka-brown border border-suka-brown/15 rounded-xl text-xs font-black cursor-pointer transition-all"
                >
                  Buka Semua Resep
                </button>
                <button
                  type="button"
                  onClick={collapseAllMenus}
                  className="px-3 py-2 bg-suka-cream/30 hover:bg-suka-cream text-suka-brown border border-suka-brown/15 rounded-xl text-xs font-black cursor-pointer transition-all"
                >
                  Tutup Semua
                </button>
              </div>
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-suka-brown/10 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black text-suka-brown/60 uppercase tracking-wider">
                  Ringkasan Penjualan Menu:
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-900">
                  {filteredMenus.length} Menu Terjual
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900">
                  {totalPorsiTerjual.toLocaleString('id-ID')} Total Porsi
                </span>
                {outletId === 'ALL' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900">
                    🏢 Semua Cabang
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-suka-brown/50">
                Resep (BOM) x Qty Porsi = Total Konsumsi Bahan Baku
              </span>
            </div>
          </div>

          {/* List of Menus */}
          {filteredMenus.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center text-suka-brown/50 font-bold italic border border-suka-brown/10">
              Tidak ada data menu POS yang cocok dengan pencarian.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMenus.map((menu) => {
                const isExpanded = expandedMenuIds.has(menu.menu_item_id)
                return (
                  <div
                    key={menu.menu_item_id}
                    className="bg-white rounded-3xl border border-suka-brown/15 shadow-2xs overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => toggleExpandMenu(menu.menu_item_id)}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        isExpanded ? 'bg-suka-cream/25' : 'hover:bg-suka-cream/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-100 text-suka-orange flex items-center justify-center font-black shrink-0 shadow-2xs">
                          <Utensils className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-suka-brown text-sm sm:text-base">
                              {menu.menu_item_name}
                            </h4>
                            {menu.has_recipe ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black border border-emerald-200">
                                ✓ Resep BOM Aktif ({menu.ingredients.length} Bahan)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-black border border-amber-200">
                                ⚠️ Resep Belum Terpasang
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-suka-brown/60 font-semibold mt-0.5">
                            {menu.ingredients.length > 0
                              ? menu.ingredients.map((i) => `${i.nama_bahan} (${i.total_kebutuhan.toLocaleString('id-ID')} ${i.satuan})`).join(' · ')
                              : 'Menu belum memiliki standar resep BOM'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-suka-brown/50 block tracking-wider">
                            Porsi Terjual
                          </span>
                          <span className="text-base sm:text-lg font-black text-suka-brown">
                            {menu.total_porsi.toLocaleString('id-ID')}{' '}
                            <span className="text-xs font-bold text-suka-brown/60">porsi</span>
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-suka-cream/40 flex items-center justify-center text-suka-brown/60">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-suka-orange" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Ingredients Table */}
                    {isExpanded && (
                      <div className="p-4 bg-suka-cream/10 border-t border-suka-brown/10 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-suka-brown">
                            Rincian Kebutuhan Bahan Baku ({menu.menu_item_name})
                          </span>
                          <span className="text-[11px] text-suka-brown/60 font-semibold">
                            Dihitung otomatis: Standar Resep × {menu.total_porsi.toLocaleString('id-ID')} Porsi
                          </span>
                        </div>

                        {menu.ingredients.length > 0 ? (
                          <div className="overflow-x-auto rounded-2xl border border-suka-brown/15 bg-white shadow-2xs">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-suka-brown text-white text-[10px] font-black uppercase tracking-wider">
                                <tr>
                                  <th className="p-3 w-10 text-center">No</th>
                                  <th className="p-3">Bahan Baku</th>
                                  <th className="p-3 text-right">Standar Resep / Porsi</th>
                                  <th className="p-3 text-right">Rumus Perhitungan</th>
                                  <th className="p-3 text-right">Total Pemakaian Bahan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-suka-brown/10">
                                {menu.ingredients.map((ing, iIdx) => (
                                  <tr key={ing.bahan_baku_id} className="hover:bg-blue-50/40">
                                    <td className="p-3 text-center font-bold text-suka-brown/40">{iIdx + 1}</td>
                                    <td className="p-3 font-black text-suka-brown">{ing.nama_bahan}</td>
                                    <td className="p-3 text-right font-semibold text-suka-brown/70">
                                      {ing.qty_per_porsi.toLocaleString('id-ID')} {ing.satuan}
                                    </td>
                                    <td className="p-3 text-right font-medium text-suka-brown/60">
                                      {menu.total_porsi.toLocaleString('id-ID')} porsi × {ing.qty_per_porsi.toLocaleString('id-ID')} {ing.satuan}
                                    </td>
                                    <td className="p-3 text-right font-black text-blue-700 text-sm">
                                      {ing.total_kebutuhan.toLocaleString('id-ID')} {ing.satuan}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              Menu ini belum dipetakan ke resep BOM (Bill of Materials). Silakan konfigurasikan resep menu di halaman HPP Setup Menu agar pemakaian bahan dapat dihitung.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filtering & Quick Controls Bar */}
          <div className="bg-white p-4 rounded-3xl border border-suka-brown/10 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-brown/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama bahan baku atau kategori..."
              className="w-full pl-9 pr-4 py-2.5 bg-suka-cream/20 border border-suka-brown/15 rounded-2xl text-xs text-suka-brown placeholder:text-suka-brown/40 outline-none focus:border-suka-orange font-medium"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Only Discrepancies (hanya ditampilkan untuk cabang spesifik) */}
            {!isAll && (
              <button
                onClick={() => setOnlyVariance(!onlyVariance)}
                className={`px-3.5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  onlyVariance
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-suka-cream/30 text-suka-brown/70 border border-suka-brown/15 hover:bg-suka-cream'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Hanya Berselisih</span>
              </button>
            )}

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-suka-cream/20 border border-suka-brown/15 rounded-2xl px-3 py-1 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-suka-brown/50" />
              <select
                value={effectiveSortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-suka-brown font-bold text-xs outline-none py-1 cursor-pointer"
              >
                {!isAll && <option value="selisih_rp_desc">Sort: Selisih Nominal Terbesar (Rp)</option>}
                <option value="pakai_rp_desc">Sort: Pemakaian POS Tertinggi (Rp)</option>
                <option value="masuk_rp_desc">Sort: Masuk (Inbound) Tertinggi (Rp)</option>
                <option value="waste_rp_desc">Sort: Waste Tertinggi (Rp)</option>
                <option value="nama_asc">Sort: Nama Bahan (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-suka-brown/10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-suka-brown text-white shadow-2xs'
                  : 'bg-suka-cream/20 text-suka-brown/60 hover:bg-suka-cream/50'
              }`}
            >
              {cat === 'ALL' ? 'Semua Kategori' : cat}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-bold text-suka-brown/50 self-center">
            Menampilkan {filteredItems.length} dari {items.length} bahan
          </span>
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse ${isAll ? 'min-w-[680px]' : 'min-w-[1000px]'}`}>
            <thead className="bg-suka-brown text-white text-[10px] font-black uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-10 text-center"></th>
                <th className="p-3.5">Bahan Baku</th>
                {!isAll && <th className="p-3.5 text-right">Saldo Awal</th>}
                <th className="p-3.5 text-right">Masuk (Inbound)</th>
                <th className="p-3.5 text-right">Pemakaian POS</th>
                <th className="p-3.5 text-right">Waste</th>
                {!isAll && (
                  <>
                    <th className="p-3.5 text-right bg-black/10">Stok Sistem</th>
                    <th className="p-3.5 text-right bg-black/10">Fisik Opname</th>
                    <th className="p-3.5 text-right">Selisih (Varian)</th>
                    <th className="p-3.5 text-center">Diagnostik Anomali</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/10 text-xs">
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={tableColSpan} className="py-12 text-center text-suka-brown/50 font-bold italic">
                    Tidak ada bahan baku yang cocok dengan filter.
                  </td>
                </tr>
              )}

              {groupedItems.map((group) => (
                <React.Fragment key={group.key}>
                  <tr className="bg-suka-cream/60">
                    <td colSpan={tableColSpan} className="px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-suka-brown">
                      {group.label}
                      <span className="ml-2 font-bold text-suka-brown/50">{group.rows.length} item</span>
                    </td>
                  </tr>
                  {group.rows.map((item) => {
                const isExpanded = expandedId === item.bahan_baku_id
                const isNegativeDiff = item.selisih_qty < -0.01
                const isPositiveDiff = item.selisih_qty > 0.01
                const toleransi = nilaiToleransiSelisih(
                  item.selisih_qty,
                  item.stok_sistem_qty,
                  item.satuan,
                  item.satuan_kecil,
                  item.nama
                )

                return (
                  <React.Fragment key={item.bahan_baku_id}>
                    <tr
                      onClick={() => toggleExpand(item.bahan_baku_id)}
                      className={`hover:bg-suka-cream/25 transition-colors cursor-pointer select-none ${
                        isExpanded ? 'bg-suka-cream/30' : ''
                      }`}
                    >
                      {/* Expand Arrow */}
                      <td className="p-3 text-center text-suka-brown/50">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 mx-auto text-suka-orange" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mx-auto" />
                        )}
                      </td>

                      {/* Bahan Info */}
                      <td className="p-3">
                        <div className="font-black text-suka-brown text-sm leading-tight">
                          {item.nama}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-suka-brown/60 font-bold">
                          <span className="px-1.5 py-0.5 rounded-md bg-suka-cream text-suka-brown uppercase text-[9px]">
                            {item.kategori}
                          </span>
                          <span>
                            Master: {formatRp(item.harga_beli_master)} / {item.satuan}
                          </span>
                          {item.faktor_tampilan && item.satuan_kecil && (
                            <span>
                              (1 {item.satuan} = {item.faktor_tampilan} {item.satuan_kecil})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Saldo Awal (hanya untuk outlet spesifik) */}
                      {!isAll && (
                        <td className="p-3 text-right">
                          <div className="font-bold text-suka-brown">{formatQty(item, item.saldo_awal_qty)}</div>
                          <div className="text-[10px] font-semibold text-suka-brown/50">
                            {formatRp(item.saldo_awal_rp)}
                          </div>
                        </td>
                      )}

                      {/* Masuk */}
                      <td className="p-3 text-right">
                        <div className="font-bold text-emerald-700">
                          {item.masuk_qty > 0 ? `+${formatQty(item, item.masuk_qty)}` : '0'}
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-700/80">
                          {formatRp(item.masuk_rp_master)}
                        </div>
                        {item.masuk_rp_riil !== null && item.masuk_rp_riil !== item.masuk_rp_master && (
                          <div
                            className="text-[9px] font-bold text-amber-600 truncate"
                            title="Harga pengadaan riil dari Surat Jalan"
                          >
                            Riil: {formatRp(item.masuk_rp_riil)}
                          </div>
                        )}
                        {item.vendor_masuk?.map((v) => (
                          <div
                            key={v.vendor_nama}
                            className="text-[9px] font-bold text-suka-brown/70 truncate"
                            title={`Vendor: ${v.vendor_nama}`}
                          >
                            {v.vendor_nama}: {formatQty(item, v.qty)} · @{formatRp(item.harga_master_kirim)}/{item.satuan_kirim}
                          </div>
                        ))}
                      </td>

                      {/* Pemakaian */}
                      <td className="p-3 text-right">
                        <div className="font-bold text-blue-700">
                          {item.pakai_qty > 0 ? `-${formatQty(item, item.pakai_qty)}` : '0'}
                        </div>
                        <div className="text-[10px] font-semibold text-blue-700/80">
                          {formatRp(item.pakai_rp)}
                        </div>
                        {item.vendor_pakai?.map((v) => (
                          <div
                            key={v.vendor_nama}
                            className="text-[9px] font-bold text-suka-brown/70 truncate"
                            title="Estimasi FIFO berdasarkan surat jalan"
                          >
                            ≈ {v.vendor_nama}: {formatQty(item, v.qty)} · @{formatRp(item.harga_master_kirim)}/{item.satuan_kirim}
                          </div>
                        ))}
                        {item.menu_usages && item.menu_usages.length > 0 && (
                          <div className="mt-1 flex items-center justify-end">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[9px] font-black" title="Klik baris untuk rincian menu">
                              <Utensils className="w-2.5 h-2.5" />
                              <span>{item.menu_usages.length} Menu</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Waste */}
                      <td className="p-3 text-right">
                        <div className="font-bold text-red-600">
                          {item.waste_qty > 0 ? `-${formatQty(item, item.waste_qty)}` : '0'}
                        </div>
                        <div className="text-[10px] font-semibold text-red-600/80">
                          {formatRp(item.waste_rp)}
                        </div>
                      </td>

                      {/* Kolom khusus opname outlet tunggal */}
                      {!isAll && (
                        <>
                          {/* Stok Sistem */}
                          <td className="p-3 text-right bg-suka-cream/20">
                            <div className="font-black text-suka-brown">{formatQty(item, item.stok_sistem_qty)}</div>
                            <div className="text-[10px] font-bold text-suka-brown/60">
                              {formatRp(item.stok_sistem_rp)}
                            </div>
                          </td>

                          {/* Fisik Opname */}
                          <td className="p-3 text-right bg-suka-cream/20">
                            <div className="font-black text-suka-brown">
                              {item.stok_fisik_qty !== null ? formatQty(item, item.stok_fisik_qty) : '-'}
                            </div>
                            <div className="text-[10px] font-bold text-suka-brown/60">
                              {formatRp(item.stok_fisik_rp)}
                            </div>
                          </td>

                          {/* Selisih */}
                          <td className="p-3 text-right">
                            {item.stok_fisik_qty === null ? (
                              <span className="text-suka-brown/40 font-bold">-</span>
                            ) : (
                              <div>
                                <div
                                  className={`font-black flex items-center justify-end gap-1 ${
                                    isNegativeDiff
                                      ? 'text-red-600'
                                      : isPositiveDiff
                                      ? 'text-emerald-700'
                                      : 'text-suka-brown/60'
                                  }`}
                                >
                                  {isNegativeDiff && <TrendingDown className="w-3.5 h-3.5" />}
                                  {isPositiveDiff && <TrendingUp className="w-3.5 h-3.5" />}
                                  <span>
                                    {item.selisih_qty > 0 ? '+' : ''}
                                    {formatQty(item, item.selisih_qty)}
                                  </span>
                                </div>
                                <div
                                  className={`text-[10px] font-black ${
                                    isNegativeDiff
                                      ? 'text-red-700'
                                      : isPositiveDiff
                                      ? 'text-emerald-800'
                                      : 'text-suka-brown/40'
                                  }`}
                                >
                                  {item.selisih_rp > 0 ? '+' : ''}
                                  {formatRp(item.selisih_rp)}
                                </div>
                                {toleransi.dalamToleransi && (
                                  <div
                                    className="mt-0.5 text-[9px] font-black text-emerald-700"
                                    title={`Selisih masih di bawah batas toleransi ${toleransi.thresholdPersen}% dari stok sistem`}
                                  >
                                    ✓ Dalam threshold ({toleransi.thresholdPersen}%)
                                  </div>
                                )}
                                {toleransi.lewatToleransi && (
                                  <div
                                    className="mt-0.5 text-[9px] font-black text-red-700"
                                    title={`Selisih melewati batas toleransi ${toleransi.thresholdPersen}% dari stok sistem`}
                                  >
                                    ! Lewat threshold ({toleransi.thresholdPersen}%)
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Diagnostik Badges */}
                          <td className="p-3 text-center">
                            {item.diagnostics.length > 0 ? (
                              <div className="flex flex-col gap-1 items-center max-w-[220px] mx-auto">
                                {item.diagnostics.map((diag, dIdx) => (
                                  <div
                                    key={dIdx}
                                    className={`w-full text-left px-2 py-1 rounded-lg text-[9px] font-black leading-tight flex items-start gap-1 shadow-2xs ${
                                      diag.severity === 'danger'
                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                        : diag.severity === 'warning'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                        : 'bg-blue-100 text-blue-900 border border-blue-200'
                                    }`}
                                    title={diag.message}
                                  >
                                    {diag.type === 'ANOMALI_SKALA' && (
                                      <AlertCircle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                                    )}
                                    {diag.type === 'NOMINAL_EKSTREM' && (
                                      <AlertTriangle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                                    )}
                                    {diag.type === 'BOM_MISMATCH' && (
                                      <Info className="w-3 h-3 text-amber-700 shrink-0 mt-0.5" />
                                    )}
                                    {diag.type === 'SJ_GANTUNG' && (
                                      <Truck className="w-3 h-3 text-blue-700 shrink-0 mt-0.5" />
                                    )}
                                    <span className="truncate">{diag.message}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700/60 bg-emerald-50 px-2 py-0.5 rounded-full">
                                Normal
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Expansion Panel: Rincian Menu Terjual & Timeline Jurnal */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={tableColSpan} className="p-4 bg-suka-cream/10 border-y border-suka-brown/10 space-y-4">
                          {/* 1. Rincian Pemakaian Menu POS Terjual */}
                          <div className="bg-white rounded-2xl p-4 border border-suka-brown/15 shadow-2xs space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                                  <Utensils className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-black text-suka-brown text-xs">
                                      Rincian Pemakaian Menu POS Terjual ({item.nama})
                                    </h4>
                                    {outletId === 'ALL' && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] font-black border border-amber-200">
                                        🏢 Konsolidasi Semua Cabang
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-suka-brown/60 font-semibold">
                                    Menu yang dipesan kasir dan standar resep (BOM) pemotong stok bahan ini selama periode audit.
                                  </p>
                                </div>
                              </div>
                              {item.menu_usages && item.menu_usages.length > 0 && (
                                <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 self-start sm:self-auto">
                                  Total Resep: {item.menu_usages.reduce((acc, m) => acc + m.total_pemakaian, 0).toLocaleString('id-ID')} {item.satuan_kecil || item.satuan}
                                </span>
                              )}
                            </div>

                            {item.menu_usages && item.menu_usages.length > 0 ? (
                              <div className="overflow-x-auto rounded-xl border border-suka-brown/10">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-suka-cream/40 text-[9px] font-black text-suka-brown uppercase tracking-wider">
                                    <tr>
                                      <th className="p-2.5">Menu Terjual</th>
                                      <th className="p-2.5 text-right">Porsi Terjual</th>
                                      <th className="p-2.5 text-right">Standar Resep / Porsi</th>
                                      <th className="p-2.5 text-right">Total Kebutuhan Bahan</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-suka-brown/10">
                                    {item.menu_usages.map((usage, uIdx) => (
                                      <tr key={uIdx} className="hover:bg-blue-50/40">
                                        <td className="p-2.5 font-bold text-suka-brown flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                          {usage.menu_item_name}
                                        </td>
                                        <td className="p-2.5 text-right font-black text-suka-brown">
                                          {usage.porsi_terjual.toLocaleString('id-ID')} porsi
                                        </td>
                                        <td className="p-2.5 text-right font-semibold text-suka-brown/70">
                                          {usage.qty_per_porsi.toLocaleString('id-ID')} {usage.satuan}
                                        </td>
                                        <td className="p-2.5 text-right font-black text-blue-700">
                                          {usage.total_pemakaian.toLocaleString('id-ID')} {usage.satuan}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>
                                  Belum ada penjualan menu kasir POS yang memotong bahan baku ini pada periode ini (atau menu belum dipetakan ke resep BOM).
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 2. Collapsible Timeline Buku Jurnal */}
                          <details className="group rounded-2xl bg-white border border-suka-brown/15 shadow-2xs overflow-hidden">
                            <summary className="p-3 text-xs font-black text-suka-brown cursor-pointer flex items-center justify-between hover:bg-suka-cream/20 select-none">
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-suka-orange" />
                                <span>📜 Buka Buku Jurnal Mutasi Kronologis (Running Balance Transaksi)</span>
                              </div>
                              <ChevronDown className="w-4 h-4 text-suka-brown/50 group-open:rotate-180 transition-transform" />
                            </summary>
                            <div className="p-0 border-t border-suka-brown/10">
                              <DrillDownTimeline
                                outletId={outletId}
                                item={item}
                                startDate={startDate}
                                endDate={endDate}
                                period={period}
                              />
                            </div>
                          </details>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
                </React.Fragment>
              ))}
            </tbody>
            {isAll && filteredItems.length > 0 && (
              <tfoot className="bg-suka-cream/40 border-t-2 border-suka-brown/20 text-xs font-black">
                <tr>
                  <td className="p-3.5"></td>
                  <td className="p-3.5 text-suka-brown uppercase tracking-wider">
                    Total Nilai ({filteredItems.length} Bahan Baku)
                  </td>
                  <td className="p-3.5 text-right text-emerald-700">
                    +{formatRp(filteredTotals.masukRp)}
                  </td>
                  <td className="p-3.5 text-right text-blue-700">
                    -{formatRp(filteredTotals.pakaiRp)}
                  </td>
                  <td className="p-3.5 text-right text-red-600">
                    -{formatRp(filteredTotals.wasteRp)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )}
</div>
  )
}
