'use client'

import type { BlokKartu } from '@/lib/botHrd/uraiPesan'

const NADA = {
  netral: 'border-[#E8DCCB] bg-white text-[#4A1713]',
  baik: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  peringatan: 'border-amber-200 bg-amber-50 text-amber-700',
  bahaya: 'border-red-200 bg-red-50 text-red-700',
} as const

export function KartuBot({ judul, item }: Pick<BlokKartu, 'judul' | 'item'>) {
  return (
    <div className="@container w-full min-w-0 space-y-1">
      {judul && <p className="text-xs font-semibold text-[#4A1713]">{judul}</p>}
      <div className="grid grid-cols-2 gap-2 @[34rem]:grid-cols-4">
        {item.map((it, i) => (
          <div key={i} className={`min-w-0 rounded-lg border px-2.5 py-2 ${NADA[it.nada ?? 'netral']}`}>
            <p className="truncate text-[10px] font-medium uppercase tracking-wide opacity-70">{it.label}</p>
            <p className="break-words text-lg font-bold leading-tight">
              {typeof it.nilai === 'number' ? it.nilai.toLocaleString('id-ID') : it.nilai}
            </p>
            {it.keterangan && <p className="mt-0.5 text-[10px] leading-snug opacity-80">{it.keterangan}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
