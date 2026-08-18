// apps/stok/src/components/permintaan/BudgetBadge.tsx
'use client'
import { budgetBadgeVariant, type BudgetStatus } from '@/lib/stok/budget'

interface Props {
  status: BudgetStatus | null
  projectedAdd?: number
  compact?: boolean
}

const VARIANT_STYLE: Record<'green' | 'orange' | 'red', string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red: 'bg-red-50 text-red-700 border-red-200',
}

const PERIOD_LABEL: Record<string, string> = {
  harian: 'Hari Ini',
  mingguan: 'Minggu Ini',
  bulanan: 'Bulan Ini',
}

export function BudgetBadge({ status, projectedAdd = 0, compact = false }: Props) {
  if (!status) return null
  const variant = budgetBadgeVariant(status, projectedAdd)
  if (variant === 'hidden') return null

  const periodLabel = status.periodType ? PERIOD_LABEL[status.periodType] : ''
  const sisaProyeksi = status.sisa - projectedAdd

  if (compact) {
    const label = variant === 'red'
      ? `Melebihi Budget${sisaProyeksi < 0 ? ` +Rp ${Math.abs(sisaProyeksi).toLocaleString('id-ID')}` : ''}`
      : 'Dalam Budget'
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${VARIANT_STYLE[variant]}`}>
        {label}
      </span>
    )
  }

  return (
    <div className={`text-xs font-bold p-3 rounded-xl border ${VARIANT_STYLE[variant]}`}>
      Sisa Budget {periodLabel}: Rp {Math.max(0, sisaProyeksi).toLocaleString('id-ID')} dari Rp {status.nominal.toLocaleString('id-ID')}
      {projectedAdd > 0 && (
        <span className="block font-normal mt-0.5">
          (termasuk estimasi keranjang saat ini: Rp {projectedAdd.toLocaleString('id-ID')})
        </span>
      )}
    </div>
  )
}
