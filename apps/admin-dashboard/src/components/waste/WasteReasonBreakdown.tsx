'use client'

import { rupiah } from '@/lib/format'
import type { ReasonAgg } from '@/lib/wasteBreakdown'

/** Alasan yang berarti uang bisa diklaim balik ke supplier, bukan diserap sendiri. */
const CLAIMABLE = 'Kualitas Buruk (dari supplier)'

interface WasteReasonBreakdownProps {
  rows: ReasonAgg[]
  total: number
}

export function WasteReasonBreakdown({ rows, total }: WasteReasonBreakdownProps) {
  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100">
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Breakdown per Alasan</h3>
      </div>
      <div className="p-6 space-y-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-suka-gray-400 text-sm">Belum ada waste pada periode ini</p>
        ) : rows.map((r) => {
          const share = total > 0 ? (r.nilai / total) * 100 : 0
          const claimable = r.reason === CLAIMABLE
          return (
            <div key={r.reason}>
              <div className="flex justify-between items-baseline gap-3 mb-1">
                <span className={`text-xs font-bold ${claimable ? 'text-suka-orange' : 'text-suka-ink'}`}>
                  {r.reason}
                  {claimable && <span className="ml-1.5 text-[10px] font-semibold uppercase">• bisa diklaim ke supplier</span>}
                </span>
                <span className="text-xs font-extrabold text-red-700 whitespace-nowrap tabular-nums">
                  {rupiah(r.nilai)} <span className="text-suka-gray-400 font-semibold">({share.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-suka-cream overflow-hidden">
                <div
                  className={`h-full rounded-full ${claimable ? 'bg-suka-orange' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(share, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
