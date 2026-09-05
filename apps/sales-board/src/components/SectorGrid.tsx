'use client'

import type { BoardRow } from '@/lib/types'
import { computeDelta } from '@/lib/compare'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

interface SectorGridProps {
  rows: BoardRow[]
  showRupiah: boolean
  registerRow: (id: string) => (el: HTMLElement | null) => void
  shifts: Map<string, RankShiftInfo>
}

export function SectorGrid({
  rows,
  showRupiah,
  registerRow,
  shifts,
}: SectorGridProps) {
  // Peringkat 4 sampai 20 (17 outlet)
  const remainingRows = rows.slice(3)

  // Bagi ke dalam 3 sektor terstruktur
  // Sektor Alpha: Index 0 - 5 (Rank 4 - 9, 6 outlet)
  const sectorAlpha = remainingRows.slice(0, 6)
  // Sektor Beta: Index 6 - 11 (Rank 10 - 15, 6 outlet)
  const sectorBeta = remainingRows.slice(6, 12)
  // Sektor Gamma: Index 12 - 16 (Rank 16 - 20, 5 outlet)
  const sectorGamma = remainingRows.slice(12, 17)

  const renderCard = (row: BoardRow, rank: number) => {
    const delta = computeDelta(row.pcsToday, row.pcsBase)
    const shift = shifts.get(row.outletId)

    return (
      <div
        key={row.outletId}
        ref={registerRow(row.outletId)}
        data-flip-key={row.outletId}
        className="group relative flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/90 backdrop-blur-md px-4 py-3.5 min-h-[58px] lg:min-h-[64px] transition-all duration-200 hover:border-amber-500/40 hover:bg-[var(--card-bg)] shadow-xs"
      >
        {/* Left Section: Rank Badge & Outlet Identity */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex h-8 w-9 items-center justify-center rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-subtle)] text-xs font-black text-[var(--text-secondary)] tabular shadow-xs">
              {String(rank).padStart(2, '0')}
            </span>

            {/* Shift Badge jika ada pergeseran */}
            {shift && shift.diff !== 0 && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 shadow-xs ${
                  shift.diff > 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {shift.diff > 0 ? `▲+${shift.diff}` : `▼${shift.diff}`}
              </span>
            )}
          </div>

          <span
            title={row.outletName}
            className="font-black text-sm lg:text-base text-[var(--text-primary)] truncate"
          >
            {row.outletName}
          </span>
        </div>

        {/* Right Section: Sales Metrics */}
        <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-[var(--border-subtle)]">
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="font-black text-base lg:text-xl text-amber-400 tabular">
                {row.pcsToday.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] font-extrabold text-[var(--text-muted)]">
                PCS
              </span>
            </div>

            <div className="text-[11px] text-[var(--text-secondary)] leading-none mt-0.5">
              {showRupiah ? (
                <span className="tabular font-semibold">
                  Rp {row.omzetToday.toLocaleString('id-ID')}
                </span>
              ) : (
                <span className="tracking-widest font-mono text-[var(--text-muted)] opacity-50 select-none">
                  Rp ••••••
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-end">
            <DeltaCell delta={delta} size="sm" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <section aria-label="Sector Leaderboard" className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-3.5 items-start">
        {/* Sektor Alpha: P4 - P9 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1.5 py-0.5 text-xs font-black tracking-wider uppercase text-sky-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
              <span>Sektor Alpha (Rank 4 - 9)</span>
            </div>
            <span className="text-[11px] font-bold text-[var(--text-muted)] lowercase">
              tier atas
            </span>
          </div>
          <div className="flex flex-col gap-2 lg:gap-2.5">
            {sectorAlpha.map((row, idx) => renderCard(row, idx + 4))}
          </div>
        </div>

        {/* Sektor Beta: P10 - P15 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1.5 py-0.5 text-xs font-black tracking-wider uppercase text-indigo-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.7)]" />
              <span>Sektor Beta (Rank 10 - 15)</span>
            </div>
            <span className="text-[11px] font-bold text-[var(--text-muted)] lowercase">
              midfield
            </span>
          </div>
          <div className="flex flex-col gap-2 lg:gap-2.5">
            {sectorBeta.map((row, idx) => renderCard(row, idx + 10))}
          </div>
        </div>

        {/* Sektor Gamma: P16 - P20 + Fleet Target Milestone Widget */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1.5 py-0.5 text-xs font-black tracking-wider uppercase text-emerald-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              <span>Sektor Gamma (Rank 16 - 20)</span>
            </div>
            <span className="text-[11px] font-bold text-[var(--text-muted)] lowercase">
              pengejar
            </span>
          </div>

          <div className="flex flex-col gap-2 lg:gap-2.5">
            {sectorGamma.map((row, idx) => renderCard(row, idx + 16))}
          </div>
        </div>
      </div>
    </section>
  )
}
