'use client'

import { Trophy, Award, Medal, Flame, Zap } from 'lucide-react'
import { formatInt, formatRupiah } from '@/lib/format'
import { computeDelta } from '@/lib/compare'
import type { BoardRow } from '@/lib/types'
import { BorderBeam } from './BorderBeam'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

export function TopPodium({
  rows,
  showRupiah,
  shifts,
  registerRow,
}: {
  rows: BoardRow[]
  showRupiah: boolean
  isYesterday?: boolean
  shifts?: Map<string, RankShiftInfo>
  registerRow?: (id: string) => (el: HTMLElement | null) => void
}) {
  if (rows.length < 3) return null

  const row1 = rows[0]
  const row2 = rows[1]
  const row3 = rows[2]

  const gap1to2 = row1.pcsToday - row2.pcsToday
  const gap2to1 = row1.pcsToday - row2.pcsToday
  const gap3to2 = row2.pcsToday - row3.pcsToday

  const delta1 = computeDelta(row1.pcsToday, row1.pcsBase)
  const delta2 = computeDelta(row2.pcsToday, row2.pcsBase)
  const delta3 = computeDelta(row3.pcsToday, row3.pcsBase)

  const shift1 = shifts?.get(row1.outletId)
  const shift2 = shifts?.get(row2.outletId)
  const shift3 = shifts?.get(row3.outletId)

  return (
    <section className="px-6 lg:px-8 py-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
        {/* PODIUM #2: SILVER (Left) */}
        <div
          ref={registerRow ? registerRow(row2.outletId) : undefined}
          className={`relative overflow-hidden rounded-xl border border-slate-400/25 bg-gradient-to-b from-[var(--card-bg)] to-[var(--bg-surface)] p-3.5 shadow-sm transition-all hover:border-slate-300/40 ${
            shift2 ? (shift2.diff > 0 ? 'animate-rank-up' : 'animate-rank-down') : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 font-black text-slate-900 shadow-sm ring-1 ring-slate-100">
                <Award size={16} className="stroke-[2.5]" />
              </span>
              <span className="rounded bg-slate-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-300 border border-slate-400/20">
                SILVER #2
              </span>
              {shift2 && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black tabular ${
                    shift2.diff > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {shift2.diff > 0 ? `▲+${shift2.diff}` : `▼${shift2.diff}`}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 tabular">
                -{formatInt(gap2to1)} pcs ke #1
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base lg:text-lg font-black tracking-tight text-[var(--text-primary)]">
              {row2.outletName}
            </h3>
            <div className="text-right shrink-0">
              <span className="text-2xl lg:text-3xl font-black text-[var(--text-primary)] tabular tracking-tight leading-none">
                {formatInt(row2.pcsToday)}
              </span>
              <span className="ml-1 text-xs font-bold text-[var(--text-muted)]">pcs</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-3 tabular">
              <span>Trx: <strong className="text-[var(--text-secondary)]">{formatInt(row2.trxToday)}</strong></span>
              <span>
                {showRupiah ? (
                  <strong className="text-emerald-400">{formatRupiah(row2.omzetToday)}</strong>
                ) : (
                  <span className="opacity-50">Rp ********</span>
                )}
              </span>
            </div>
            <DeltaCell delta={delta2} size="sm" />
          </div>
        </div>

        {/* PODIUM #1: GOLD CHAMPION (Center & Elevated) */}
        <div
          ref={registerRow ? registerRow(row1.outletId) : undefined}
          className={`relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-b from-[var(--card-bg-hover)] via-[var(--card-bg)] to-[var(--bg-surface)] p-4 shadow-md md:-translate-y-1 transition-all ${
            shift1 ? (shift1.diff > 0 ? 'animate-rank-up' : 'animate-rank-down') : ''
          }`}
        >
          {/* Magic UI Border Beam */}
          <BorderBeam colorFrom="#f29744" colorTo="#ffe58f" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 font-black text-stone-950 shadow-md ring-2 ring-amber-200">
                <Trophy size={18} className="stroke-[2.5]" />
              </span>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-amber-500/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/40 shadow-xs">
                  LEADER #1
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-400 border border-amber-500/30">
                  <Flame size={11} className="fill-amber-400" />
                  TOP RUNNER
                </span>
              </div>
              {shift1 && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black tabular ${
                    shift1.diff > 0
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {shift1.diff > 0 ? `▲+${shift1.diff}` : `▼${shift1.diff}`}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 tabular border border-amber-500/25">
                <Zap size={11} />
                +{formatInt(gap1to2)} pcs vs #2
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-2.5 flex items-baseline justify-between gap-2">
            <h3 className="truncate text-lg lg:text-xl font-black tracking-tight text-amber-400 dark:text-amber-300">
              {row1.outletName}
            </h3>
            <div className="text-right shrink-0">
              <span className="text-3xl lg:text-4xl font-black text-amber-400 dark:text-amber-300 tabular tracking-tight leading-none">
                {formatInt(row1.pcsToday)}
              </span>
              <span className="ml-1 text-xs font-bold text-amber-500/80">pcs</span>
            </div>
          </div>

          <div className="relative z-10 mt-3 flex items-center justify-between border-t border-amber-500/20 pt-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-3.5 tabular">
              <span>Trx: <strong className="text-[var(--text-primary)]">{formatInt(row1.trxToday)}</strong></span>
              <span>
                {showRupiah ? (
                  <strong className="text-emerald-400">{formatRupiah(row1.omzetToday)}</strong>
                ) : (
                  <span className="opacity-50">Rp ********</span>
                )}
              </span>
            </div>
            <DeltaCell delta={delta1} size="sm" />
          </div>
        </div>

        {/* PODIUM #3: BRONZE (Right) */}
        <div
          ref={registerRow ? registerRow(row3.outletId) : undefined}
          className={`relative overflow-hidden rounded-xl border border-amber-700/30 bg-gradient-to-b from-[var(--card-bg)] to-[var(--bg-surface)] p-3.5 shadow-sm transition-all hover:border-amber-600/40 ${
            shift3 ? (shift3.diff > 0 ? 'animate-rank-up' : 'animate-rank-down') : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 font-black text-amber-100 shadow-sm ring-1 ring-amber-600/40">
                <Medal size={16} className="stroke-[2.5]" />
              </span>
              <span className="rounded bg-amber-900/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-700/40">
                BRONZE #3
              </span>
              {shift3 && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black tabular ${
                    shift3.diff > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {shift3.diff > 0 ? `▲+${shift3.diff}` : `▼${shift3.diff}`}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-amber-500/80 tabular">
                -{formatInt(gap3to2)} pcs ke #2
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base lg:text-lg font-black tracking-tight text-[var(--text-primary)]">
              {row3.outletName}
            </h3>
            <div className="text-right shrink-0">
              <span className="text-2xl lg:text-3xl font-black text-[var(--text-primary)] tabular tracking-tight leading-none">
                {formatInt(row3.pcsToday)}
              </span>
              <span className="ml-1 text-xs font-bold text-[var(--text-muted)]">pcs</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-3 tabular">
              <span>Trx: <strong className="text-[var(--text-secondary)]">{formatInt(row3.trxToday)}</strong></span>
              <span>
                {showRupiah ? (
                  <strong className="text-emerald-400">{formatRupiah(row3.omzetToday)}</strong>
                ) : (
                  <span className="opacity-50">Rp ********</span>
                )}
              </span>
            </div>
            <DeltaCell delta={delta3} size="sm" />
          </div>
        </div>
      </div>
    </section>
  )
}
