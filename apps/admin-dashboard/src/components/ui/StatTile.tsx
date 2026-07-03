import React from 'react'
import type { LucideIcon } from 'lucide-react'

type Accent = 'orange' | 'green' | 'brown' | 'red'

const ACCENT: Record<Accent, { icon: string; iconBg: string; sub: string }> = {
  orange: { icon: 'text-suka-orange', iconBg: 'bg-suka-orange/10', sub: 'text-suka-orange' },
  green: { icon: 'text-suka-green', iconBg: 'bg-suka-green/10', sub: 'text-suka-green' },
  brown: { icon: 'text-suka-brown', iconBg: 'bg-suka-brown/10', sub: 'text-suka-brown' },
  red: { icon: 'text-red-600', iconBg: 'bg-red-500/10', sub: 'text-red-600' },
}

/**
 * Kartu angka utama: label kecil, ANGKA BESAR, aksen warna, sub-teks opsional.
 * Batasi maksimal 3 per layar agar informasi penting menonjol.
 */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'brown',
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: LucideIcon
  accent?: Accent
}) {
  const a = ACCENT[accent]
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start gap-2">
        <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className={`p-2 rounded-xl ${a.iconBg}`}>
            <Icon className={`w-5 h-5 ${a.icon}`} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-extrabold text-suka-brown">{value}</h3>
        {sub && <p className={`text-[10px] font-bold mt-1 uppercase ${a.sub}`}>{sub}</p>}
      </div>
    </div>
  )
}
