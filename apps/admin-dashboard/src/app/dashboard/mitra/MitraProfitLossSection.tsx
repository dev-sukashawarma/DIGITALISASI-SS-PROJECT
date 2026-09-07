'use client'

import React, { useState } from 'react'
import { 
  Store, 
  Utensils, 
  ShoppingBag, 
  ChevronRight, 
  X, 
  TrendingDown, 
  TrendingUp, 
  Layers, 
  Receipt
} from 'lucide-react'
import { PeriodFilter } from '@/components/PeriodFilter'
import type { ComprehensiveMitraPnl, OpexCategoryDetail } from '@/app/actions/mitraPnl'

const formatRp = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num || 0)
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export const formatCategoryTitle = (rawName?: string): string => {
  if (!rawName) return 'Biaya Operasional'
  const trimmed = rawName.trim()
  const lower = trimmed.toLowerCase()

  if (lower === 'bb' || lower === 'bahan_baku' || lower === 'bahan baku') {
    return 'Bahan Habis Pakai & Operasional Harian'
  }
  if (lower === 'outlet' || lower === 'pengeluaran_outlet' || lower === 'operasional_outlet') {
    return 'Operasional & Perlengkapan Outlet'
  }
  if (lower === 'overtime') {
    return 'Gaji, Lembur & Upah Crew'
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .map(word => {
      const wLower = word.toLowerCase()
      if (['dan', 'di', 'ke', 'per', 'atau'].includes(wLower)) return wLower
      if (['pos', 'qris', 'pks', 'nik', 'ktp', 'bep', 'hpp', 'pln', 'pdam', 'opex'].includes(wLower)) return wLower.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

interface MitraProfitLossSectionProps {
  pnlData: ComprehensiveMitraPnl
  currentFilter: any
  onFilterChange: (newFilter: any) => void
  isLoading?: boolean
  outlets?: { id: string; name: string }[]
}

export function MitraProfitLossSection({
  pnlData,
  currentFilter,
  onFilterChange,
  isLoading = false,
  outlets = []
}: MitraProfitLossSectionProps) {
  const [activeDrilldown, setActiveDrilldown] = useState<'pos' | 'foodapps' | 'tiktok' | 'opex' | 'netprofit' | null>(null)
  const [selectedOpexCategory, setSelectedOpexCategory] = useState<OpexCategoryDetail | null>(null)

  const { summary, channels, opex, profitSharingPct, outletName } = pnlData

  let filterText = 'Semua Waktu'
  if (currentFilter.from && currentFilter.to) {
    filterText = `${formatDate(currentFilter.from)} - ${formatDate(currentFilter.to)}`
  } else if (currentFilter.from) {
    filterText = `Sejak ${formatDate(currentFilter.from)}`
  }

  const isDeficit = summary.netProfit <= 0

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-amber-200/70 p-6 sm:p-8 rounded-3xl shadow-xs relative overflow-hidden mt-6 animate-fade-in">
      <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full mb-2.5 border border-amber-200/70">
            <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-900 tracking-wider uppercase">
              Laporan Keuangan Real-Time
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1D16] tracking-tight">
            Laba Rugi Operasional ({outletName})
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1.5">
            <p className="text-[#6E5A4E] font-normal text-sm">
              Perhitungan laba bersih & bagi hasil transparan berdasarkan data riil
            </p>
            <span className="hidden sm:inline text-gray-300">•</span>
            <div className="inline-flex items-center gap-1.5 bg-[#FAF7F2] border border-amber-200/70 text-[#6E5A4E] text-xs px-2.5 py-1 rounded-lg font-medium shadow-xs w-fit">
              <Store className="w-3.5 h-3.5 text-amber-600" />
              {filterText}
            </div>
          </div>
        </div>

        {onFilterChange && (
          <div className="flex-shrink-0 z-20 w-full md:w-auto">
            <PeriodFilter
              value={currentFilter}
              onChange={onFilterChange}
              outlets={outlets}
              hideSource
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="h-64 flex items-center justify-center">
          <div className="flex items-center gap-3 text-amber-600 font-semibold">
            <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            <span>Memuat rincian laporan keuangan...</span>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* WATERFALL SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 mb-6 relative z-10">
            {/* 1. Gross Revenue */}
            <div className="bg-[#FAF7F2] border border-amber-200/60 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">
                  1. Omzet Kotor
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-bold text-[#2A1D16] tracking-tight tabular-nums truncate">
                  {formatRp(summary.grossRevenue)}
                </h3>
                <p className="text-xs text-[#8C7566] font-normal mt-1">
                  Total transaksi seluruh channel
                </p>
              </div>
            </div>

            {/* 2. COGS & Deductions */}
            <div className="bg-[#FAF7F2] border border-amber-200/60 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">
                  2. HPP & Potongan
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-bold text-orange-600 tracking-tight tabular-nums truncate">
                  -{formatRp(summary.totalCogs + summary.totalDeductions)}
                </h3>
                <p className="text-xs text-[#8C7566] font-normal mt-1">
                  Food Cost & Potongan Merchant
                </p>
              </div>
            </div>

            {/* 3. Total OPEX & Waste */}
            <div 
              onClick={() => setActiveDrilldown('opex')}
              className="group cursor-pointer bg-[#FAF7F2] border border-amber-200/60 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-red-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">
                  3. Biaya Operasional (OPEX)
                </span>
                <div className="flex items-center gap-1 text-red-500 text-xs font-semibold">
                  <span>Detail</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-bold text-red-500 tracking-tight tabular-nums truncate">
                  -{formatRp(summary.totalOpex + summary.totalWaste)}
                </h3>
                <p className="text-xs text-[#8C7566] font-normal mt-1">
                  Gaji, Listrik, Gas, Petty Cash
                </p>
              </div>
            </div>

            {/* 4. Net Profit & Bagi Hasil */}
            <div 
              onClick={() => setActiveDrilldown('netprofit')}
              className={`group cursor-pointer p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all duration-300 ${
                isDeficit 
                  ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white' 
                  : 'bg-gradient-to-br from-[#38261C] to-[#251A14] text-white'
              }`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">
                    4. Bagi Hasil Mitra ({profitSharingPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-1 text-white/70 text-xs font-semibold bg-white/10 px-2 py-0.5 rounded-full">
                  <span>Rincian</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div className="relative z-10">
                <h3 className={`text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-bold tracking-tight tabular-nums truncate ${isDeficit ? 'text-amber-400' : 'text-amber-400'}`}>
                  {formatRp(summary.mitraShare)}
                </h3>
                <div className="flex items-center justify-between text-xs text-white/80 mt-1 font-medium">
                  <span>Net Profit Outlet:</span>
                  <span className={summary.netProfit < 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {formatRp(summary.netProfit)}
                  </span>
                </div>
                {(summary.managementFeeAmount || 0) > 0 ? (
                  <div className="text-[10px] text-amber-300 font-normal mt-0.5">
                    *Telah dipotong Mgmt Fee {summary.managementFeePct}% ({formatRp(summary.managementFeeAmount || 0)})
                  </div>
                ) : (
                  <div className="text-[10px] text-emerald-300 font-normal mt-0.5">
                    *Bebas Fee Manajemen (0%) - Sudah BEP 100%
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CHANNEL BREAKDOWN SECTION */}
          <div className="relative z-10 border-t border-amber-100 pt-6 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-[#8C7566] uppercase tracking-wider flex items-center gap-2">
                <span>Gross Profit per Channel Penjualan</span>
                <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  Klik untuk Detail
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Channel 1: POS Kasir */}
              <div
                onClick={() => setActiveDrilldown('pos')}
                className="group cursor-pointer bg-[#FAF7F2] border border-amber-200/60 p-5 rounded-2xl hover:shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2A1D16] text-sm">POS Kasir & QRIS</h4>
                    <p className="text-xs text-[#6E5A4E] font-normal">
                      Omzet: {formatRp(channels.pos.revenue)} ({channels.pos.orderCount} Order)
                    </p>
                  </div>
                </div>

                <div className="flex items-end justify-between mt-auto pt-3 border-t border-amber-200/50">
                  <div>
                    <span className="text-[10px] text-[#8C7566] font-semibold uppercase tracking-wider block">
                      Gross Profit
                    </span>
                    <span className="font-bold text-base text-amber-700 tabular-nums">
                      {formatRp(channels.pos.grossProfit)}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
                </div>
              </div>

              {/* Channel 2: Food Apps */}
              <div
                onClick={() => setActiveDrilldown('foodapps')}
                className="group cursor-pointer bg-[#FAF7F2] border border-amber-200/60 p-5 rounded-2xl hover:shadow-sm hover:border-green-300 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2A1D16] text-sm">Food Apps Delivery</h4>
                    <p className="text-xs text-[#6E5A4E] font-normal">
                      Grab, GoFood, Shopee ({channels.foodApps.orderCount} Order)
                    </p>
                  </div>
                </div>

                <div className="flex items-end justify-between mt-auto pt-3 border-t border-amber-200/50">
                  <div>
                    <span className="text-[10px] text-[#8C7566] font-semibold uppercase tracking-wider block">
                      Gross Profit
                    </span>
                    <span className="font-bold text-base text-green-700 tabular-nums">
                      {formatRp(channels.foodApps.grossProfit)}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                </div>
              </div>

              {/* Channel 3: TikTok GO */}
              <div
                onClick={() => setActiveDrilldown('tiktok')}
                className="group cursor-pointer bg-[#FAF7F2] border border-amber-200/60 p-5 rounded-2xl hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2A1D16] text-sm">TikTok GO</h4>
                    <p className="text-xs text-[#6E5A4E] font-normal">
                      Omzet: {formatRp(channels.tiktok.revenue)} ({channels.tiktok.orderCount} Order)
                    </p>
                  </div>
                </div>

                <div className="flex items-end justify-between mt-auto pt-3 border-t border-amber-200/50">
                  <div>
                    <span className="text-[10px] text-[#8C7566] font-semibold uppercase tracking-wider block">
                      Gross Profit
                    </span>
                    <span className="font-bold text-base text-slate-800 tabular-nums">
                      {formatRp(channels.tiktok.grossProfit)}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-slate-800 transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* OPEX CATEGORIES BREAKDOWN ROW */}
          <div className="relative z-10 border-t border-amber-100 pt-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-semibold text-[#8C7566] uppercase tracking-wider">
                  Rincian Biaya Operasional Riil (OPEX)
                </h3>
                <p className="text-xs text-[#6E5A4E] font-normal mt-0.5">
                  Total Kas Kecil: <span className="font-semibold text-[#2A1D16]">{formatRp(opex.totalPettyCash)}</span> • Biaya Bulanan: <span className="font-semibold text-[#2A1D16]">{formatRp(opex.totalMonthly)}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {opex.categories.map((cat, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedOpexCategory(cat)
                    setActiveDrilldown('opex')
                  }}
                  className="group cursor-pointer bg-[#FAF7F2] p-3.5 rounded-2xl border border-amber-200/50 hover:border-amber-300 hover:shadow-xs transition-all flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <h5 className="font-semibold text-xs text-[#2A1D16] truncate group-hover:text-amber-700 transition-colors">
                      {formatCategoryTitle(cat.category)}
                    </h5>
                    <span className="text-[11px] text-[#8C7566] font-normal">
                      {cat.items.length} transaksi
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-1">
                    <span className="font-bold text-xs text-red-500 tabular-nums">
                      -{formatRp(cat.amount)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-600 transition-colors" />
                  </div>
                </div>
              ))}

              {opex.categories.length === 0 && (
                <div className="col-span-full p-6 text-center text-xs text-[#8C7566] bg-[#FAF7F2] rounded-2xl font-normal">
                  Tidak ada catatan biaya operasional pada periode ini.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* DRILLDOWN MODAL */}
      {activeDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div
            className="absolute inset-0 bg-[#2A1D16]/60 backdrop-blur-xs"
            onClick={() => {
              setActiveDrilldown(null)
              setSelectedOpexCategory(null)
            }}
          />

          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 p-6 sm:p-8 border border-amber-100 max-h-[85vh] flex flex-col">
            <button
              onClick={() => {
                setActiveDrilldown(null)
                setSelectedOpexCategory(null)
              }}
              className="absolute top-5 right-5 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Drilldown: POS Kasir */}
            {activeDrilldown === 'pos' && (
              <>
                <h3 className="text-lg font-bold text-[#2A1D16] mb-1">Detail POS Kasir & Offline</h3>
                <p className="text-xs text-[#6E5A4E] mb-5 font-normal">Transaksi kasir, takeaway, dine-in, dan QRIS outlet</p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between p-3.5 bg-gray-50 rounded-xl font-semibold">
                    <span className="text-[#6E5A4E]">Omzet Kotor POS</span>
                    <span className="text-[#2A1D16] font-bold text-sm">{formatRp(channels.pos.revenue)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 px-2 border-b border-dashed border-gray-200">
                    <span className="text-red-500 font-medium">COGS / HPP Bahan Baku</span>
                    <span className="text-red-500 font-semibold">-{formatRp(channels.pos.cogs)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 px-2 border-b border-dashed border-gray-200">
                    <span className="text-red-500 font-medium">Potongan Merchant</span>
                    <span className="text-red-500 font-semibold">-{formatRp(channels.pos.deductions)}</span>
                  </div>
                  <div className="flex justify-between p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 font-bold">
                    <span className="text-amber-950">Gross Profit POS</span>
                    <span className="text-amber-700 text-sm">{formatRp(channels.pos.grossProfit)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Drilldown: Food Apps */}
            {activeDrilldown === 'foodapps' && (
              <>
                <h3 className="text-lg font-bold text-[#2A1D16] mb-1">Detail Food Delivery Apps</h3>
                <p className="text-xs text-[#6E5A4E] mb-5 font-normal">Omzet online GrabFood, GoFood, dan ShopeeFood</p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between p-3.5 bg-gray-50 rounded-xl font-semibold">
                    <span className="text-[#6E5A4E]">Omzet Kotor Food Apps</span>
                    <span className="text-[#2A1D16] font-bold text-sm">{formatRp(channels.foodApps.revenue)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 px-2 border-b border-dashed border-gray-200">
                    <span className="text-red-500 font-medium">COGS / HPP Bahan Baku</span>
                    <span className="text-red-500 font-semibold">-{formatRp(channels.foodApps.cogs)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 px-2 border-b border-dashed border-gray-200">
                    <span className="text-red-500 font-medium">Potongan Merchant</span>
                    <span className="text-red-500 font-semibold">-{formatRp(channels.foodApps.deductions)}</span>
                  </div>
                  <div className="flex justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 font-bold">
                    <span className="text-emerald-950">Gross Profit Food Apps</span>
                    <span className="text-emerald-700 text-sm">{formatRp(channels.foodApps.grossProfit)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Drilldown: TikTok */}
            {activeDrilldown === 'tiktok' && (
              <>
                <h3 className="text-lg font-bold text-[#2A1D16] mb-1">Detail TikTok GO</h3>
                <p className="text-xs text-[#6E5A4E] mb-5 font-normal">Penjualan voucher dan order TikTok Live / Go</p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between p-3.5 bg-gray-50 rounded-xl font-semibold">
                    <span className="text-[#6E5A4E]">Omzet Kotor TikTok GO</span>
                    <span className="text-[#2A1D16] font-bold text-sm">{formatRp(channels.tiktok.revenue)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 px-2 border-b border-dashed border-gray-200">
                    <span className="text-red-500 font-medium">COGS / HPP Bahan Baku</span>
                    <span className="text-red-500 font-semibold">-{formatRp(channels.tiktok.cogs)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 px-2 border-b border-dashed border-gray-200">
                    <span className="text-red-500 font-medium">Potongan Merchant</span>
                    <span className="text-red-500 font-semibold">-{formatRp(channels.tiktok.deductions)}</span>
                  </div>
                  <div className="flex justify-between p-3.5 bg-slate-100 rounded-xl border border-slate-200 font-bold">
                    <span className="text-slate-900">Gross Profit TikTok GO</span>
                    <span className="text-slate-800 text-sm">{formatRp(channels.tiktok.grossProfit)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Drilldown: OPEX */}
            {activeDrilldown === 'opex' && (
              <>
                <h3 className="text-lg font-bold text-[#2A1D16] mb-1">
                  {selectedOpexCategory ? `Kategori: ${formatCategoryTitle(selectedOpexCategory.category)}` : 'Rincian Pengeluaran Operasional'}
                </h3>
                <p className="text-xs text-[#6E5A4E] mb-4 font-normal">
                  {selectedOpexCategory 
                    ? `Total: ${formatRp(selectedOpexCategory.amount)} (${selectedOpexCategory.items.length} item nota)`
                    : `Total OPEX: ${formatRp(summary.totalOpex)}`
                  }
                </p>

                <div className="overflow-y-auto max-h-[50vh] space-y-2 pr-1">
                  {(selectedOpexCategory ? selectedOpexCategory.items : opex.categories.flatMap(c => c.items)).map((item: any, idx: number) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-[#2A1D16] block truncate">
                          {formatCategoryTitle(item.description || item.category || 'Biaya Operasional')}
                        </span>
                        <span className="text-[11px] text-gray-500 font-normal">
                          {formatDate(item.expense_date || item.date)} • {item.source === 'petty_cash' ? 'Kas Kecil Outlet' : 'Biaya Bulanan Pusat'}
                        </span>
                      </div>
                      <span className="font-bold text-red-500 shrink-0 text-xs">
                        -{formatRp(item.amount)}
                      </span>
                    </div>
                  ))}

                  {(selectedOpexCategory ? selectedOpexCategory.items : opex.categories).length === 0 && (
                    <div className="p-8 text-center text-xs text-gray-400 font-normal">
                      Tidak ada detail transaksi pengeluaran.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Drilldown: Net Profit */}
            {activeDrilldown === 'netprofit' && (
              <>
                <h3 className="text-lg font-bold text-[#2A1D16] mb-1">Kalkulasi Pembagian Hasil Mitra</h3>
                <p className="text-xs text-[#6E5A4E] mb-5 font-normal">Formula transparan pembagian laba bersih dari omzet hingga bagi hasil</p>

                <div className="space-y-3 text-xs">
                  {/* Step 1: Waterfall Pendapatan Kotor -> Bersih -> Gross Profit */}
                  <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-amber-200/70 space-y-2.5">
                    <div className="flex justify-between items-center text-[#2A1D16] font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-amber-600" />
                        <span>1. Total Omzet Kotor (Gross Sales)</span>
                      </span>
                      <span className="text-[#2A1D16] font-bold text-sm">{formatRp(summary.grossRevenue)}</span>
                    </div>

                    <div className="flex justify-between items-center text-red-500 pl-5 text-[11px]">
                      <span>2. Potongan Merchant</span>
                      <span className="font-semibold">-{formatRp(summary.totalDeductions)}</span>
                    </div>

                    <div className="flex justify-between items-center text-amber-900 pl-5 text-[11px] pb-2 border-b border-dashed border-amber-200/80">
                      <span>3. Total HPP / Bahan Baku (COGS)</span>
                      <span className="font-semibold text-red-600">-{formatRp(summary.totalCogs)}</span>
                    </div>

                    {/* Gross Profit Result */}
                    <div className="flex justify-between items-center pt-0.5 font-bold text-xs">
                      <span className="text-[#2A1D16] flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>= Gross Profit Seluruh Channel</span>
                      </span>
                      <span className="text-emerald-700 font-bold text-sm">{formatRp(summary.grossProfit)}</span>
                    </div>

                    {/* Channel Contribution Sub-breakdown */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200/50 text-[10px]">
                      <div className="bg-white/90 p-2 rounded-xl border border-amber-200/50 text-center">
                        <span className="text-[#8C7566] block font-medium">POS Kasir</span>
                        <span className="font-bold text-[#2A1D16]">{formatRp(channels.pos.grossProfit)}</span>
                      </div>
                      <div className="bg-white/90 p-2 rounded-xl border border-amber-200/50 text-center">
                        <span className="text-[#8C7566] block font-medium">Food Delivery</span>
                        <span className="font-bold text-[#2A1D16]">{formatRp(channels.foodApps.grossProfit)}</span>
                      </div>
                      <div className="bg-white/90 p-2 rounded-xl border border-amber-200/50 text-center">
                        <span className="text-[#8C7566] block font-medium">TikTok GO</span>
                        <span className="font-bold text-[#2A1D16]">{formatRp(channels.tiktok.grossProfit)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Pengurangan Biaya Operasional */}
                  <div className="space-y-1.5 px-1">
                    <div className="flex justify-between py-1.5 px-2 border-b border-dashed border-gray-200">
                      <span className="text-red-500 font-medium">4. Total OPEX (Kas Kecil + Bulanan)</span>
                      <span className="text-red-500 font-semibold">-{formatRp(summary.totalOpex)}</span>
                    </div>

                    <div className="flex justify-between py-1.5 px-2 border-b border-dashed border-gray-200">
                      <span className="text-red-500 font-medium">5. Kerugian Bahan Rusak / Waste</span>
                      <span className="text-red-500 font-semibold">-{formatRp(summary.totalWaste)}</span>
                    </div>

                    {(summary.managementFeeAmount || 0) > 0 ? (
                      <div className="flex justify-between py-1.5 px-2 border-b border-dashed border-amber-200 bg-amber-50/50 rounded-lg">
                        <span className="text-amber-800 font-medium">
                          6. Management Fee Pusat {outletName.includes('Semua') ? `(${summary.managementFeePct}% Gabungan)` : `(${summary.managementFeePct}%)`}
                        </span>
                        <span className="text-amber-700 font-semibold">-{formatRp(summary.managementFeeAmount || 0)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between py-1.5 px-2 border-b border-dashed border-emerald-200 bg-emerald-50/50 rounded-lg">
                        <span className="text-emerald-800 font-medium">
                          6. Management Fee Pusat (0% - Bebas Fee BEP 100%)
                        </span>
                        <span className="text-emerald-700 font-semibold">Rp 0</span>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Net Profit Outlet */}
                  <div className="flex justify-between p-3.5 bg-gray-100 rounded-2xl font-bold">
                    <span className="text-[#2A1D16]">= Laba Bersih Outlet (Net Profit)</span>
                    <span className={`text-sm ${summary.netProfit < 0 ? 'text-red-500' : 'text-emerald-700'}`}>
                      {formatRp(summary.netProfit)}
                    </span>
                  </div>

                  {/* Step 4: Jatah Bagi Hasil Mitra */}
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-1">
                    <div className="flex justify-between font-bold text-amber-950">
                      <span>Jatah Bagi Hasil Mitra ({profitSharingPct}%)</span>
                      <span className="text-amber-700 text-sm">{formatRp(summary.mitraShare)}</span>
                    </div>
                    <p className="text-[11px] text-[#6E5A4E] font-normal leading-relaxed">
                      {summary.netProfit > 0 
                        ? (profitSharingPct === 100 
                            ? 'Outlet belum BEP: Keuntungan 100% dialokasikan untuk mitra demi percepatan pengembalian modal investasi.'
                            : (profitSharingPct === 50 
                                ? 'Outlet telah mencapai 100% BEP: Pembagian hasil proporsional 50% Mitra dan 50% Pusat.'
                                : `Mitra berhak menerima ${profitSharingPct}% dari laba bersih outlet periode ini.`
                              )
                          )
                        : 'Outlet dalam posisi defisit pada periode ini, tidak ada kewajiban transfer bagi hasil.'
                      }
                    </p>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
