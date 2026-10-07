'use client'

import { useState } from 'react'

export function TawaranBot({
  teks,
  pilihan,
  aktif,
  onKirim,
}: {
  teks: string
  pilihan: { label: string; pesan: string }[]
  aktif: boolean
  onKirim?: (pesan: string) => void
}) {
  const [dipilih, setDipilih] = useState<number | null>(null)
  const mati = !aktif || dipilih !== null || !onKirim
  return (
    <div className="w-full min-w-0 rounded-lg border border-[#E8DCCB] bg-[#FDF9F3] p-3">
      <p className="mb-2 text-sm text-[#2B1B17]">{teks}</p>
      <div className="flex flex-wrap gap-2">
        {pilihan.map((p, i) => (
          <button
            key={i}
            type="button"
            disabled={mati}
            onClick={() => {
              if (mati) return
              setDipilih(i)
              onKirim?.(p.pesan)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed ${
              i === 0 ? 'bg-suka-orange text-white' : 'border border-[#E8DCCB] bg-white text-[#4A1713]'
            } ${mati && dipilih !== i ? 'opacity-40' : ''} ${dipilih === i ? 'ring-2 ring-[#4A1713]' : ''}`}
          >
            {dipilih === i ? '✓ ' : ''}
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
