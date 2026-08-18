import React from 'react'
import { Package, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react'
import type { FluktuasiHargaItem } from '@/hooks/useFluktuasiHarga'

interface HargaBahanSummaryCardsProps {
  items: FluktuasiHargaItem[]
  activeStatusFilter: 'all' | 'naik' | 'turun' | 'stabil'
  onStatusFilterChange: (status: 'all' | 'naik' | 'turun' | 'stabil') => void
}

export function HargaBahanSummaryCards({
  items,
  activeStatusFilter,
  onStatusFilterChange
}: HargaBahanSummaryCardsProps) {
  const totalBahan = items.length

  const naikItems = items.filter(
    (it) => it.selisih_pct_prev !== null && it.selisih_pct_prev > 0
  )

  const turunItems = items.filter(
    (it) => it.selisih_pct_prev !== null && it.selisih_pct_prev < 0
  )

  const stabilItems = items.filter(
    (it) => it.harga_terakhir !== null && !naikItems.includes(it) && !turunItems.includes(it)
  )

  const cards = [
    {
      id: 'all' as const,
      label: 'Total Bahan Baku',
      count: totalBahan,
      desc: 'Semua item aktif dalam katalog',
      icon: Package,
      iconColor: 'text-[#701604]',
      bgColor: 'bg-[#faf2e9]',
      borderColor: 'border-[#d9c2b2]/50',
      activeBorder: 'ring-2 ring-[#701604] border-[#701604]',
      badgeColor: 'bg-white text-[#701604]'
    },
    {
      id: 'naik' as const,
      label: 'Harga Mengalami Kenaikan',
      count: naikItems.length,
      desc: 'Lebih mahal dibanding pembelian sebelumnya',
      icon: TrendingUp,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50/80',
      borderColor: 'border-red-200',
      activeBorder: 'ring-2 ring-red-500 border-red-500',
      badgeColor: 'bg-red-600 text-white'
    },
    {
      id: 'turun' as const,
      label: 'Harga Mengalami Penurunan',
      count: turunItems.length,
      desc: 'Lebih hemat dibanding pembelian sebelumnya',
      icon: TrendingDown,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50/80',
      borderColor: 'border-emerald-200',
      activeBorder: 'ring-2 ring-emerald-500 border-emerald-500',
      badgeColor: 'bg-emerald-600 text-white'
    },
    {
      id: 'stabil' as const,
      label: 'Harga Tetap / Stabil',
      count: stabilItems.length,
      desc: 'Harga sama dengan pembelian sebelumnya',
      icon: CheckCircle2,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50/70',
      borderColor: 'border-blue-200',
      activeBorder: 'ring-2 ring-blue-500 border-blue-500',
      badgeColor: 'bg-blue-600 text-white'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon
        const isSelected = activeStatusFilter === card.id

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onStatusFilterChange(card.id)}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden shadow-xs hover:shadow-md cursor-pointer ${
              card.bgColor
            } ${card.borderColor} ${isSelected ? `${card.activeBorder} shadow-md scale-[1.01]` : 'hover:border-suka-brown/30'}`}
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-white/90 shadow-2xs border border-black/5">
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${card.badgeColor} shadow-2xs`}>
                {card.count} Item
              </span>
            </div>

            <div className="mt-3">
              <div className="text-xl font-black text-suka-brown font-display tracking-tight">
                {card.count}
              </div>
              <div className="text-xs font-bold text-suka-brown/80 mt-0.5">
                {card.label}
              </div>
              <div className="text-[11px] text-suka-brown/60 mt-1 font-medium line-clamp-1">
                {card.desc}
              </div>
            </div>

            {isSelected && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-suka-orange" />
            )}
          </button>
        )
      })}
    </div>
  )
}
