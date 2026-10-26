'use client'

import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Search, ChevronDown, ChevronUp, Receipt, Building2, Coins, TrendingDown, Layers } from 'lucide-react'
import { rupiah, pct } from '@/lib/format'

export type CategorySlice = {
  name: string
  value: number
  color: string
  categoryKey: string
}

interface ExpenseDistributionChartProps {
  byCategory: CategorySlice[]
  totalOutlet: number
  amountBulanan?: number
  amountPettyCash?: number
  totalWaste?: number
  includeWaste?: boolean
}

export function ExpenseDistributionChart({
  byCategory = [],
  totalOutlet = 0,
  amountBulanan = 0,
  amountPettyCash = 0,
  totalWaste = 0,
  includeWaste = false,
}: ExpenseDistributionChartProps) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Empty state
  if (byCategory.length === 0 || totalOutlet === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center text-suka-gray-400">
        <div className="w-12 h-12 rounded-2xl bg-suka-cream flex items-center justify-center mb-3">
          <Receipt className="w-6 h-6 text-suka-gray-400" />
        </div>
        <p className="font-bold text-suka-ink text-sm">Tidak ada transaksi pengeluaran</p>
        <p className="text-xs text-suka-gray-400 mt-1 max-w-sm">
          Belum ada catatan pengeluaran operasional pada periode dan unit yang dipilih.
        </p>
      </div>
    )
  }

  // Siapkan data Donut Chart: Top 5 Kategori + 1 Sektor 'Kategori Lainnya'
  // Menghindari 14 slice pelangi berantakan yang sulit di-hover
  const donutData = useMemo(() => {
    if (byCategory.length <= 6) return byCategory

    const top5 = byCategory.slice(0, 5)
    const rest = byCategory.slice(5)
    const restTotal = rest.reduce((s, r) => s + r.value, 0)

    return [
      ...top5,
      {
        name: `Lainnya (${rest.length} kategori)`,
        value: restTotal,
        color: '#94a3b8', // slate-400 netral dan elegan
        categoryKey: 'other_consolidated',
      },
    ]
  }, [byCategory])

  // Filter pencarian pada daftar kategori
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return byCategory
    const q = search.toLowerCase()
    return byCategory.filter((c) => c.name.toLowerCase().includes(q))
  }, [byCategory, search])

  const displayedCategories = useMemo(() => {
    if (showAll || filteredCategories.length <= 7) return filteredCategories
    return filteredCategories.slice(0, 7)
  }, [filteredCategories, showAll])

  const maxCategoryValue = useMemo(
    () => (byCategory.length > 0 ? byCategory[0].value : 1),
    [byCategory]
  )

  const pctBulanan = totalOutlet > 0 ? pct(amountBulanan, totalOutlet) : 0
  const pctKasKecil = totalOutlet > 0 ? pct(amountPettyCash, totalOutlet) : 0
  const pctWaste = totalOutlet > 0 && includeWaste ? pct(totalWaste, totalOutlet) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* ── KIRI: DONUT CHART & BREAKDOWN SUMBER ── */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {/* Donut Chart Card */}
        <div className="bg-suka-cream/30 rounded-2xl p-5 border border-suka-brown/5 flex flex-col items-center justify-center relative">
          <div className="w-full h-64 sm:h-72 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={78}
                  outerRadius={108}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => rupiah(Number(value))}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as CategorySlice
                      const percentage = totalOutlet > 0 ? pct(item.value, totalOutlet) : '0'
                      return (
                        <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-suka-gray-200 shadow-xl text-xs font-bold space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-suka-gray-600 font-semibold">{item.name}</span>
                          </div>
                          <p className="text-suka-brown text-sm font-black">{rupiah(item.value)}</p>
                          <p className="text-[10px] text-suka-gray-400 font-medium">{percentage}% dari total beban</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Label Pusat Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-[10px] font-extrabold text-suka-gray-400 uppercase tracking-widest">
                Total Beban
              </span>
              <span className="text-xl sm:text-2xl font-black text-suka-brown tracking-tight mt-0.5">
                {(totalOutlet / 1_000_000).toFixed(1)} <span className="text-sm font-bold">Jt</span>
              </span>
              <span className="text-[10px] font-semibold text-suka-gray-500 mt-0.5">
                {byCategory.length} Kategori
              </span>
            </div>
          </div>

          <p className="text-[11px] text-suka-gray-400 font-medium text-center mt-2">
            Menampilkan 5 proporsi terbesar &amp; gabungan kategori lainnya
          </p>
        </div>

        {/* 3 Pilar Asal Biaya (Bulanan vs Kas Kecil vs Waste) */}
        <div className="bg-white rounded-2xl p-4 border border-suka-gray-100 shadow-2xs space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-suka-brown uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-suka-orange" />
            <span>Struktur Sumber Pengeluaran</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* 1. Bulanan */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-suka-ink flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Biaya Bulanan (Fixed/Pusat)</span>
                </span>
                <span className="font-extrabold text-suka-brown tabular-nums">
                  {rupiah(amountBulanan)} <span className="text-suka-gray-400 font-semibold text-[10px]">({pctBulanan}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-suka-gray-100 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(Number(pctBulanan), 100)}%` }} />
              </div>
            </div>

            {/* 2. Kas Kecil */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-suka-ink flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>Kas Kecil (Petty Cash Outlet)</span>
                </span>
                <span className="font-extrabold text-suka-brown tabular-nums">
                  {rupiah(amountPettyCash)} <span className="text-suka-gray-400 font-semibold text-[10px]">({pctKasKecil}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-suka-gray-100 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(Number(pctKasKecil), 100)}%` }} />
              </div>
            </div>

            {/* 3. Waste */}
            {includeWaste && (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-suka-ink flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kerugian Waste (Approval)</span>
                  </span>
                  <span className="font-extrabold text-rose-700 tabular-nums">
                    {rupiah(totalWaste)} <span className="text-suka-gray-400 font-semibold text-[10px]">({pctWaste}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-suka-gray-100 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(Number(pctWaste), 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KANAN: LEADERBOARD LENGKAP KATEGORI BEBAN ── */}
      <div className="lg:col-span-7 flex flex-col justify-between h-full bg-white rounded-2xl p-5 border border-suka-gray-100 shadow-2xs">
        <div>
          {/* Header & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-suka-gray-100">
            <div>
              <h4 className="font-extrabold text-suka-brown text-xs sm:text-sm tracking-tight uppercase">
                Ranking Kategori Pengeluaran
              </h4>
              <p className="text-[11px] text-suka-gray-400 font-semibold mt-0.5">
                Urutan beban dari nominal terbesar beserta persentase kontribusi
              </p>
            </div>

            {byCategory.length > 5 && (
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari kategori..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-suka-cream/50 border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all"
                />
              </div>
            )}
          </div>

          {/* List Kategori */}
          <div className="divide-y divide-suka-gray-50 pt-1">
            {displayedCategories.length === 0 ? (
              <div className="py-12 text-center text-xs text-suka-gray-400">
                Tidak ada kategori yang cocok dengan pencarian
              </div>
            ) : (
              displayedCategories.map((entry, idx) => {
                const percentage = pct(entry.value, totalOutlet)
                const relativeToMax = maxCategoryValue > 0 ? (entry.value / maxCategoryValue) * 100 : 0
                const rank = idx + 1
                const rankBadgeClass =
                  rank === 1
                    ? 'bg-amber-400 text-white font-extrabold'
                    : rank === 2
                    ? 'bg-slate-400 text-white font-extrabold'
                    : rank === 3
                    ? 'bg-amber-700 text-white font-extrabold'
                    : 'bg-suka-cream text-suka-gray-500 font-bold'

                return (
                  <div key={entry.name} className="py-3 group hover:bg-suka-cream/20 px-2 rounded-xl transition-colors">
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] shrink-0 ${rankBadgeClass}`}>
                          {rank}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="font-bold text-suka-ink truncate group-hover:text-suka-brown transition-colors">
                          {entry.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-right shrink-0">
                        <span className="font-extrabold text-suka-brown tabular-nums text-xs sm:text-sm">
                          {rupiah(entry.value)}
                        </span>
                        <span className="text-[11px] font-bold text-suka-gray-600 bg-suka-cream/80 px-2 py-0.5 rounded-md min-w-[50px] text-right border border-suka-brown/5 tabular-nums">
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar dengan skala relatif */}
                    <div className="w-full h-1.5 bg-suka-gray-100 rounded-full overflow-hidden ml-7 max-w-[calc(100%-1.75rem)]">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max(2, Math.min(relativeToMax, 100))}%`,
                          backgroundColor: entry.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer Toggle Expand/Collapse */}
        {filteredCategories.length > 7 && (
          <div className="pt-3 mt-2 border-t border-suka-gray-100 text-center">
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="text-xs font-bold text-suka-brown hover:text-suka-orange transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Tampilkan Lebih Sedikit (Top 7)
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Lihat Semua ({filteredCategories.length} Kategori)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
