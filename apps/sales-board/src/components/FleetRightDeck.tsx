'use client'

import type { BoardRow } from '@/lib/types'
import { computeDelta } from '@/lib/compare'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

interface FleetRightDeckProps {
  rows: BoardRow[]
  showRupiah: boolean
  registerRow: (id: string) => (el: HTMLElement | null) => void
  shifts: Map<string, RankShiftInfo>
}

export function FleetRightDeck({
  rows,
  showRupiah,
  registerRow,
  shifts,
}: FleetRightDeckProps) {
  // Peringkat 4 sampai 20 (17 outlet penantang)
  const remainingRows = rows.slice(3)

  const renderCard = (row: BoardRow, rank: number) => {
    const delta = computeDelta(row.pcsToday, row.pcsBase)
    const shift = shifts.get(row.outletId)

    return (
      <div
        key={row.outletId}
        ref={registerRow(row.outletId)}
        data-flip-key={row.outletId}
        className="group relative flex flex-col justify-between rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)]/85 backdrop-blur-md px-3.5 py-1.5 lg:py-2 transition-all duration-200 hover:border-amber-500/40 hover:bg-[var(--card-bg)] shadow-xs"
      >
        {/* Line 1: Header (Rank + Outlet Name on Left, Rank Number on Right) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              title={row.outletName}
              className="text-[11px] lg:text-xs font-black uppercase tracking-wide text-slate-200 truncate"
            >
              {rank}. {row.outletName}
            </span>
            {shift && shift.diff !== 0 && (
              <span
                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black shrink-0 ${
                  shift.diff > 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {shift.diff > 0 ? `▲+${shift.diff}` : `▼${shift.diff}`}
              </span>
            )}
          </div>

          <span className="text-xs font-bold text-slate-500 tabular shrink-0 select-none">
            {rank}
          </span>
        </div>

        {/* Line 2: Giant Sales Number in Amber (Matching Mockup) */}
        <div className="my-0.5 flex items-baseline gap-1">
          <span className="text-xl lg:text-2xl font-black text-amber-400 tabular leading-none">
            {row.pcsToday.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] font-extrabold text-amber-500/80">
            PCS
          </span>
        </div>

        {/* Line 3: Footer (Omzet & Trx on Left, Delta Badge on Right) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)] text-[10px]">
          <div className="text-[var(--text-secondary)] truncate">
            {showRupiah ? (
              <span className="tabular font-semibold">
                Rp {row.omzetToday.toLocaleString('id-ID')}
              </span>
            ) : (
              <span className="tracking-widest font-mono text-[var(--text-muted)] opacity-50 select-none">
                Rp ••••••
              </span>
            )}
            <span className="mx-1">•</span>
            <span className="tabular">{row.trxToday} Trx</span>
          </div>

          <div className="shrink-0 flex items-center justify-end">
            <DeltaCell delta={delta} size="sm" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-2.5 flex-1 h-full content-between">
      {remainingRows.map((row, idx) => renderCard(row, idx + 4))}

      {/* Filler Tile for 18th Slot to keep grid symmetrical */}
      {remainingRows.length % 2 !== 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--card-bg)]/40 px-3.5 py-2 lg:py-2.5 flex items-center justify-center gap-2 text-[var(--text-muted)] select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            20 Cabang Terhubung Aktif
          </span>
        </div>
      )}
    </div>
  )
}
