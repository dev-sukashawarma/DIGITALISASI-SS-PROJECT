import React from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * State kosong yang ramah: ikon + pesan + (opsional) tombol aksi.
 * Hindari layar kosong yang membingungkan orang awam.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-suka-cream flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-suka-orange" />
        </div>
      )}
      <p className="text-sm font-bold text-suka-ink">{title}</p>
      {description && <p className="text-xs text-suka-gray-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
