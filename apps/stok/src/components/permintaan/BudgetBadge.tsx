// apps/stok/src/components/permintaan/BudgetBadge.tsx
'use client'
import { budgetBadgeVariant, type BudgetStatus } from '@/lib/stok/budget'
import { Wallet, AlertTriangle } from 'lucide-react'

interface Props {
  status: BudgetStatus | null
  projectedAdd?: number
  compact?: boolean
}

const VARIANT_STYLE: Record<'green' | 'orange' | 'red', string> = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  orange: 'bg-amber-50 text-amber-800 border-amber-200/80',
  red: 'bg-red-50 text-red-800 border-red-200/80',
}

const PERIOD_LABEL: Record<string, string> = {
  harian: 'Hari Ini',
  mingguan: 'Minggu Ini',
  bulanan: 'Bulan Ini',
  custom: 'Periode Ini',
}

function getPeriodLabel(periodType: string | null, customDays?: number | null): string {
  if (!periodType) return ''
  if (periodType === 'custom' && customDays) return `${customDays} Hari Ini`
  return PERIOD_LABEL[periodType] ?? periodType
}

export function BudgetBadge({ status, projectedAdd = 0, compact = false }: Props) {
  if (!status) return null
  const variant = budgetBadgeVariant(status, projectedAdd)
  if (variant === 'hidden') return null

  const periodLabel = getPeriodLabel(status.periodType, status.customDays)
  const sisaProyeksi = status.sisa - projectedAdd

  if (compact) {
    const label =
      variant === 'red'
        ? `Melebihi Budget${sisaProyeksi < 0 ? ` +Rp ${Math.abs(sisaProyeksi).toLocaleString('id-ID')}` : ''}`
        : variant === 'orange'
        ? 'Mendekati Budget'
        : 'Dalam Budget'
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${VARIANT_STYLE[variant]}`}>
        {variant === 'red' && <AlertTriangle className="w-2.5 h-2.5" />}
        {label}
      </span>
    )
  }

  return (
    <div className={`text-xs font-bold p-3.5 rounded-2xl border shadow-2xs ${VARIANT_STYLE[variant]}`}>
      <div className="flex items-center gap-2">
        <Wallet className={`w-4 h-4 shrink-0 ${variant === 'red' ? 'text-red-600' : variant === 'orange' ? 'text-amber-600' : 'text-emerald-600'}`} />
        <div className="flex-1">
          <span>
            Sisa Budget {periodLabel}: <strong className="font-black">Rp {Math.max(0, sisaProyeksi).toLocaleString('id-ID')}</strong> dari Rp {status.nominal.toLocaleString('id-ID')}
          </span>
          {projectedAdd > 0 && (
            <span className="block font-medium opacity-80 text-[11px] mt-0.5">
              (Termasuk estimasi keranjang saat ini: +Rp {projectedAdd.toLocaleString('id-ID')})
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

