import { Trophy, Award, Medal } from 'lucide-react'
import { computeDelta } from '@/lib/compare'
import { formatInt, formatRupiah } from '@/lib/format'
import type { BoardRow } from '@/lib/types'
import { DeltaCell } from './DeltaCell'
import { useFlipList } from '@/hooks/useFlipList'

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 font-black text-stone-950 shadow-sm ring-1 ring-amber-200">
        <Trophy size={13} className="stroke-[2.5]" />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 font-black text-slate-900 shadow-sm ring-1 ring-slate-100">
        <Award size={13} className="stroke-[2.5]" />
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 font-black text-amber-100 shadow-sm ring-1 ring-amber-600/40">
        <Medal size={13} className="stroke-[2.5]" />
      </span>
    )
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-card)] bg-[var(--card-bg)] text-[11px] font-black text-[var(--text-muted)] tabular">
      {rank}
    </span>
  )
}

export function RankingTable({
  rows,
  baseLabel,
  showRupiah,
  isYesterday,
}: {
  rows: BoardRow[]
  baseLabel: string
  showRupiah: boolean
  isYesterday?: boolean
}) {
  const max = Math.max(1, ...rows.map((r) => r.pcsToday))
  const { registerRow, shifts } = useFlipList(rows)

  return (
    <section className="px-6 lg:px-8 pb-3">
      <div className="overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] shadow-sm">
        {/* Table Column Headers */}
        <div className="grid grid-cols-[4.6rem_1fr_7.5rem_6rem_10.5rem_10.5rem] items-center gap-x-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
          <div className="text-center">Pos</div>
          <div>Outlet</div>
          <div className="text-right text-amber-500">{isYesterday ? 'Pcs (Kemarin)' : 'Pcs Hari Ini'}</div>
          <div className="text-right">Transaksi</div>
          <div className="text-right">{showRupiah ? 'Omzet Kotor Item' : 'Omzet (Privasi)'}</div>
          <div className="text-right">vs {baseLabel}</div>
        </div>

        {/* Rows with FLIP smooth reordering animation */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {rows.map((r, i) => {
            const rank = i + 1
            const pctOfMax = (r.pcsToday / max) * 100
            const isTop3 = rank <= 3
            const delta = computeDelta(r.pcsToday, r.pcsBase)
            const shift = shifts.get(r.outletId)
            const shiftAnimationClass = shift
              ? shift.diff > 0
                ? 'animate-rank-up'
                : 'animate-rank-down'
              : ''

            return (
              <div
                key={r.outletId}
                ref={registerRow(r.outletId)}
                className={`relative grid grid-cols-[4.6rem_1fr_7.5rem_6rem_10.5rem_10.5rem] items-center gap-x-4 px-4 py-1 transition-colors hover:bg-[var(--row-hover)] ${
                  rank % 2 === 0 ? 'bg-[var(--row-stripe)]' : ''
                } ${shiftAnimationClass}`}
              >
                {/* Visual Relative Volume Meter Bar */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 -z-10 rounded-r-md border-r border-amber-400/30 bg-gradient-to-r from-[var(--bar-fill-start)] to-transparent transition-all duration-500"
                  style={{ width: `${pctOfMax}%` }}
                />

                {/* Rank Badge + Shift Indicator */}
                <div className="flex items-center justify-center gap-1.5">
                  <RankBadge rank={rank} />
                  {shift ? (
                    <span
                      className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-black tabular leading-none shadow-xs ${
                        shift.diff > 0
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                      }`}
                      title={`Sebelumnya peringkat #${shift.oldRank}`}
                    >
                      {shift.diff > 0 ? `▲+${shift.diff}` : `▼${shift.diff}`}
                    </span>
                  ) : null}
                </div>

                {/* Outlet Name */}
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`truncate text-sm lg:text-base leading-tight tracking-tight ${
                      rank === 1
                        ? 'font-black text-amber-400 dark:text-amber-300'
                        : isTop3
                          ? 'font-extrabold text-[var(--text-primary)]'
                          : 'font-bold text-[var(--text-secondary)]'
                    }`}
                  >
                    {r.outletName}
                  </span>
                  {rank === 1 && (
                    <span className="hidden xl:inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/30">
                      LEADER
                    </span>
                  )}
                </div>

                {/* Pcs (Hero Column) */}
                <div className="text-right">
                  <span
                    className={`text-lg lg:text-xl font-black tabular leading-none ${
                      rank === 1
                        ? 'text-amber-400 dark:text-amber-300'
                        : isTop3
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {formatInt(r.pcsToday)}
                  </span>
                </div>

                {/* Transaksi */}
                <div className="text-right text-xs lg:text-sm font-semibold text-[var(--text-muted)] tabular">
                  {formatInt(r.trxToday)}
                </div>

                {/* Omzet Kotor */}
                <div className="text-right text-xs lg:text-sm font-bold text-[var(--text-secondary)] tabular truncate">
                  {showRupiah ? (
                    formatRupiah(r.omzetToday)
                  ) : (
                    <span className="font-mono text-xs text-[var(--text-muted)] opacity-50">
                      ********
                    </span>
                  )}
                </div>

                {/* vs Baseline Delta */}
                <div className="flex items-center justify-end gap-2 text-right">
                  {r.pcsBase !== null && (
                    <span className="hidden xl:inline-block text-xs text-[var(--text-muted)] tabular">
                      {formatInt(r.pcsBase)}
                    </span>
                  )}
                  <DeltaCell delta={delta} size="sm" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
