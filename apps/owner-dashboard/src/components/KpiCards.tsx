import type { SalesSummaryRow } from '@/lib/types'
import { aov, pct, deltaPct } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingUp, ShoppingBag, DollarSign, Percent } from 'lucide-react'

interface KpiCardsProps {
  rows: SalesSummaryRow[]
  prevRows?: SalesSummaryRow[]
}

export function KpiCards({ rows, prevRows = [] }: KpiCardsProps) {
  // Current values
  const omzet = rows.reduce((s, r) => s + r.omzet, 0)
  const completed = rows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const all = rows.reduce((s, r) => s + r.jumlah_order_all, 0)
  const currentAov = aov(omzet, completed)
  const currentPct = pct(completed, all)

  // Previous values
  const prevOmzet = prevRows.reduce((s, r) => s + r.omzet, 0)
  const prevCompleted = prevRows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const prevAll = prevRows.reduce((s, r) => s + r.jumlah_order_all, 0)
  const prevAov = aov(prevOmzet, prevCompleted)
  const prevPct = pct(prevCompleted, prevAll)

  // Deltas
  const dOmzet = deltaPct(omzet, prevOmzet)
  const dCompleted = deltaPct(completed, prevCompleted)
  const dAov = deltaPct(currentAov, prevAov)
  const dPct = prevPct > 0 ? currentPct - prevPct : null

  const cards = [
    {
      label: 'Omzet Penjualan',
      value: omzet,
      isRupiah: true,
      delta: dOmzet,
      icon: TrendingUp,
      color: '#0a7d2c', // Suka Green
      subtext: 'Pemasukan bersih dari kasir',
    },
    {
      label: 'Jumlah Order',
      value: completed,
      isRupiah: false,
      delta: dCompleted,
      icon: ShoppingBag,
      color: '#f29744', // Suka Orange
      subtext: 'Transaksi selesai diproses',
    },
    {
      label: 'AOV (Average Order Value)',
      value: currentAov,
      isRupiah: true,
      delta: dAov,
      icon: DollarSign,
      color: '#701604', // Suka Brown
      subtext: 'Rata-rata nilai per belanja',
    },
    {
      label: 'Rasio Order Completed',
      value: currentPct,
      isRupiah: false,
      isPercent: true,
      delta: dPct,
      icon: Percent,
      color: '#4b5563', // Slate Gray
      subtext: 'Persen order sukses vs batal',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        const hasDelta = c.delta !== null && c.delta !== 0
        const isPositive = c.delta && c.delta > 0
        
        return (
          <div 
            key={c.label} 
            className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">{c.label}</p>
                <p className="text-[10px] text-suka-gray-400 font-semibold mt-0.5">{c.subtext}</p>
              </div>
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${c.color}10` }}>
                <Icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
            </div>

            <div className="mt-6 flex items-baseline justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-suka-brown tracking-tight">
                  {c.isRupiah ? 'Rp ' : ''}
                  <CountUp 
                    end={c.value} 
                    duration={1} 
                    separator="." 
                    decimals={c.isPercent ? 1 : 0}
                    decimal=","
                  />
                  {c.isPercent ? '%' : ''}
                </h3>
              </div>
              
              {hasDelta && (
                <span 
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    isPositive 
                      ? 'text-suka-green bg-green-50' 
                      : 'text-red-700 bg-red-50'
                  }`}
                >
                  {isPositive ? '▲' : '▼'} {Math.abs(c.delta!)}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
