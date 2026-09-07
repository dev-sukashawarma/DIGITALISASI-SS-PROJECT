'use client'

import { rupiah } from '@/lib/format'
import type { BahanSpreadAgg } from '@/lib/wasteMetrics'

interface WasteBahanRankingProps {
  rows: BahanSpreadAgg[]
  /** Berapa bahan teratas yang ditampilkan. */
  limit?: number
}

/** >= ambang ini dianggap sistemik, bukan masalah satu outlet. */
const SYSTEMIC_OUTLETS = 5

export function WasteBahanRanking({ rows, limit = 10 }: WasteBahanRankingProps) {
  const shown = rows.slice(0, limit)

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100">
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Ranking Bahan Baku</h3>
        <p className="text-[11px] text-suka-gray-500 mt-0.5">
          Sebaran outlet memisahkan masalah lokal dari masalah sistemik (porsi resep / batch supplier)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
              <th className="py-3 px-6">Bahan Baku</th>
              <th className="py-3 px-6 text-right">Qty</th>
              <th className="py-3 px-6 text-right">Nilai</th>
              <th className="py-3 px-6 text-right">Sebaran Outlet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            {shown.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
            ) : shown.map((b) => {
              const systemic = b.outletCount >= SYSTEMIC_OUTLETS
              return (
                <tr key={b.id} className="hover:bg-suka-cream/20 transition-colors">
                  <td className="py-3 px-6 text-suka-ink font-bold">{b.name}</td>
                  <td className="py-3 px-6 text-right text-suka-gray-600 whitespace-nowrap">
                    {b.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {b.satuan_kecil}
                  </td>
                  <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(b.nilai)}</td>
                  <td className="py-3 px-6 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${systemic ? 'bg-red-100 text-red-700' : 'bg-suka-cream text-suka-brown'}`}>
                      {b.outletCount} outlet{systemic ? ' • sistemik' : ''}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
