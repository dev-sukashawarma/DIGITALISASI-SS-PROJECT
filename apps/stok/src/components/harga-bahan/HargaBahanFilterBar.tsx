import React from 'react'
import { Search, Filter, Calendar, Download, RefreshCw, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Select } from '@suka/design-system'

interface HargaBahanFilterBarProps {
  search: string
  onSearchChange: (val: string) => void
  selectedCategory: string
  onCategoryChange: (cat: string) => void
  categories: string[]
  statusFilter: 'all' | 'naik' | 'turun' | 'stabil'
  onStatusFilterChange: (status: 'all' | 'naik' | 'turun' | 'stabil') => void
  daysFilter: number | null
  onDaysFilterChange: (days: number | null) => void
  onExportCsv: () => void
  onRefresh: () => void
  isRefreshing?: boolean
}

export function HargaBahanFilterBar({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  statusFilter,
  onStatusFilterChange,
  daysFilter,
  onDaysFilterChange,
  onExportCsv,
  onRefresh,
  isRefreshing = false
}: HargaBahanFilterBarProps) {
  return (
    <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-xs p-4 md:p-5 space-y-4">
      {/* Baris 1: Search, Kategori, Rentang Hari, Refresh & Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-brown/40" />
          <input
            type="text"
            placeholder="Cari bahan baku, SKU, atau supplier..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 text-xs font-bold text-suka-brown bg-suka-cream/40 border border-suka-brown/10 rounded-2xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all placeholder:text-suka-brown/40"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-suka-brown/40 hover:text-suka-brown rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Kategori Dropdown */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedCategory}
            onChange={onCategoryChange}
            aria-label="Filter Kategori"
            leadingIcon={<Filter className="w-3.5 h-3.5" />}
            searchPlaceholder="Cari kategori..."
            className="min-w-[165px]"
            triggerClassName="bg-suka-cream/40 border-suka-brown/10 font-black rounded-2xl shadow-none"
            options={[
              { value: 'all', label: 'Semua Kategori' },
              ...categories.map((cat) => ({ value: cat, label: cat })),
            ]}
          />

          {/* Filter Rentang Hari */}
          <Select
            value={daysFilter === null ? 'all' : String(daysFilter)}
            onChange={(val) => {
              onDaysFilterChange(val === 'all' ? null : Number(val))
            }}
            aria-label="Filter Rentang Waktu PO"
            leadingIcon={<Calendar className="w-3.5 h-3.5" />}
            className="min-w-[160px]"
            triggerClassName="bg-suka-cream/40 border-suka-brown/10 font-black rounded-2xl shadow-none"
            options={[
              { value: '7', label: '7 Hari Terakhir' },
              { value: '30', label: '30 Hari Terakhir' },
              { value: '90', label: '90 Hari Terakhir' },
              { value: 'all', label: 'Semua Riwayat' },
            ]}
          />

          {/* Tombol Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Muat ulang data"
            className="p-2.5 rounded-2xl border border-suka-brown/10 bg-white hover:bg-suka-cream/50 text-suka-brown transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-suka-orange' : ''}`} />
          </button>

          {/* Tombol Export CSV */}
          <button
            type="button"
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#701604] hover:bg-[#87200a] text-white text-xs font-black rounded-2xl transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Baris 2: Quick Status Pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pt-1 border-t border-suka-brown/5">
        <span className="text-[11px] font-bold text-suka-brown/50 uppercase tracking-wider shrink-0 mr-1">
          Status:
        </span>
        {[
          { id: 'all', label: 'Semua Status', icon: null },
          { id: 'naik', label: 'Harga Naik', icon: TrendingUp },
          { id: 'turun', label: 'Harga Turun', icon: TrendingDown },
          { id: 'stabil', label: 'Harga Tetap', icon: Minus }
        ].map((tab) => {
          const isActive = statusFilter === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusFilterChange(tab.id as any)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-suka-orange text-white shadow-2xs'
                  : 'bg-suka-cream/50 text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
