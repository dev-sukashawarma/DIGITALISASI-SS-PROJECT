'use client'

import { Flag, Activity } from 'lucide-react'
import { computeDelta } from '@/lib/compare'
import { formatInt, formatRupiah } from '@/lib/format'
import type { BoardRow } from '@/lib/types'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

function RowCard({
  row,
  rank,
  maxPcs,
  showRupiah,
  registerRow,
  shift,
}: {
  row: BoardRow
  rank: number
  maxPcs: number
  showRupiah: boolean
  registerRow: (id: string) => (el: HTMLElement | null) => void
  shift?: RankShiftInfo
}) {
  const pctOfMax = (row.pcsToday / maxPcs) * 100
  const delta = computeDelta(row.pcsToday, row.pcsBase)

  const shiftAnimationClass = shift
    ? shift.diff > 0
      ? 'animate-rank-up'
      : 'animate-rank-down'
    : ''

  return (
    <div
      ref={registerRow(row.outletId)}
      className={`relative grid grid-cols-[3.2rem_1fr_4.5rem_3.8rem_5.5rem_4.8rem] items-center gap-x-2 px-3 py-2 text-xs transition-colors hover:bg-[var(--row-hover)] rounded-xl ${
        rank % 2 === 0 ? 'bg-[var(--row-stripe)]' : ''
      } ${shiftAnimationClass}`}
    >
      {/* Visual Relative Volume Meter Bar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-0 -z-10 rounded-lg border-r border-amber-500/30 bg-gradient-to-r from-[var(--bar-fill-start)] to-transparent transition-all duration-500"
        style={{ width: `${Math.max(2, pctOfMax)}%` }}
      />

      {/* Pos + Shift Indicator */}
      <div className="flex items-center gap-1">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--border-card)] bg-[var(--card-bg)] text-[10px] font-black text-[var(--text-muted)] tabular">
          {rank}
        </span>
        {shift && (
          <span
            className={`inline-flex items-center px-0.5 rounded text-[8px] font-black tabular leading-none ${
              shift.diff > 0
                ? 'text-emerald-400 font-extrabold'
                : 'text-rose-400 font-extrabold'
            }`}
            title={`Sebelumnya #${shift.oldRank}`}
          >
            {shift.diff > 0 ? `▲${shift.diff}` : `▼${Math.abs(shift.diff)}`}
          </span>
        )}
      </div>

      {/* Outlet Name */}
      <div className="truncate pr-1">
        <span className="truncate font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[13px] tracking-tight">
          {row.outletName}
        </span>
      </div>

      {/* Pcs Today */}
      <div className="text-right">
        <span className="text-sm lg:text-base font-black text-[var(--text-primary)] tabular leading-none">
          {formatInt(row.pcsToday)}
        </span>
      </div>

      {/* Transaksi */}
      <div className="text-right text-xs font-semibold text-[var(--text-muted)] tabular">
        {formatInt(row.trxToday)}
      </div>

      {/* Omzet Kotor */}
      <div className="text-right text-xs font-bold text-[var(--text-secondary)] tabular truncate">
        {showRupiah ? (
          formatRupiah(row.omzetToday)
        ) : (
          <span className="font-mono text-[10px] text-[var(--text-muted)] opacity-50">
            ******
          </span>
        )}
      </div>

      {/* vs Baseline */}
      <div className="flex justify-end">
        <DeltaCell delta={delta} size="sm" />
      </div>
    </div>
  )
}

export function RankingGrid({
  rows,
  baseLabel,
  showRupiah,
  isYesterday,
  shifts,
  registerRow,
}: {
  rows: BoardRow[]
  baseLabel: string
  showRupiah: boolean
  isYesterday?: boolean
  shifts?: Map<string, RankShiftInfo>
  registerRow: (id: string) => (el: HTMLElement | null) => void
}) {
  const maxPcs = Math.max(1, rows[0]?.pcsToday || 1)
  // Outlet peringkat 4 ke bawah (Rank 4 sampai 20)
  const gridRows = rows.slice(3)

  // Bagi ke 2 kolom: Kiri (Rank 4-11, 8 outlet), Kanan (Rank 12-20, 9 outlet)
  const midPoint = Math.ceil(gridRows.length / 2)
  const colLeft = gridRows.slice(0, midPoint)
  const colRight = gridRows.slice(midPoint)

  return (
    <section className="flex flex-col h-full overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/85 backdrop-blur-md shadow-xl">
      {/* Panel Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
            <Flag size={13} />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] leading-none">
              Papan Klasemen Operasional
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">
              Peringkat 4 s/d {rows.length} (Grup Pengejar)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/20 px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border-card)]">
            <Activity size={11} className="text-amber-500" />
            <span>Telemetry Live 30s</span>
          </span>
        </div>
      </div>

      {/* Dual Column Grid Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden">
        {/* KOLOM KIRI: Rank 4 - 11 */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-surface)]/60">
          {/* Subheader Kolom Kiri */}
          <div className="grid grid-cols-[3.2rem_1fr_4.5rem_3.8rem_5.5rem_4.8rem] items-center gap-x-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            <div>Pos</div>
            <div>Outlet (Rank 4 - {3 + colLeft.length})</div>
            <div className="text-right text-amber-500">{isYesterday ? 'Pcs (Kemarin)' : 'Pcs'}</div>
            <div className="text-right">Trx</div>
            <div className="text-right">{showRupiah ? 'Omzet' : 'Privasi'}</div>
            <div className="text-right" title={`Perbandingan vs ${baseLabel}`}>vs Base</div>
          </div>

          <div className="flex-1 divide-y divide-[var(--border-subtle)] p-1 overflow-y-auto">
            {colLeft.map((r, i) => (
              <RowCard
                key={r.outletId}
                row={r}
                rank={i + 4}
                maxPcs={maxPcs}
                showRupiah={showRupiah}
                registerRow={registerRow}
                shift={shifts?.get(r.outletId)}
              />
            ))}
          </div>
        </div>

        {/* KOLOM KANAN: Rank 12 - 20 */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-surface)]/60">
          {/* Subheader Kolom Kanan */}
          <div className="grid grid-cols-[3.2rem_1fr_4.5rem_3.8rem_5.5rem_4.8rem] items-center gap-x-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            <div>Pos</div>
            <div>Outlet (Rank {4 + colLeft.length} - {rows.length})</div>
            <div className="text-right text-amber-500">{isYesterday ? 'Pcs (Kemarin)' : 'Pcs'}</div>
            <div className="text-right">Trx</div>
            <div className="text-right">{showRupiah ? 'Omzet' : 'Privasi'}</div>
            <div className="text-right" title={`Perbandingan vs ${baseLabel}`}>vs Base</div>
          </div>

          <div className="flex-1 divide-y divide-[var(--border-subtle)] p-1 overflow-y-auto">
            {colRight.map((r, i) => (
              <RowCard
                key={r.outletId}
                row={r}
                rank={i + 4 + colLeft.length}
                maxPcs={maxPcs}
                showRupiah={showRupiah}
                registerRow={registerRow}
                shift={shifts?.get(r.outletId)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
