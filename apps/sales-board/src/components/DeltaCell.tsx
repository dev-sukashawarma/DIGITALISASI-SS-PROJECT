import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react'
import type { Delta } from '@/lib/compare'

export function DeltaCell({
  delta,
  size = 'sm',
}: {
  delta: Delta
  size?: 'sm' | 'md' | 'lg'
}) {
  if (delta.kind === 'none') {
    const sizeClasses =
      size === 'lg'
        ? 'text-xl font-bold px-3 py-1'
        : size === 'md'
          ? 'text-sm font-semibold px-2 py-0.5'
          : 'text-xs font-semibold px-1.5 py-0.5'
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md text-[var(--text-muted)] opacity-60 tabular ${sizeClasses}`}
      >
        -
      </span>
    )
  }

  if (delta.kind === 'new') {
    const sizeClasses =
      size === 'lg'
        ? 'text-sm font-black px-3 py-1 gap-1.5'
        : size === 'md'
          ? 'text-xs font-bold px-2.5 py-0.5 gap-1'
          : 'text-[11px] font-bold px-2 py-0.5 gap-1'
    return (
      <span
        className={`inline-flex items-center rounded-full bg-sky-500/15 text-sky-400 dark:text-sky-300 border border-sky-500/30 font-bold uppercase tracking-wider ${sizeClasses}`}
      >
        <Sparkles size={size === 'lg' ? 14 : 11} />
        baru
      </span>
    )
  }

  if (delta.kind === 'flat') {
    const sizeClasses =
      size === 'lg'
        ? 'text-lg font-bold px-3 py-1 gap-1.5'
        : size === 'md'
          ? 'text-sm font-semibold px-2 py-0.5 gap-1'
          : 'text-xs font-medium px-2 py-0.5 gap-1'
    return (
      <span
        className={`inline-flex items-center rounded-md bg-slate-500/15 text-slate-400 dark:text-slate-300 border border-slate-500/20 tabular ${sizeClasses}`}
      >
        <Minus size={size === 'lg' ? 16 : 12} />
        {Math.abs(delta.pct ?? 0).toFixed(1)}%
      </span>
    )
  }

  const isUp = delta.kind === 'up'
  const Icon = isUp ? ArrowUpRight : ArrowDownRight

  const sizeClasses =
    size === 'lg'
      ? 'text-2xl font-black px-3.5 py-1.5 gap-1.5'
      : size === 'md'
        ? 'text-sm font-bold px-2.5 py-1 gap-1'
        : 'text-xs font-bold px-2 py-0.5 gap-0.5'

  const colorClasses = isUp
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'

  return (
    <span
      className={`inline-flex items-center rounded-lg font-bold tabular transition-transform ${colorClasses} ${sizeClasses}`}
    >
      <Icon
        size={size === 'lg' ? 22 : size === 'md' ? 16 : 13}
        className={isUp ? 'text-emerald-500' : 'text-rose-500'}
        strokeWidth={2.5}
      />
      <span>{isUp ? '+' : '-'}{Math.abs(delta.pct ?? 0).toFixed(1)}%</span>
    </span>
  )
}
