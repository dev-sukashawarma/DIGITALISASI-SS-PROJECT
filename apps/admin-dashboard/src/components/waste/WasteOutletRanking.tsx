'use client'

import React, { useMemo, useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronUp, Search, Store } from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { OutletAgg } from '@/lib/wasteBreakdown'
import { computeWasteGap } from '@/lib/wasteGap'
import { computeWastePctOmzet } from '@/lib/wasteMetrics'

type SortKey = 'name' | 'nilai' | 'pctOmzet' | 'budget' | 'gapPct'

interface WasteOutletRankingProps {
  rows: OutletAgg[]
  budgetByOutlet: Map<string, number>
  omzetByOutlet: Map<string, number>
}

interface Enriched {
  id: string
  name: string
  nilai: number
  pctOmzet: number | null
  budget: number
  gapPct: number | null
}

function cmpNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (a - b) * dir
}

interface ThProps {
  k: SortKey
  label: string
  align?: 'left' | 'right' | 'center'
  sortKey: SortKey
  dir: 1 | -1
  toggle: (key: SortKey) => void
}

function Th({ k, label, align = 'right', sortKey, dir, toggle }: ThProps) {
  const isActive = sortKey === k
  return (
    <th
      className={`py-3 px-4 sm:px-5 font-bold text-xs uppercase tracking-wider text-suka-gray-500 ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1.5 hover:text-suka-brown transition-colors group cursor-pointer ${
          isActive ? 'text-suka-brown font-extrabold' : ''
        }`}
        aria-label={`Urutkan menurut ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          dir === 1 ? (
            <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-suka-gray-300 group-hover:text-suka-gray-500" />
        )}
      </button>
    </th>
  )
}

export function WasteOutletRanking({ rows, budgetByOutlet, omzetByOutlet }: WasteOutletRankingProps) {
  const [sortKey, setSortKey] = useState<SortKey>('nilai')
  const [dir, setDir] = useState<1 | -1>(-1)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const enriched = useMemo<Enriched[]>(
    () =>
      rows.map((o) => {
        const budget = budgetByOutlet.get(o.id) ?? 0
        return {
          id: o.id,
          name: o.name.replace('SUKA SHAWARMA ', ''),
          nilai: o.nilai,
          pctOmzet: computeWastePctOmzet(o.nilai, omzetByOutlet.get(o.id) ?? 0),
          budget,
          gapPct: computeWasteGap(o.nilai, budget).gapPct,
        }
      }),
    [rows, budgetByOutlet, omzetByOutlet]
  )

  const maxNilai = useMemo(
    () => (enriched.length > 0 ? Math.max(...enriched.map((e) => e.nilai)) : 1),
    [enriched]
  )

  const sorted = useMemo(() => {
    const copy = [...enriched]
    copy.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'nilai') return (a.nilai - b.nilai) * dir
      if (sortKey === 'budget') return (a.budget - b.budget) * dir
      return cmpNullable(a[sortKey], b[sortKey], dir)
    })
    return copy
  }, [enriched, sortKey, dir])

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter((o) => o.name.toLowerCase().includes(q))
  }, [sorted, search])

  const displayed = useMemo(() => {
    if (showAll || filtered.length <= 8) return filtered
    return filtered.slice(0, 8)
  }, [filtered, showAll])

  const toggle = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setDir(key === 'name' ? 1 : -1)
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-suka-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">
                Ranking per Outlet
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-suka-cream text-suka-brown border border-suka-brown/10">
                {rows.length} Outlet
              </span>
            </div>
            <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">
              % Omzet adalah indikator perbandingan adil antar-outlet beda skala
            </p>
          </div>

          {rows.length > 5 && (
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari outlet..."
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
                <th className="py-3 px-4 sm:px-5 w-12 text-center text-xs font-bold text-suka-gray-400">#</th>
                <Th k="name" label="Outlet" align="left" sortKey={sortKey} dir={dir} toggle={toggle} />
                <Th k="nilai" label="Nilai Kerugian" sortKey={sortKey} dir={dir} toggle={toggle} />
                <Th k="pctOmzet" label="% Omzet" align="center" sortKey={sortKey} dir={dir} toggle={toggle} />
                <Th k="budget" label="Budget BOM" sortKey={sortKey} dir={dir} toggle={toggle} />
                <Th k="gapPct" label="Gap vs BOM" align="center" sortKey={sortKey} dir={dir} toggle={toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 font-medium">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-suka-gray-400">
                    <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-xs">
                      {search ? 'Tidak ada outlet yang sesuai pencarian' : 'Belum ada waste pada periode ini'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayed.map((o, idx) => {
                  const rank = idx + 1
                  const rankBadgeClass =
                    rank === 1
                      ? 'bg-amber-400 text-white font-extrabold shadow-2xs'
                      : rank === 2
                      ? 'bg-slate-400 text-white font-extrabold shadow-2xs'
                      : rank === 3
                      ? 'bg-amber-700 text-white font-extrabold shadow-2xs'
                      : 'bg-suka-cream text-suka-gray-500 font-bold'

                  const percentOfMax = maxNilai > 0 ? (o.nilai / maxNilai) * 100 : 0

                  return (
                    <tr key={o.id} className="hover:bg-suka-cream/30 transition-colors group">
                      <td className="py-3.5 px-4 sm:px-5 text-center">
                        <span
                          className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${rankBadgeClass}`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="font-bold text-suka-ink group-hover:text-suka-brown transition-colors">
                          {o.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-right">
                        <div className="font-extrabold text-rose-700 tabular-nums">
                          {rupiah(o.nilai)}
                        </div>
                        {/* Mini bar perbandingan */}
                        <div className="mt-1 h-1 w-20 ml-auto bg-suka-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-400 rounded-full"
                            style={{ width: `${Math.max(4, Math.min(percentOfMax, 100))}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-center">
                        {o.pctOmzet === null ? (
                          <span className="text-xs text-suka-gray-400 font-semibold">—</span>
                        ) : o.pctOmzet <= 1.0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {o.pctOmzet.toFixed(2)}%
                          </span>
                        ) : o.pctOmzet <= 2.0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                            {o.pctOmzet.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            {o.pctOmzet.toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-right text-suka-gray-600 tabular-nums text-xs">
                        {rupiah(o.budget)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-center">
                        {o.gapPct === null ? (
                          <span className="text-xs text-suka-gray-400 font-semibold">—</span>
                        ) : o.gapPct <= 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {o.gapPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            +{o.gapPct.toFixed(1)}%
                          </span>
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
      {filtered.length > 8 && (
        <div className="p-3 border-t border-suka-gray-100 text-center bg-suka-cream/20">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-xs font-bold text-suka-brown hover:text-suka-orange transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Tampilkan Lebih Sedikit (Top 8)
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Lihat Semua ({filtered.length} Outlet)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
