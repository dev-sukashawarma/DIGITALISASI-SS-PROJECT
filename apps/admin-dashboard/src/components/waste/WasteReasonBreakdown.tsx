'use client'

import React from 'react'
import {
  ShieldAlert,
  Clock,
  Flame,
  AlertTriangle,
  HelpCircle,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { ReasonAgg } from '@/lib/wasteBreakdown'
import { CLAIMABLE_REASON } from '@/lib/wasteReasons'

interface WasteReasonBreakdownProps {
  rows: ReasonAgg[]
  total: number
  /**
   * Berapa insiden yang alasannya di luar 5 opsi dropdown (catatan bebas atau
   * literal 'Waste' dari ManualEntryForm) dan sudah dilipat ke "Lainnya".
   */
  freeTextCount?: number
}

function getReasonConfig(reason: string) {
  if (reason === CLAIMABLE_REASON) {
    return {
      icon: ShieldAlert,
      barColor: 'bg-blue-500',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
      badgeText: 'Bisa Diklaim ke Supplier',
      textColor: 'text-blue-900',
    }
  }
  if (reason.toLowerCase().includes('basi') || reason.toLowerCase().includes('expired')) {
    return {
      icon: Clock,
      barColor: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
      badgeText: 'Kedaluwarsa / Mutu',
      textColor: 'text-amber-950',
    }
  }
  if (reason.toLowerCase().includes('gosong') || reason.toLowerCase().includes('rusak masak')) {
    return {
      icon: Flame,
      barColor: 'bg-rose-500',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      badgeText: 'Operasional Dapur',
      textColor: 'text-rose-950',
    }
  }
  if (reason.toLowerCase().includes('jatuh') || reason.toLowerCase().includes('tumpah')) {
    return {
      icon: AlertTriangle,
      barColor: 'bg-orange-500',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/80',
      badgeText: 'Human Error',
      textColor: 'text-orange-950',
    }
  }
  return {
    icon: HelpCircle,
    barColor: 'bg-slate-400',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200/80',
    badgeText: 'Lainnya / Manual',
    textColor: 'text-suka-ink',
  }
}

export function WasteReasonBreakdown({
  rows,
  total,
  freeTextCount = 0,
}: WasteReasonBreakdownProps) {
  const claimableRow = rows.find((r) => r.reason === CLAIMABLE_REASON)
  const claimableTotal = claimableRow ? claimableRow.nilai : 0
  const claimableShare = total > 0 ? (claimableTotal / total) * 100 : 0

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-suka-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">
              Breakdown per Alasan
            </h3>
            <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">
              Distribusi faktor penyebab kerugian bahan baku
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-suka-cream text-suka-brown border border-suka-brown/10">
            Total: {rupiah(total)}
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Banner Peluang Pemulihan Biaya (Klaim Supplier) */}
          {claimableTotal > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/70 flex items-start gap-3.5 shadow-2xs">
              <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <h4 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">
                    Peluang Klaim Supplier
                  </h4>
                  <span className="text-xs font-black text-blue-700 tabular-nums">
                    {rupiah(claimableTotal)} ({claimableShare.toFixed(1)}%)
                  </span>
                </div>
                <p className="text-[11px] text-blue-800/80 font-medium mt-1 leading-relaxed">
                  Kerugian akibat cacat mutu bahan dapat ditagihkan retur atau dipotongkan pada faktur tagihan supplier berikutnya.
                </p>
              </div>
            </div>
          )}

          {/* List Breakdown Bar */}
          {rows.length === 0 ? (
            <div className="py-12 text-center text-suka-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="font-semibold text-xs">Belum ada catatan waste pada periode ini</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((r) => {
                const share = total > 0 ? (r.nilai / total) * 100 : 0
                const cfg = getReasonConfig(r.reason)
                const Icon = cfg.icon
                const showFreeTextNote = r.reason === 'Lainnya' && freeTextCount > 0

                return (
                  <div key={r.reason} className="group">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-lg ${cfg.barColor}/15 ${cfg.textColor}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className={`text-xs font-bold ${cfg.textColor} truncate`}>
                          {r.reason}
                        </span>
                        <span
                          className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${cfg.badgeClass}`}
                        >
                          {cfg.badgeText}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-extrabold text-rose-700 tabular-nums">
                          {rupiah(r.nilai)}
                        </span>
                        <span className="text-[11px] font-bold text-suka-gray-400 ml-1.5 tabular-nums">
                          ({share.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 rounded-full bg-suka-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.barColor} transition-all duration-500 group-hover:brightness-95`}
                        style={{ width: `${Math.max(2, Math.min(share, 100))}%` }}
                      />
                    </div>

                    {showFreeTextNote && (
                      <div className="mt-2 p-2 rounded-xl bg-suka-gray-50 border border-suka-gray-200/60 flex items-center gap-1.5 text-[10px] text-suka-gray-500 font-medium">
                        <Info className="w-3.5 h-3.5 text-suka-gray-400 shrink-0" />
                        <span>
                          Termasuk <strong>{freeTextCount} insiden</strong> dengan catatan bebas dari form entri manual yang dikelompokkan ke &quot;Lainnya&quot;.
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-3 border-t border-suka-gray-100 bg-suka-cream/20 text-[11px] text-suka-gray-400 flex items-center justify-between">
        <span>Kategori standar SOP</span>
        <span className="font-semibold text-suka-gray-500">{rows.length} kategori aktif</span>
      </div>
    </div>
  )
}
