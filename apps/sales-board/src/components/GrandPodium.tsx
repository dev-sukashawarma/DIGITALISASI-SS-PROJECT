'use client'

import { Crown, Medal, Award, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import type { BoardRow } from '@/lib/types'
import { computeDelta } from '@/lib/compare'
import { DeltaCell } from './DeltaCell'
import type { RankShiftInfo } from '@/hooks/useFlipList'

interface GrandPodiumProps {
  rows: BoardRow[]
  totalPcs: number
  showRupiah: boolean
  registerRow: (id: string) => (el: HTMLElement | null) => void
  shifts: Map<string, RankShiftInfo>
}

const getRankConfig = (rank: number) => {
  if (rank === 1) {
    return {
      title: 'APEX LEADER',
      badgeBg: 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black',
      cardBorder: 'border-amber-500/45 shadow-[0_0_24px_rgba(245,158,11,0.18)]',
      glowGrad: 'from-amber-500/10 via-amber-500/5 to-transparent',
      icon: <Crown size={18} className="fill-current text-slate-950" />,
      numColor: 'text-amber-400',
      accentColor: 'bg-amber-400',
    }
  }
  if (rank === 2) {
    return {
      title: 'RUNNER UP',
      badgeBg: 'bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black',
      cardBorder: 'border-slate-400/35 shadow-[0_0_18px_rgba(203,213,225,0.1)]',
      glowGrad: 'from-slate-400/10 via-slate-400/5 to-transparent',
      icon: <Award size={16} className="fill-current text-slate-950" />,
      numColor: 'text-slate-200',
      accentColor: 'bg-slate-300',
    }
  }
  return {
    title: 'CONTENDER',
    badgeBg: 'bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 font-black',
    cardBorder: 'border-amber-700/35 shadow-[0_0_18px_rgba(180,83,9,0.1)]',
    glowGrad: 'from-amber-700/10 via-amber-700/5 to-transparent',
    icon: <Medal size={16} className="fill-current text-amber-100" />,
    numColor: 'text-amber-300',
    accentColor: 'bg-amber-600',
  }
}

export function GrandPodium({
  rows,
  totalPcs,
  showRupiah,
  registerRow,
  shifts,
}: GrandPodiumProps) {
  // Ambil top 3 outlets dengan fallback aman
  const p1 = rows[0]
  const p2 = rows[1]
  const p3 = rows[2]

  if (!p1) return null

  // Susunan visual podium olimpiade / esports: [Peringkat 2] [Peringkat 1] [Peringkat 3]
  const podiumEntries = [
    { row: p2, rank: 2, role: 'runner_up' as const },
    { row: p1, rank: 1, role: 'champion' as const },
    { row: p3, rank: 3, role: 'contender' as const },
  ].filter((entry) => Boolean(entry.row))

  const p1Pcs = p1.pcsToday

  return (
    <section aria-label="Grand Apex Podium" className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 lg:gap-3 items-stretch">
        {podiumEntries.map(({ row, rank, role }) => {
          if (!row) return null
          const isChamp = role === 'champion'
          const delta = computeDelta(row.pcsToday, row.pcsBase)
          const sharePct = totalPcs > 0 ? ((row.pcsToday / totalPcs) * 100).toFixed(1) : '0.0'
          const gapToLeader = p1Pcs - row.pcsToday
          const shift = shifts.get(row.outletId)
          const rankConfig = getRankConfig(rank)

          return (
            <div
              key={row.outletId}
              ref={registerRow(row.outletId)}
              data-flip-key={row.outletId}
              className={`relative rounded-2xl border ${rankConfig.cardBorder} bg-[var(--card-bg)]/95 backdrop-blur-md p-4 lg:p-5 min-h-[165px] lg:min-h-[185px] flex flex-col justify-between overflow-hidden transition-all duration-200 shadow-md ${
                isChamp ? 'md:-translate-y-1 ring-2 ring-amber-400/40' : ''
              }`}
            >
              {/* Background ambient glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-b ${rankConfig.glowGrad} pointer-events-none`}
              />

              {/* Top Header Card: Rank Pill, Outlet Name & Shift Badge */}
              <div className="relative z-10 flex items-center justify-between gap-2.5 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] tracking-wider uppercase shadow-sm ${rankConfig.badgeBg}`}
                  >
                    {rankConfig.icon}
                    <span>#{rank}</span>
                    <span className="opacity-95">{rankConfig.title}</span>
                  </span>

                  <h2
                    title={row.outletName}
                    className="font-black text-base lg:text-lg tracking-tight text-[var(--text-primary)] truncate"
                  >
                    {row.outletName}
                  </h2>
                </div>

                {/* Shift delta indicator */}
                {shift && shift.diff !== 0 && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black animate-bounce shadow-md ${
                      shift.diff > 0
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {shift.diff > 0 ? (
                      <>
                        <TrendingUp size={14} />
                        +{shift.diff}
                      </>
                    ) : (
                      <>
                        <TrendingDown size={14} />
                        {shift.diff}
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Center Hero: Massive Pcs Counter & Velocity Bar */}
              <div className="relative z-10 my-2 flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-4xl lg:text-5xl font-black tracking-tight tabular ${rankConfig.numColor}`}
                  >
                    {row.pcsToday.toLocaleString('id-ID')}
                  </span>
                  <span className="text-sm font-extrabold text-[var(--text-muted)] tracking-wider">
                    PCS
                  </span>
                </div>

                {/* Relative Share / Gap Pill */}
                <div className="text-right">
                  {rank === 1 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-xs font-black text-amber-300">
                      <Sparkles size={13} />
                      {sharePct}% Share Rantai
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-500/20 border border-slate-500/30 px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] tabular">
                      -{gapToLeader} pcs ke puncak
                    </span>
                  )}
                </div>
              </div>

              {/* Battle Progress Gauge */}
              <div className="relative z-10 mb-3">
                <div className="h-2 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${rankConfig.accentColor} transition-all duration-500 shadow-sm`}
                    style={{
                      width: `${p1Pcs > 0 ? Math.min(100, Math.max(8, (row.pcsToday / p1Pcs) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Bottom Footer: Trx, Omzet, & Growth Delta */}
              <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-[var(--border-subtle)] text-xs lg:text-[13px]">
                <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                  <span>
                    <strong className="text-[var(--text-primary)] font-bold">
                      {row.trxToday.toLocaleString('id-ID')}
                    </strong>{' '}
                    Trx
                  </span>
                  <span>•</span>
                  <span>
                    {showRupiah ? (
                      <span className="font-bold text-[var(--text-primary)] tabular">
                        Rp {row.omzetToday.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="tracking-widest font-mono text-[var(--text-muted)] opacity-60 select-none">
                        Rp ••••••
                      </span>
                    )}
                  </span>
                </div>

                <div>
                  <DeltaCell delta={delta} size="md" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
