'use client'

import { Crown, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import type { BoardRow } from '@/lib/types'
import type { Delta } from '@/lib/compare'
import { computeDelta } from '@/lib/compare'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

interface BentoLeftDeckProps {
  p1: BoardRow | undefined
  p2: BoardRow | undefined
  p3: BoardRow | undefined
  summary: {
    totalPcs: number
    totalTrx: number
    totalOmzet: number
    pcsDelta: Delta
  }
  showRupiah: boolean
  registerRow: (id: string) => (el: HTMLElement | null) => void
  shifts: Map<string, RankShiftInfo>
}

export function BentoLeftDeck({
  p1,
  p2,
  p3,
  summary,
  showRupiah,
  registerRow,
  shifts,
}: BentoLeftDeckProps) {
  if (!p1) return null

  const p1Delta = computeDelta(p1.pcsToday, p1.pcsBase)
  const p1Shift = shifts.get(p1.outletId)

  const p2Delta = p2 ? computeDelta(p2.pcsToday, p2.pcsBase) : null
  const p2Shift = p2 ? shifts.get(p2.outletId) : null

  const p3Delta = p3 ? computeDelta(p3.pcsToday, p3.pcsBase) : null
  const p3Shift = p3 ? shifts.get(p3.outletId) : null

  return (
    <div className="flex flex-col gap-3 flex-1 h-full">
      {/* 1. HERO SHOWCASE CARD: RANK 1 TOP BRANCH */}
      <div
        ref={registerRow(p1.outletId)}
        data-flip-key={p1.outletId}
        style={{ flex: '1.45 1 0%' }}
        className="relative min-h-[290px] rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-[var(--card-bg)]/90 to-[var(--card-bg)]/95 backdrop-blur-md p-5 lg:p-6 shadow-[0_0_35px_rgba(245,158,11,0.22)] ring-1 ring-amber-500/30 flex flex-col justify-between overflow-hidden transition-all duration-200"
      >
        {/* Ambient warm glow in top-right */}
        <div className="absolute top-0 right-0 h-56 w-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Row */}
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] lg:text-xs font-black uppercase tracking-widest text-amber-500">
                RANK 1 TOP BRANCH
              </span>
              {p1Shift && p1Shift.diff !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black shadow-xs ${
                    p1Shift.diff > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                  }`}
                >
                  {p1Shift.diff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {p1Shift.diff > 0 ? `+${p1Shift.diff}` : p1Shift.diff}
                </span>
              )}
            </div>
            <div className="text-[10px] lg:text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
              BRANCH SALES LEADER
            </div>
            <h2
              title={p1.outletName}
              className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight text-[var(--text-primary)] uppercase mt-1 truncate"
            >
              {p1.outletName}
            </h2>
          </div>

          {/* Big Rank 1 Numeral */}
          <div className="flex items-center gap-2 shrink-0">
            <Crown size={28} className="text-amber-400 hidden sm:block" />
            <span className="text-6xl lg:text-7xl font-black text-amber-400/90 tabular leading-none select-none">
              1
            </span>
          </div>
        </div>

        {/* Center: Giant Sales Number in Gold */}
        <div className="relative z-10 my-auto py-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              style={{
                backgroundColor: 'var(--gold-bg)',
                borderColor: 'var(--gold-border)',
                color: 'var(--gold-text)',
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-xs"
            >
              <Crown size={12} className="text-amber-400" />
              SALES VOLUME OUTLET
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-6xl lg:text-8xl xl:text-9xl font-black tracking-tight text-amber-400 tabular drop-shadow-sm leading-none">
              {p1.pcsToday.toLocaleString('id-ID')}
            </span>
            <span className="text-2xl lg:text-3xl font-black text-amber-500 tracking-wider">
              PCS
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/35 shadow-xs">
              ⚡ {((p1.pcsToday / (summary.totalPcs || 1)) * 100).toFixed(1)}% Seluruh Outlet
            </span>
            {p2 && (
              <span className="text-[10px] text-amber-400/90 font-bold">
                Memimpin +{p1.pcsToday - p2.pcsToday} PCS dari Rank 2
              </span>
            )}
          </div>
        </div>

        {/* Bottom Hero Metrics Footer (3-column horizontal) */}
        <div className="relative z-10 grid grid-cols-3 gap-3 pt-3 lg:pt-4 border-t border-amber-500/20 text-xs items-center">
          <div
            style={{
              backgroundColor: 'var(--gold-bg)',
              borderColor: 'var(--gold-border)',
            }}
            className="flex flex-col rounded-xl border px-3 py-1.5"
          >
            <span
              style={{ color: 'var(--gold-text)' }}
              className="text-[10px] lg:text-[11px] font-black uppercase tracking-wider"
            >
              SALES TOTAL
            </span>
            <span
              style={{ color: 'var(--gold-text)' }}
              className="text-base lg:text-lg font-black tabular mt-0.5 truncate"
            >
              {showRupiah ? (
                `Rp ${p1.omzetToday.toLocaleString('id-ID')}`
              ) : (
                <span className="tracking-widest font-mono opacity-60 select-none">
                  Rp ••••••
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-col px-2">
            <span className="text-[10px] lg:text-[11px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider">
              TRANSAKSI
            </span>
            <span className="text-base lg:text-lg font-black text-[var(--text-primary)] tabular mt-0.5">
              {p1.trxToday.toLocaleString('id-ID')} Trx
            </span>
          </div>

          <div className="flex flex-col items-end pr-1">
            <span className="text-[10px] lg:text-[11px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider">
              SALES GROWTH
            </span>
            <div className="mt-0.5">
              <DeltaCell delta={p1Delta} size="md" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. DUAL CARDS: RANK 2 & RANK 3 */}
      <div style={{ flex: '0.85 1 0%' }} className="grid grid-cols-2 gap-3 min-h-[165px]">
        {/* Rank 2 Card */}
        {p2 ? (
          <div
            ref={registerRow(p2.outletId)}
            data-flip-key={p2.outletId}
            className="relative rounded-2xl border border-slate-700/60 bg-[var(--card-bg)]/85 backdrop-blur-md p-4 lg:p-5 flex flex-col justify-between shadow-sm transition-all duration-200 hover:border-slate-500/50 h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  RANK 2
                </span>
                {p2Shift && p2Shift.diff !== 0 && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black ${
                      p2Shift.diff > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {p2Shift.diff > 0 ? `▲+${p2Shift.diff}` : `▼${p2Shift.diff}`}
                  </span>
                )}
              </div>
              <span className="text-3xl font-black text-slate-400/80 tabular leading-none">
                2
              </span>
            </div>

            {/* Outlet Name & Sales Number */}
            <div className="my-auto py-1">
              <h3
                title={p2.outletName}
                className="font-black text-base lg:text-lg uppercase text-[var(--text-primary)] truncate"
              >
                {p2.outletName}
              </h3>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl lg:text-4xl font-black text-amber-400 tabular leading-none">
                  {p2.pcsToday.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-extrabold text-amber-500/80">
                  PCS
                </span>
              </div>
              <div className="mt-1 text-[10px] font-semibold text-slate-400/90">
                {((p2.pcsToday / (summary.totalPcs || 1)) * 100).toFixed(1)}% seluruh outlet
              </div>
            </div>

            {/* Subtext Footer */}
            <div className="flex items-center justify-between gap-1 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
              <span className="text-[var(--text-muted)] truncate">
                {showRupiah ? (
                  `Rp ${p2.omzetToday.toLocaleString('id-ID')}`
                ) : (
                  'Rp ••••••'
                )}{' '}
                • {p2.trxToday} Trx
              </span>
              {p2Delta && <DeltaCell delta={p2Delta} size="sm" />}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)] p-4 bg-[var(--card-bg)]/50 h-full" />
        )}

        {/* Rank 3 Card */}
        {p3 ? (
          <div
            ref={registerRow(p3.outletId)}
            data-flip-key={p3.outletId}
            className="relative rounded-2xl border border-amber-900/40 bg-[var(--card-bg)]/85 backdrop-blur-md p-4 lg:p-5 flex flex-col justify-between shadow-sm transition-all duration-200 hover:border-amber-700/50 h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-600/90">
                  RANK 3
                </span>
                {p3Shift && p3Shift.diff !== 0 && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black ${
                      p3Shift.diff > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {p3Shift.diff > 0 ? `▲+${p3Shift.diff}` : `▼${p3Shift.diff}`}
                  </span>
                )}
              </div>
              <span className="text-3xl font-black text-amber-600/80 tabular leading-none">
                3
              </span>
            </div>

            {/* Outlet Name & Sales Number */}
            <div className="my-auto py-1">
              <h3
                title={p3.outletName}
                className="font-black text-base lg:text-lg uppercase text-[var(--text-primary)] truncate"
              >
                {p3.outletName}
              </h3>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl lg:text-4xl font-black text-amber-400 tabular leading-none">
                  {p3.pcsToday.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-extrabold text-amber-500/80">
                  PCS
                </span>
              </div>
              <div className="mt-1 text-[10px] font-semibold text-amber-500/80">
                {((p3.pcsToday / (summary.totalPcs || 1)) * 100).toFixed(1)}% seluruh outlet
              </div>
            </div>

            {/* Subtext Footer */}
            <div className="flex items-center justify-between gap-1 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
              <span className="text-[var(--text-muted)] truncate">
                {showRupiah ? (
                  `Rp ${p3.omzetToday.toLocaleString('id-ID')}`
                ) : (
                  'Rp ••••••'
                )}{' '}
                • {p3.trxToday} Trx
              </span>
              {p3Delta && <DeltaCell delta={p3Delta} size="sm" />}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)] p-4 bg-[var(--card-bg)]/50 h-full" />
        )}
      </div>

      {/* 3. BENTO KPI STRIP (Spotlight Hero Total Sales + Secondary Fleet Metrics) */}
      <div style={{ flex: '0.7 1 0%' }} className="flex gap-3 min-h-[115px]">
        {/* HERO SPOTLIGHT CHAMBER: TOTAL SALES ARMADA */}
        <div
          style={{ borderColor: 'var(--gold-border)' }}
          className="relative w-[38%] rounded-2xl border-2 bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-[var(--card-bg)]/95 backdrop-blur-md p-3 lg:p-3.5 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40 flex flex-col justify-between overflow-hidden"
        >
          {/* Glowing Ambient Halo */}
          <div className="absolute -top-6 -right-6 h-24 w-24 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

          {/* Top Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <span
              style={{
                backgroundColor: 'var(--gold-bg)',
                borderColor: 'var(--gold-border)',
                color: 'var(--gold-text)',
              }}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-xs"
            >
              <Sparkles size={11} className="animate-pulse" />
              TOTAL SALES
            </span>
            <span
              style={{ color: 'var(--gold-text)' }}
              className="text-[9px] font-black uppercase tracking-widest"
            >
              OUTLET
            </span>
          </div>

          {/* Giant Number in Gold */}
          <div className="relative z-10 flex items-baseline gap-1.5 my-auto py-0.5">
            <span className="text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight text-amber-400 tabular drop-shadow-[0_0_15px_rgba(245,158,11,0.4)] leading-none">
              {summary.totalPcs.toLocaleString('id-ID')}
            </span>
            <span className="text-xs lg:text-sm font-black text-amber-500">
              PCS
            </span>
          </div>

          {/* Subtext */}
          <div
            style={{ color: 'var(--gold-text)' }}
            className="relative z-10 flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider opacity-90"
          >
            <span>20 Outlet Aktif</span>
            <span>Semua Outlet</span>
          </div>
        </div>

        {/* 3 Secondary Fleet Metrics */}
        <div className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/85 backdrop-blur-md p-3 lg:p-3.5 grid grid-cols-3 gap-2 divide-x divide-[var(--border-subtle)] shadow-sm">
          {/* Col 1: Transaksi */}
          <div className="flex flex-col justify-between h-full px-2 lg:px-3">
            <span className="text-[10px] lg:text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              TRANSAKSI
            </span>
            <div className="my-auto py-1">
              <span className="text-2xl lg:text-3xl xl:text-4xl font-black text-[var(--text-primary)] tabular leading-none">
                {summary.totalTrx.toLocaleString('id-ID')}
              </span>
            </div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Total Bon Kasir
            </span>
          </div>

          {/* Col 2: Omzet Kotor */}
          <div className="flex flex-col justify-between h-full pl-3 lg:pl-4">
            <span className="text-[10px] lg:text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              OMZET KOTOR
            </span>
            <div className="my-auto py-1 truncate">
              <span className="text-xl lg:text-2xl xl:text-3xl font-black text-[var(--text-primary)] tabular leading-none">
                {showRupiah ? (
                  `Rp ${(summary.totalOmzet / 1000000).toFixed(1)} Jt`
                ) : (
                  <span className="tracking-widest font-mono text-[var(--text-muted)] opacity-60 select-none">
                    Rp ••••••
                  </span>
                )}
              </span>
            </div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Pendapatan Gross
            </span>
          </div>

          {/* Col 3: Sales Growth */}
          <div className="flex flex-col justify-between h-full pl-3 lg:pl-4">
            <span className="text-[10px] lg:text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              SALES GROWTH
            </span>
            <div className="my-auto py-1">
              <DeltaCell delta={summary.pcsDelta} size="md" />
            </div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              vs Baseline
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
