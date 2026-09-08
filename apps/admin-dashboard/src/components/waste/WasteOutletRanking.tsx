'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
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

/** null selalu di bawah, apa pun arah sortirnya — N/A bukan "nilai terkecil". */
function cmpNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (a - b) * dir
}

// Dipindah ke module scope (bukan didefinisikan di dalam body render parent):
// definisi di dalam parent membuat identitas komponen baru tiap render, jadi
// React me-remount subtree <th>/<button> tiap kali sort di-toggle — pengguna
// keyboard yang baru menekan tombol sort langsung kehilangan fokusnya.
interface ThProps {
  k: SortKey
  label: string
  align?: 'left' | 'right'
  sortKey: SortKey
  toggle: (key: SortKey) => void
}

function Th({ k, label, align = 'right', sortKey, toggle }: ThProps) {
  return (
    <th className={`py-3 px-6 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1 hover:text-suka-brown transition-colors ${sortKey === k ? 'text-suka-brown' : ''}`}
        aria-label={`Urutkan menurut ${label}`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  )
}

export function WasteOutletRanking({ rows, budgetByOutlet, omzetByOutlet }: WasteOutletRankingProps) {
  const [sortKey, setSortKey] = useState<SortKey>('nilai')
  const [dir, setDir] = useState<1 | -1>(-1)

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

  const toggle = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setDir(key === 'name' ? 1 : -1) }
  }

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100">
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Ranking per Outlet</h3>
        <p className="text-[11px] text-suka-gray-500 mt-0.5">% Omzet adalah pembanding yang adil antar-outlet berbeda ukuran</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
              <Th k="name" label="Outlet" align="left" sortKey={sortKey} toggle={toggle} />
              <Th k="nilai" label="Nilai" sortKey={sortKey} toggle={toggle} />
              <Th k="pctOmzet" label="% Omzet" sortKey={sortKey} toggle={toggle} />
              <Th k="budget" label="Budget BOM" sortKey={sortKey} toggle={toggle} />
              <Th k="gapPct" label="Gap %" sortKey={sortKey} toggle={toggle} />
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            {sorted.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
            ) : sorted.map((o) => (
              <tr key={o.id} className="hover:bg-suka-cream/20 transition-colors">
                <td className="py-3 px-6 text-suka-ink font-bold">{o.name}</td>
                <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(o.nilai)}</td>
                <td className={`py-3 px-6 text-right font-bold ${o.pctOmzet === null ? 'text-suka-gray-400' : o.pctOmzet > 2 ? 'text-red-700' : 'text-suka-green'}`}>
                  {o.pctOmzet === null ? 'N/A' : `${o.pctOmzet.toFixed(2)}%`}
                </td>
                <td className="py-3 px-6 text-right text-suka-gray-600">{rupiah(o.budget)}</td>
                <td className={`py-3 px-6 text-right font-bold ${o.gapPct === null ? 'text-suka-gray-400' : o.gapPct > 0 ? 'text-red-700' : 'text-suka-green'}`}>
                  {o.gapPct === null ? 'N/A' : `${o.gapPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
