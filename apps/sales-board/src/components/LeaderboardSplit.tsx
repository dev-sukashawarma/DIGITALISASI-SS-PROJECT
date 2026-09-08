'use client'

import { Trophy, Award, Medal, Flag } from 'lucide-react'
import { computeDelta } from '@/lib/compare'
import { formatInt, formatRupiah } from '@/lib/format'
import type { BoardRow } from '@/lib/types'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 font-black text-stone-950 shadow-md ring-1 ring-amber-200">
        <Trophy size={13} className="stroke-[2.5]" />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 font-black text-slate-900 shadow-md ring-1 ring-slate-100">
        <Award size={13} className="stroke-[2.5]" />
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 font-black text-amber-100 shadow-md ring-1 ring-amber-600/50">
        <Medal size={13} className="stroke-[2.5]" />
      </span>
    )
  }

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--border-card)] bg-[var(--card-bg)] text-[10px] font-black text-[var(--text-muted)] tabular">
      {rank}
    </span>
  )
}

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

  const isGold = rank === 1
  const isSilver = rank === 2
  const isBronze = rank === 3

  const shiftAnimationClass = shift
    ? shift.diff > 0
      ? 'animate-rank-up'
      : 'animate-rank-down'
    : ''

  const cardBorder = isGold
    ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-[var(--card-bg)] to-[var(--bg-surface)] shadow-md shadow-amber-500/5'
    : isSilver
      ? 'border-slate-300/35 bg-gradient-to-r from-slate-400/10 via-[var(--card-bg)] to-[var(--bg-surface)]'
      : isBronze
        ? 'border-amber-700/35 bg-gradient-to-r from-amber-800/10 via-[var(--card-bg)] to-[var(--bg-surface)]'
        : 'border-[var(--border-card)] bg-[var(--card-bg)]/80 hover:bg-[var(--card-bg-hover)]'

  return (
    <div
      ref={registerRow(row.outletId)}
      className={`relative grid grid-cols-[2.8rem_minmax(140px,1.2fr)_minmax(110px,1fr)_4.8rem_3.8rem_5.5rem_4.8rem] items-center gap-x-2.5 px-3 py-1.5 rounded-xl border transition-all ${cardBorder} ${shiftAnimationClass}`}
    >
      {/* Position Badge & Shift Indicator */}
      <div className="flex items-center gap-1">
        <RankBadge rank={rank} />
        {shift && (
          <span
            className={`inline-flex items-center px-0.5 rounded text-[8px] font-black tabular leading-none shadow-xs ${
              shift.diff > 0
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
            }`}
            title={`Sebelumnya #${shift.oldRank}`}
          >
            {shift.diff > 0 ? `▲${shift.diff}` : `▼${shift.diff}`}
          </span>
        )}
      </div>

      {/* Outlet Name */}
      <div className="flex items-center gap-1.5 truncate pr-1">
        <span
          className={`truncate text-xs lg:text-[13px] tracking-tight ${
            isGold
              ? 'font-black text-amber-400 dark:text-amber-300'
              : isSilver
                ? 'font-extrabold text-slate-100'
                : isBronze
                  ? 'font-extrabold text-amber-200'
                  : 'font-bold text-[var(--text-secondary)]'
          }`}
        >
          {row.outletName}
        </span>
        {isGold && (
          <span className="hidden xl:inline-block rounded bg-amber-500/25 px-1 py-0.2 text-[8px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/40">
            LEADER
          </span>
        )}
      </div>

      {/* Jembatan Gap: Battle Meter Progress Track Bar */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 h-2 rounded-full bg-black/40 border border-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isGold
                ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-xs shadow-amber-500/50'
                : isSilver
                  ? 'bg-gradient-to-r from-slate-400 to-slate-200'
                  : isBronze
                    ? 'bg-gradient-to-r from-amber-700 to-amber-400'
                    : 'bg-gradient-to-r from-amber-500/60 to-amber-400/80'
            }`}
            style={{ width: `${Math.max(4, pctOfMax)}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-[var(--text-muted)] tabular w-7 text-right">
          {Math.round(pctOfMax)}%
        </span>
      </div>

      {/* Pcs Today (Hero metric) */}
      <div className="text-right">
        <span
          className={`text-sm lg:text-base font-black tabular leading-none ${
            isGold
              ? 'text-amber-400 dark:text-amber-300 text-base lg:text-lg'
              : isSilver
                ? 'text-slate-100'
                : isBronze
                  ? 'text-amber-200'
                  : 'text-[var(--text-primary)]'
          }`}
        >
          {formatInt(row.pcsToday)}
        </span>
      </div>

      {/* Transaksi */}
      <div className="text-right text-[11px] font-semibold text-[var(--text-muted)] tabular">
        {formatInt(row.trxToday)}
      </div>

      {/* Omzet Kotor */}
      <div className="text-right text-[11px] font-bold text-[var(--text-secondary)] tabular truncate">
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

export function LeaderboardSplit({
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

  // Bagi tepat 10 outlet di kiri dan 10 outlet di kanan
  const colLeft = rows.slice(0, 10)
  const colRight = rows.slice(10, 20)

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* KOLOM KIRI: Top 10 Leaderboard (Rank 1 - 10) */}
      <div className="flex flex-col rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/90 backdrop-blur-md p-2.5 shadow-md">
        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)] px-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20 text-amber-400">
              <Trophy size={13} />
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
              Top 10 Klasemen Penjualan
            </h3>
          </div>
          <span className="text-[10px] font-bold text-amber-400">
            Peringkat 1 s/d 10
          </span>
        </div>

        {/* Column Header */}
        <div className="grid grid-cols-[2.8rem_minmax(140px,1.2fr)_minmax(110px,1fr)_4.8rem_3.8rem_5.5rem_4.8rem] items-center gap-x-2.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)]/60">
          <div>Pos</div>
          <div>Outlet</div>
          <div className="text-center">Battle Meter</div>
          <div className="text-right text-amber-500">{isYesterday ? 'Pcs Kemarin' : 'Pcs'}</div>
          <div className="text-right">Trx</div>
          <div className="text-right">{showRupiah ? 'Omzet' : 'Privasi'}</div>
          <div className="text-right" title={`vs ${baseLabel}`}>vs Base</div>
        </div>

        {/* Rows (1 to 10): Spacing Rapat dan Konsisten (Tanpa justify-between) */}
        <div className="flex flex-col gap-1.5 pt-1.5">
          {colLeft.map((r, i) => (
            <RowCard
              key={r.outletId}
              row={r}
              rank={i + 1}
              maxPcs={maxPcs}
              showRupiah={showRupiah}
              registerRow={registerRow}
              shift={shifts?.get(r.outletId)}
            />
          ))}
        </div>
      </div>

      {/* KOLOM KANAN: Group Pengejar (Rank 11 - 20) */}
      <div className="flex flex-col rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/90 backdrop-blur-md p-2.5 shadow-md">
        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)] px-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-500/20 text-slate-400">
              <Flag size={13} />
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
              Grup Pengejar
            </h3>
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">
            Peringkat 11 s/d 20
          </span>
        </div>

        {/* Column Header */}
        <div className="grid grid-cols-[2.8rem_minmax(140px,1.2fr)_minmax(110px,1fr)_4.8rem_3.8rem_5.5rem_4.8rem] items-center gap-x-2.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)]/60">
          <div>Pos</div>
          <div>Outlet</div>
          <div className="text-center">Battle Meter</div>
          <div className="text-right text-amber-500">{isYesterday ? 'Pcs Kemarin' : 'Pcs'}</div>
          <div className="text-right">Trx</div>
          <div className="text-right">{showRupiah ? 'Omzet' : 'Privasi'}</div>
          <div className="text-right" title={`vs ${baseLabel}`}>vs Base</div>
        </div>

        {/* Rows (11 to 20): Spacing Rapat dan Konsisten (Tanpa justify-between) */}
        <div className="flex flex-col gap-1.5 pt-1.5">
          {colRight.map((r, i) => (
            <RowCard
              key={r.outletId}
              row={r}
              rank={i + 11}
              maxPcs={maxPcs}
              showRupiah={showRupiah}
              registerRow={registerRow}
              shift={shifts?.get(r.outletId)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
