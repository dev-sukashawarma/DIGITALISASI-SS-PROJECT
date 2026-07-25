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
    default: 'bg-suka-gray-100 text-suka-gray-600 border-suka-gray-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200/80 shadow-[0_2px_8px_rgba(16,185,129,0.12)]',
    orange: 'bg-orange-50 text-suka-orange border-orange-200/80 shadow-[0_2px_8px_rgba(234,88,12,0.12)]',
    red: 'bg-red-50 text-red-600 border-red-200/80 shadow-[0_2px_8px_rgba(239,68,68,0.12)]',
    blue: 'bg-blue-50 text-blue-600 border-blue-200/80 shadow-[0_2px_8px_rgba(59,130,246,0.12)]',
  }
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-suka-gray-200/60 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:bg-white/90 transition-all duration-300 flex items-center gap-4 group relative overflow-hidden">
      {icon && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${iconTone[tone]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-suka-gray-400">{label}</p>
        <p className="truncate text-xl font-black text-suka-brown tracking-tight mt-0.5">{value}</p>
        {hint && <p className="text-[10px] font-semibold text-suka-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
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
    <div className="bg-white/70 backdrop-blur-xl border border-suka-gray-200/60 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-suka-gray-100 px-6 py-4 bg-white/40">
        <h2 className="font-extrabold text-suka-brown text-sm uppercase tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
