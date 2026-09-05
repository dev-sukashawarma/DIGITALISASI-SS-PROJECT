import { ShoppingBag, Receipt, DollarSign, TrendingUp, Flame } from 'lucide-react'
import { computeDelta } from '@/lib/compare'
import { formatInt, formatRupiah } from '@/lib/format'
import type { BoardRow } from '@/lib/types'
import { DeltaCell } from './DeltaCell'

export function SummaryBar({
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
  const pcs = rows.reduce((a, r) => a + r.pcsToday, 0)
  const trx = rows.reduce((a, r) => a + r.trxToday, 0)
  const omzet = rows.reduce((a, r) => a + r.omzetToday, 0)

  // Baseline total: hanya jumlahkan outlet yang punya baseline
  const withBase = rows.filter((r) => r.pcsBase !== null)
  const pcsBase = withBase.length
    ? withBase.reduce((a, r) => a + (r.pcsBase as number), 0)
    : null
  const pcsForCompare = withBase.reduce((a, r) => a + r.pcsToday, 0)
  const delta = computeDelta(pcsForCompare, pcsBase)

  const avgPcsPerTrx = trx > 0 ? (pcs / trx).toFixed(1) : '0'

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {/* Card 1: Total Pcs (Hero KPI) */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-[var(--card-bg)] to-[var(--card-bg-hover)] p-3.5 shadow-md shadow-amber-500/5">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-amber-400">
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="fill-amber-400 text-amber-400" />
            <span>{isYesterday ? 'Total Pcs (Kemarin)' : 'Total Pcs Terjual'}</span>
          </div>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-amber-400">
            <ShoppingBag size={13} />
          </span>
        </div>
        <div className="mt-1 text-3xl lg:text-4xl font-black text-amber-400 dark:text-amber-300 tabular tracking-tight leading-none">
          {formatInt(pcs)}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>{isYesterday ? 'Rekap akumulasi seluruh outlet kemarin' : 'Akumulasi real-time seluruh outlet aktif'}</span>
        </div>
      </div>

      {/* Card 2: Total Transaksi */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/90 p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <span>{isYesterday ? 'Transaksi (Kemarin)' : 'Total Transaksi'}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-500/10 text-slate-400">
            <Receipt size={13} />
          </span>
        </div>
        <div className="mt-1 text-2xl lg:text-3xl font-black text-[var(--text-primary)] tabular tracking-tight leading-none">
          {formatInt(trx)}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] tabular">
          <span>Rata-rata: <strong className="text-[var(--text-secondary)]">{avgPcsPerTrx}</strong> pcs/struk</span>
        </div>
      </div>

      {/* Card 3: Omzet Kotor Item */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/90 p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <span>{isYesterday ? 'Omzet Kotor (Kemarin)' : 'Omzet Kotor Item'}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
            <DollarSign size={13} />
          </span>
        </div>
        <div className="mt-1 text-xl lg:text-2xl font-black text-[var(--text-primary)] tabular tracking-tight leading-none truncate">
          {showRupiah ? (
            formatRupiah(omzet)
          ) : (
            <span className="font-mono text-lg tracking-widest text-[var(--text-muted)] opacity-60">
              Rp ********
            </span>
          )}
        </div>
        <div className="mt-1.5 text-[10px] text-[var(--text-muted)]">
          {showRupiah ? 'Subtotal item sebelum diskon kasir' : 'Mode privasi aktif (tekan R)'}
        </div>
      </div>

      {/* Card 4: Perbandingan Baseline */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)]/90 p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="truncate">vs {baseLabel}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10 text-sky-400">
            <TrendingUp size={13} />
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <DeltaCell delta={delta} size="lg" />
        </div>
        <div className="mt-1.5 text-[10px] text-[var(--text-muted)] tabular truncate">
          {pcsBase === null ? (
            'Baseline bulan lalu belum tersedia'
          ) : (
            <span>
              Baseline: <strong className="text-[var(--text-secondary)]">{formatInt(pcsBase)} pcs</strong>
              {pcsForCompare - pcsBase !== 0 && (
                <span className="ml-1 opacity-80">
                  ({pcsForCompare - pcsBase > 0 ? '+' : ''}{formatInt(pcsForCompare - pcsBase)} pcs)
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
