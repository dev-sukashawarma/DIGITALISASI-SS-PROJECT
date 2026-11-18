import { Package } from 'lucide-react'
import { isBigOrder, type BigOrderLike } from '@/lib/big-order'

export default function BigOrderBadge({
  order,
  active,
  size = 'sm',
}: {
  order?: BigOrderLike | null
  active?: boolean
  size?: 'sm' | 'md'
}) {
  const show = active !== undefined ? active : isBigOrder(order)
  if (!show) return null
  const isMd = size === 'md'

  return (
    <span
      className={`inline-flex items-center gap-1 font-extrabold uppercase tracking-wider rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 whitespace-nowrap ${
        isMd ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5'
      }`}
      title="Big Order — Potongan diskon 15% otomatis dari total transaksi"
    >
      <Package className={isMd ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-3 shrink-0'} strokeWidth={2.5} />
      Big Order -15%
    </span>
  )
}
