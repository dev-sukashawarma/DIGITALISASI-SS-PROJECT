'use client'

import type { ReactNode } from 'react'
import type { CashTxStatus } from '@/lib/types'

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  hint,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'green' | 'orange' | 'red' | 'blue'
  hint?: string
}) {
  const toneCls: Record<string, string> = {
    default: 'bg-white',
    green: 'bg-white',
    orange: 'bg-white',
    red: 'bg-white',
    blue: 'bg-white',
  }
  const iconTone: Record<string, string> = {
    default: 'bg-suka-gray-100 text-suka-gray-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-suka-orange',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  return (
    <div className={`flex items-center gap-4 rounded-2xl border border-suka-gray-200 p-5 shadow-sm ${toneCls[tone]}`}>
      {icon && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconTone[tone]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-suka-gray-500">{label}</p>
        <p className="truncate text-xl font-bold text-suka-ink">{value}</p>
        {hint && <p className="text-xs text-suka-gray-400">{hint}</p>}
      </div>
    </div>
  )
}

const STATUS_META: Record<CashTxStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-suka-gray-100 text-suka-gray-600' },
  pending_approval: { label: 'Menunggu Approval', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Disetujui', cls: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Dibayar', cls: 'bg-emerald-100 text-emerald-700' },
  reconciled: { label: 'Terrekonsiliasi', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-700' },
  void: { label: 'Batal', cls: 'bg-suka-gray-100 text-suka-gray-500' },
}

export function TxStatusBadge({ status }: { status: CashTxStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.cls}`}>{m.label}</span>
}

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-suka-gray-100 px-5 py-4">
        <h2 className="font-bold text-suka-ink">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
