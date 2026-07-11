'use client'

import type { ReactNode } from 'react'
import type { CashTxStatus } from '@/lib/types'

import { Card, Badge } from '@suka/design-system'

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
  const iconTone: Record<string, string> = {
    default: 'bg-suka-gray-100 text-suka-gray-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-suka-orange',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  return (
    <Card className="flex items-center gap-4 p-5">
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
    </Card>
  )
}

const STATUS_META: Record<CashTxStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'error' }> = {
  draft: { label: 'Draft', variant: 'info' },
  pending_approval: { label: 'Menunggu Approval', variant: 'warning' },
  approved: { label: 'Disetujui', variant: 'info' },
  paid: { label: 'Dibayar', variant: 'success' },
  reconciled: { label: 'Terrekonsiliasi', variant: 'success' },
  rejected: { label: 'Ditolak', variant: 'error' },
  void: { label: 'Batal', variant: 'info' },
}

export function TxStatusBadge({ status }: { status: CashTxStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft
  return <Badge variant={m.variant}>{m.label}</Badge>
}

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="!p-0 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-suka-gray-100 px-5 py-4">
        <h2 className="font-bold text-suka-ink">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  )
}
