'use client'

import React, { type ReactNode } from 'react'
import type { CashTxStatus } from '@/lib/types'
import { motion } from 'framer-motion'
import { Badge } from '@suka/design-system'

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

  const bgTone: Record<string, string> = {
    default: 'group-hover:bg-suka-gray-50',
    green: 'group-hover:bg-emerald-50/30',
    orange: 'group-hover:bg-orange-50/30',
    red: 'group-hover:bg-red-50/30',
    blue: 'group-hover:bg-blue-50/30',
  }

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-suka-brown/5 border border-suka-brown/5 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden ${bgTone[tone]}`}
    >
      <div className="absolute right-0 top-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full -z-0 pointer-events-none ${iconTone[tone].split(' ')[0]}"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          {icon && (
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconTone[tone]}`}>
              {icon}
            </div>
          )}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-suka-ink/60 mb-1">{label}</p>
        <div className="text-3xl font-display text-suka-ink tracking-tight">{value}</div>
        {hint && <p className="text-[10px] font-semibold text-suka-orange mt-2">{hint}</p>}
      </div>
    </motion.div>
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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="bg-white rounded-[2rem] shadow-sm border border-suka-brown/5 overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-suka-brown/5">
        <h2 className="font-display text-xl text-suka-brown tracking-wide">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  )
}

/**
 * Kepala halaman seragam: judul + 1 kalimat penjelas + slot filter opsional.
 * Dipakai di atas setiap halaman fitur agar orang awam selalu tahu ada di mana.
 */
export function PageHeader({
  title,
  description,
  children,
  icon,
}: {
  title: string
  description?: string
  /** Slot kanan, mis. filter periode/outlet. */
  children?: ReactNode
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-8 relative z-50">
      <div className="flex-1">
        {/* Playful Display Header */}
        <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide flex items-center gap-3">
          {icon && React.createElement(icon, { className: "w-8 h-8 md:w-10 md:h-10 text-suka-orange" })}
          {title}
        </h1>
        {description && (
          <p className="text-suka-ink/60 mt-3 font-medium text-sm">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0 xl:mt-2">{children}</div>}
    </div>
  )
}

export * from './ui/StatTile'
export * from './ui/Section'
export * from './ui/Select'
export * from './ui/Skeleton'

