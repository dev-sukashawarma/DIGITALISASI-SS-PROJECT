import type { SalesSummaryRow, MenuSalesRow } from '@/lib/types'
import { aov, deltaPct } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingUp, ShoppingBag, DollarSign, Utensils } from 'lucide-react'

interface KpiCardsProps {
  rows: SalesSummaryRow[]
  prevRows?: SalesSummaryRow[]
  menuRows?: MenuSalesRow[]
  prevMenuRows?: MenuSalesRow[]
}

export function KpiCards({ rows, prevRows = [], menuRows = [], prevMenuRows = [] }: KpiCardsProps) {
  // Current values
  const omzet = rows.reduce((s, r) => s + r.omzet, 0)
  const completed = rows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const currentAov = aov(omzet, completed)
  
  const totalItems = menuRows.reduce((s, r) => s + r.qty, 0)
  const currentBasketSize = completed > 0 ? totalItems / completed : 0

  // Previous values
  const prevOmzet = prevRows.reduce((s, r) => s + r.omzet, 0)
  const prevCompleted = prevRows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const prevAov = aov(prevOmzet, prevCompleted)
  
  const prevTotalItems = prevMenuRows.reduce((s, r) => s + r.qty, 0)
  const prevBasketSize = prevCompleted > 0 ? prevTotalItems / prevCompleted : 0

  // Deltas
  const dOmzet = deltaPct(omzet, prevOmzet)
  const dCompleted = deltaPct(completed, prevCompleted)
  const dAov = deltaPct(currentAov, prevAov)
  const dBasketSize = prevBasketSize > 0 ? Math.round(((currentBasketSize - prevBasketSize) / prevBasketSize) * 1000) / 10 : null

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
      label: 'Item per Transaksi',
      value: currentBasketSize,
      isRupiah: false,
      isPercent: false,
      isDecimal: true,
      delta: dBasketSize,
      icon: Utensils,
      color: '#4b5563', // Slate Gray
      subtext: 'Rata-rata porsi tiap order',
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
                    decimals={c.isPercent || c.isDecimal ? 1 : 0}
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
                  {isPositive ? '▲' : '▼'} {Math.abs(c.delta!).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
