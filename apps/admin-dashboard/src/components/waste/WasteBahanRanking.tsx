'use client'

import React, { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronUp, Package, AlertTriangle, CheckCircle } from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { BahanSpreadAgg } from '@/lib/wasteMetrics'

interface WasteBahanRankingProps {
  rows: BahanSpreadAgg[]
  /** Berapa bahan teratas yang ditampilkan secara default. */
  defaultLimit?: number
}

/** >= ambang ini dianggap sistemik, bukan masalah satu outlet. */
const SYSTEMIC_OUTLETS = 5

export function WasteBahanRanking({ rows, defaultLimit = 8 }: WasteBahanRankingProps) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((b) => b.name.toLowerCase().includes(q))
  }, [rows, search])

  const displayed = useMemo(() => {
    if (showAll || filtered.length <= defaultLimit) return filtered
    return filtered.slice(0, defaultLimit)
  }, [filtered, showAll, defaultLimit])

  const maxNilai = useMemo(
    () => (rows.length > 0 ? Math.max(...rows.map((b) => b.nilai)) : 1),
    [rows]
  )

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-suka-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">
                Ranking Bahan Baku Terbuang
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-suka-cream text-suka-brown border border-suka-brown/10">
                {rows.length} Bahan
              </span>
            </div>
            <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">
              Sebaran outlet membedakan masalah lokal operasional vs sistemik (resep BOM / batch vendor pusat)
            </p>
          </div>

          {rows.length > 5 && (
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari bahan baku..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-suka-cream/50 border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all"
              />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-suka-cream/40 border-b border-suka-gray-100 text-left">
                <th className="py-3 px-4 sm:px-6 w-12 text-center text-xs font-bold text-suka-gray-400">#</th>
                <th className="py-3 px-4 sm:px-6 font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Bahan Baku
                </th>
                <th className="py-3 px-4 sm:px-6 text-right font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Kuantitas Terbuang
                </th>
                <th className="py-3 px-4 sm:px-6 text-right font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Total Kerugian
                </th>
                <th className="py-3 px-4 sm:px-6 text-center font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Sebaran Outlet &amp; Klasifikasi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 font-medium">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-suka-gray-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-xs">
                      {search ? 'Tidak ada bahan yang sesuai pencarian' : 'Belum ada waste pada periode ini'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayed.map((b, idx) => {
                  const rank = idx + 1
                  const systemic = b.outletCount >= SYSTEMIC_OUTLETS
                  const percentOfMax = maxNilai > 0 ? (b.nilai / maxNilai) * 100 : 0

                  const rankBadgeClass =
                    rank === 1
                      ? 'bg-amber-400 text-white font-extrabold shadow-2xs'
                      : rank === 2
                      ? 'bg-slate-400 text-white font-extrabold shadow-2xs'
                      : rank === 3
                      ? 'bg-amber-700 text-white font-extrabold shadow-2xs'
                      : 'bg-suka-cream text-suka-gray-500 font-bold'

                  return (
                    <tr key={b.id} className="hover:bg-suka-cream/30 transition-colors group">
                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        <span
                          className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${rankBadgeClass}`}
                        >
                          {rank}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="font-bold text-suka-ink group-hover:text-suka-brown transition-colors">
                          {b.name}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap text-suka-gray-600 tabular-nums">
                        {b.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })}{' '}
                        <span className="text-xs text-suka-gray-400 font-medium">{b.satuan_kecil}</span>
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="font-extrabold text-rose-700 tabular-nums">
                          {rupiah(b.nilai)}
                        </div>
                        {/* Mini bar perbandingan */}
                        <div className="mt-1 h-1 w-20 ml-auto bg-suka-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-400 rounded-full"
                            style={{ width: `${Math.max(4, Math.min(percentOfMax, 100))}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        {systemic ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70">
                            <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>{b.outletCount} outlet · Sistemik</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-suka-cream text-suka-brown border border-suka-brown/10">
                            <CheckCircle className="w-3 h-3 text-suka-gray-400 shrink-0" />
                            <span>{b.outletCount} outlet · Lokal</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Toggle */}
      {filtered.length > defaultLimit && (
        <div className="p-3 border-t border-suka-gray-100 text-center bg-suka-cream/20">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-xs font-bold text-suka-brown hover:text-suka-orange transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Tampilkan Lebih Sedikit (Top {defaultLimit})
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Lihat Semua ({filtered.length} Bahan Baku)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
