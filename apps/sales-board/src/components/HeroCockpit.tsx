'use client'

import {
  Flame,
  Trophy,
  Award,
  Medal,
  Zap,
  Receipt,
  DollarSign,
  TrendingUp,
} from 'lucide-react'
import { formatInt, formatRupiah } from '@/lib/format'
import { computeDelta } from '@/lib/compare'
import type { BoardRow } from '@/lib/types'
import { BorderBeam } from './BorderBeam'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

export function HeroCockpit({
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
  if (rows.length === 0) return null

  // KPI Agregat Seluruh Outlet
  const totalPcs = rows.reduce((a, r) => a + r.pcsToday, 0)
  const totalTrx = rows.reduce((a, r) => a + r.trxToday, 0)
  const totalOmzet = rows.reduce((a, r) => a + r.omzetToday, 0)

  const withBase = rows.filter((r) => r.pcsBase !== null)
  const pcsBase = withBase.length
    ? withBase.reduce((a, r) => a + (r.pcsBase as number), 0)
    : null
  const pcsForCompare = withBase.reduce((a, r) => a + r.pcsToday, 0)
  const totalDelta = computeDelta(pcsForCompare, pcsBase)
  const avgPcsPerTrx = totalTrx > 0 ? (totalPcs / totalTrx).toFixed(1) : '0'

  // Top 3 Outlet
  const row1 = rows[0]
  const row2 = rows[1]
  const row3 = rows[2]

  const gap1to2 = row2 ? row1.pcsToday - row2.pcsToday : 0
  const gap2to1 = row2 ? row1.pcsToday - row2.pcsToday : 0
  const gap3to2 = row3 && row2 ? row2.pcsToday - row3.pcsToday : 0

  const delta1 = row1 ? computeDelta(row1.pcsToday, row1.pcsBase) : null
  const delta2 = row2 ? computeDelta(row2.pcsToday, row2.pcsBase) : null
  const delta3 = row3 ? computeDelta(row3.pcsToday, row3.pcsBase) : null

  const shift1 = row1 ? shifts?.get(row1.outletId) : undefined
  const shift2 = row2 ? shifts?.get(row2.outletId) : undefined
  const shift3 = row3 ? shifts?.get(row3.outletId) : undefined

  return (
    <div className="flex flex-col gap-3.5 h-full justify-between">
      {/* SECTION 1: HERO TOTAL PCS & QUICK TELEMETRY CHIPS */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-[var(--card-bg)] to-[var(--bg-surface)] p-4 shadow-lg shadow-black/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Flame size={16} className="fill-amber-400" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              {isYesterday ? 'Total Pcs Rekap Kemarin' : 'Total Pcs Terjual Hari Ini'}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse-live" />
            20 OUTLET
          </span>
        </div>

        {/* Huge Hero Counter */}
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-5xl lg:text-6xl font-black text-amber-400 dark:text-amber-300 tabular tracking-tight leading-none">
            {formatInt(totalPcs)}
          </span>
          <span className="text-sm font-extrabold uppercase tracking-wider text-amber-500/80">
            pcs
          </span>
        </div>

        {/* 3 Telemetry HUD Chips */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-amber-500/20 pt-3">
          {/* Chip 1: Transaksi */}
          <div className="rounded-xl border border-[var(--border-card)] bg-black/20 p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-[var(--text-muted)] uppercase">
              <Receipt size={12} />
              <span>Transaksi</span>
            </div>
            <div className="mt-0.5 text-base lg:text-lg font-black text-[var(--text-primary)] tabular leading-tight">
              {formatInt(totalTrx)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] tabular truncate">
              {avgPcsPerTrx} pcs/trx
            </div>
          </div>

          {/* Chip 2: Omzet Kotor */}
          <div className="rounded-xl border border-[var(--border-card)] bg-black/20 p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-[var(--text-muted)] uppercase">
              <DollarSign size={12} />
              <span>Omzet (Rp)</span>
            </div>
            <div className="mt-0.5 text-xs lg:text-sm font-black text-emerald-400 tabular leading-tight truncate">
              {showRupiah ? (
                formatRupiah(totalOmzet)
              ) : (
                <span className="font-mono text-xs text-[var(--text-muted)] opacity-60">
                  Rp ********
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] truncate">
              {showRupiah ? 'Kotor item' : 'Tekan [R]'}
            </div>
          </div>

          {/* Chip 3: vs Baseline */}
          <div
            className="rounded-xl border border-[var(--border-card)] bg-black/20 p-2 text-center"
            title={`Perbandingan vs ${baseLabel}`}
          >
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-[var(--text-muted)] uppercase truncate">
              <TrendingUp size={12} />
              <span className="truncate">vs Baseline</span>
            </div>
            <div className="mt-0.5 flex justify-center">
              <DeltaCell delta={totalDelta} size="sm" />
            </div>
            <div className="text-[10px] text-[var(--text-muted)] tabular truncate">
              {pcsBase ? `${formatInt(pcsBase)} base` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHAMPION SPOTLIGHT (#1 LEADER) */}
      {row1 && (
        <div
          ref={registerRow(row1.outletId)}
          className={`relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-[var(--card-bg-hover)] via-[var(--card-bg)] to-[var(--bg-surface)] p-4 shadow-xl transition-all ${
            shift1 ? (shift1.diff > 0 ? 'animate-rank-up' : 'animate-rank-down') : ''
          }`}
        >
          {/* Magic UI Animated Border Beam */}
          <BorderBeam colorFrom="#f29744" colorTo="#ffe58f" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 font-black text-stone-950 shadow-md ring-2 ring-amber-200/80">
                <Trophy size={20} className="stroke-[2.5]" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/40">
                    CHAMPION #1
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-orange-400 border border-orange-500/30">
                    <Flame size={11} className="fill-orange-400" />
                    LEADER
                  </span>
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
              </div>
            </div>

            {row2 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-300 tabular border border-amber-500/30">
                <Zap size={12} className="text-amber-400" />
                +{formatInt(gap1to2)} pcs vs #2
              </span>
            )}
          </div>

          <div className="relative z-10 mt-3 flex items-baseline justify-between gap-3">
            <h2 className="truncate text-xl lg:text-2xl font-black tracking-tight text-amber-400 dark:text-amber-300">
              {row1.outletName}
            </h2>
            <div className="text-right shrink-0">
              <span className="text-3xl lg:text-4xl font-black text-amber-400 dark:text-amber-300 tabular tracking-tight leading-none">
                {formatInt(row1.pcsToday)}
              </span>
              <span className="ml-1 text-xs font-bold text-amber-500/80">pcs</span>
            </div>
          </div>

          <div className="relative z-10 mt-3 flex items-center justify-between border-t border-amber-500/20 pt-2.5 text-xs text-[var(--text-muted)]">
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
            {delta1 && <DeltaCell delta={delta1} size="sm" />}
          </div>
        </div>
      )}

      {/* SECTION 3: CHALLENGER DUO (#2 SILVER & #3 BRONZE) */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Card #2 Silver */}
        {row2 ? (
          <div
            ref={registerRow(row2.outletId)}
            className={`relative overflow-hidden rounded-2xl border border-slate-400/25 bg-gradient-to-b from-[var(--card-bg)] to-[var(--bg-surface)] p-3.5 shadow-md transition-all hover:border-slate-300/40 ${
              shift2 ? (shift2.diff > 0 ? 'animate-rank-up' : 'animate-rank-down') : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 font-black text-slate-900 shadow-sm ring-1 ring-slate-100">
                  <Award size={14} className="stroke-[2.5]" />
                </span>
                <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-300 border border-slate-400/20">
                  #2 SILVER
                </span>
                {shift2 && (
                  <span
                    className={`inline-flex items-center px-1 py-0.2 rounded text-[9px] font-black tabular ${
                      shift2.diff > 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {shift2.diff > 0 ? `▲+${shift2.diff}` : `▼${shift2.diff}`}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-400 tabular">
                -{formatInt(gap2to1)} ke #1
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <h3 className="truncate text-sm lg:text-base font-black tracking-tight text-[var(--text-primary)]">
                {row2.outletName}
              </h3>
              <div className="text-right shrink-0">
                <span className="text-xl lg:text-2xl font-black text-[var(--text-primary)] tabular leading-none">
                  {formatInt(row2.pcsToday)}
                </span>
                <span className="ml-0.5 text-[10px] text-[var(--text-muted)]">pcs</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-1.5 text-[11px] text-[var(--text-muted)]">
              <span>Trx: <strong className="text-[var(--text-secondary)]">{formatInt(row2.trxToday)}</strong></span>
              {delta2 && <DeltaCell delta={delta2} size="sm" />}
            </div>
          </div>
        ) : null}

        {/* Card #3 Bronze */}
        {row3 ? (
          <div
            ref={registerRow(row3.outletId)}
            className={`relative overflow-hidden rounded-2xl border border-amber-700/35 bg-gradient-to-b from-[var(--card-bg)] to-[var(--bg-surface)] p-3.5 shadow-md transition-all hover:border-amber-600/40 ${
              shift3 ? (shift3.diff > 0 ? 'animate-rank-up' : 'animate-rank-down') : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 font-black text-amber-100 shadow-sm ring-1 ring-amber-600/40">
                  <Medal size={14} className="stroke-[2.5]" />
                </span>
                <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300 border border-amber-700/40">
                  #3 BRONZE
                </span>
                {shift3 && (
                  <span
                    className={`inline-flex items-center px-1 py-0.2 rounded text-[9px] font-black tabular ${
                      shift3.diff > 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {shift3.diff > 0 ? `▲+${shift3.diff}` : `▼${shift3.diff}`}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-amber-500/80 tabular">
                -{formatInt(gap3to2)} ke #2
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <h3 className="truncate text-sm lg:text-base font-black tracking-tight text-[var(--text-primary)]">
                {row3.outletName}
              </h3>
              <div className="text-right shrink-0">
                <span className="text-xl lg:text-2xl font-black text-[var(--text-primary)] tabular leading-none">
                  {formatInt(row3.pcsToday)}
                </span>
                <span className="ml-0.5 text-[10px] text-[var(--text-muted)]">pcs</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-1.5 text-[11px] text-[var(--text-muted)]">
              <span>Trx: <strong className="text-[var(--text-secondary)]">{formatInt(row3.trxToday)}</strong></span>
              {delta3 && <DeltaCell delta={delta3} size="sm" />}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
