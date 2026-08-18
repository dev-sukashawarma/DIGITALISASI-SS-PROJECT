import React from 'react'
import { Search, Filter, Calendar, Download, RefreshCw, X } from 'lucide-react'

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
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              aria-label="Filter Kategori"
              className="appearance-none bg-suka-cream/40 border border-suka-brown/10 text-xs font-black text-suka-brown py-2.5 pl-3.5 pr-8 rounded-2xl focus:outline-none focus:border-suka-orange cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-suka-brown/40 pointer-events-none" />
          </div>

          {/* Filter Rentang Hari */}
          <div className="relative">
            <select
              value={daysFilter === null ? 'all' : String(daysFilter)}
              onChange={(e) => {
                const val = e.target.value
                onDaysFilterChange(val === 'all' ? null : Number(val))
              }}
              aria-label="Filter Rentang Waktu PO"
              className="appearance-none bg-suka-cream/40 border border-suka-brown/10 text-xs font-black text-suka-brown py-2.5 pl-3.5 pr-8 rounded-2xl focus:outline-none focus:border-suka-orange cursor-pointer"
            >
              <option value="7">7 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
              <option value="90">90 Hari Terakhir</option>
              <option value="all">Semua Riwayat</option>
            </select>
            <Calendar className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-suka-brown/40 pointer-events-none" />
          </div>

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
          { id: 'all', label: 'Semua Status' },
          { id: 'naik', label: '🔺 Harga Naik' },
          { id: 'turun', label: '🔻 Harga Turun' },
          { id: 'stabil', label: '➖ Harga Tetap' }
        ].map((tab) => {
          const isActive = statusFilter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusFilterChange(tab.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-suka-orange text-white shadow-2xs'
                  : 'bg-suka-cream/50 text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
