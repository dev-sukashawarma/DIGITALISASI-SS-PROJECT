'use client'

import React from 'react'

interface QuickChipsProps {
  onPilih: (teks: string) => void
  disabled?: boolean
}

const CHIPS_PERTANYAAN = [
  { label: '📅 Jadwal Konten Hari Ini', prompt: 'Konten apa saja yang dijadwalkan tayang hari ini?' },
  { label: '⭐ Draft Review Endorsement', prompt: 'Endorsement mana yang draft videonya masih butuh direview?' },
  { label: '📊 Analisis Konten Minggu Ini', prompt: 'Bagaimana analisis performa konten, total views, dan rata-rata ER% minggu ini?' },
  { label: '💰 Budget Iklan Outlet', prompt: 'Bagaimana realisasi biaya iklan vs target budget per outlet bulan ini?' },
  { label: '🏷️ Promo Aktif Saat Ini', prompt: 'Promo apa saja yang sedang berjalan aktif di outlet hari ini?' },
]

export function QuickChips({ onPilih, disabled }: QuickChipsProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-1 no-scrollbar text-xs">
      {CHIPS_PERTANYAAN.map((chip, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onPilih(chip.prompt)}
          className="whitespace-nowrap rounded-full border border-orange-200 bg-orange-50/70 px-3 py-1 text-orange-900 transition-all hover:bg-orange-100 hover:border-orange-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 font-medium text-[11px]"
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
