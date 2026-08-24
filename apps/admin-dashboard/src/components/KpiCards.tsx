// @ts-nocheck
import type { SalesSummaryRow } from '@/lib/types'
import type { AggregatedMenuSales } from '@/app/actions/menuSales'
import { aov, deltaPct } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingUp, ShoppingBag, DollarSign, Clock, UtensilsCrossed } from 'lucide-react'
import { motion } from 'framer-motion'

interface KpiCardsProps {
  rows: SalesSummaryRow[]
  prevRows?: SalesSummaryRow[]
  hourlyRows?: { sales_hour: number; omzet: number; jumlah_order_completed: number }[]
  menuRows?: AggregatedMenuSales[]
  prevMenuRows?: AggregatedMenuSales[]
}

export function KpiCards({ rows, prevRows = [], hourlyRows = [], menuRows = [], prevMenuRows = [] }: KpiCardsProps) {
  // Current values
  // Note: r.omzet in DB (sales_hourly_scoped) is SUM(total_amount), which is actually Net Revenue
  const netRevenue = rows.reduce((s, r) => s + r.omzet, 0)
  const totalDeductions = rows.reduce((s, r) => s + (Number((r as any).total_deductions) || 0), 0)
  // To get Gross Revenue (Omzet Kotor), we add the deductions back to the Net Revenue
  const grossRevenue = netRevenue + totalDeductions
  const completed = rows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const currentAov = aov(netRevenue, completed)
  const totalPcs = (menuRows || []).reduce((s, r) => s + (Number(r.qty) || 0), 0)

  // Peak Hour calculation
  let peakHourStr = '-'
  let peakHourOrders = 0
  if (hourlyRows.length > 0) {
    const peak = [...hourlyRows].sort((a, b) => b.jumlah_order_completed - a.jumlah_order_completed || b.omzet - a.omzet)[0]
    if (peak && peak.jumlah_order_completed > 0) {
      const h = peak.sales_hour
      peakHourStr = `${h.toString().padStart(2, '0')}:00`
      peakHourOrders = peak.jumlah_order_completed
    }
  }

  // Previous values
  const prevNetRevenue = prevRows.reduce((s, r) => s + r.omzet, 0)
  const prevCompleted = prevRows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const prevAov = aov(prevNetRevenue, prevCompleted)
  const prevTotalPcs = (prevMenuRows || []).reduce((s, r) => s + (Number(r.qty) || 0), 0)

  // Deltas
  const dGross = deltaPct(grossRevenue, prevNetRevenue + prevRows.reduce((s, r) => s + (Number((r as any).total_deductions) || 0), 0))
  const dNet = deltaPct(netRevenue, prevNetRevenue)
  const dPcs = prevTotalPcs > 0 ? deltaPct(totalPcs, prevTotalPcs) : (totalPcs > 0 && prevTotalPcs === 0 ? 100 : null)
  const dCompleted = deltaPct(completed, prevCompleted)
  const dAov = deltaPct(currentAov, prevAov)

  const cards = [
    {
      label: 'Omzet Penjualan (Kotor)',
      value: grossRevenue,
      isString: false,
      isRupiah: true,
      delta: dGross,
      icon: TrendingUp,
      color: '#f29744', // Suka Orange
      subtext: 'Pemasukan kotor sebelum potongan',
    },
    {
      label: 'Pendapatan Bersih (Net)',
      value: netRevenue,
      isString: false,
      isRupiah: true,
      delta: dNet,
      icon: TrendingUp,
      color: '#0a7d2c', // Suka Green
      subtext: 'Bebas biaya potongan promo/diskon',
    },
    {
      label: 'Total Pcs Terjual',
      value: totalPcs,
      isString: false,
      isRupiah: false,
      delta: dPcs,
      icon: UtensilsCrossed,
      color: '#8b5cf6', // Violet
      subtext: 'Total porsi makanan terjual',
    },
    {
      label: 'Jumlah Order',
      value: completed,
      isString: false,
      isRupiah: false,
      delta: dCompleted,
      icon: ShoppingBag,
      color: '#3b82f6', // Blue
      subtext: 'Transaksi selesai diproses',
    },
    {
      label: 'AOV (Average Order Value)',
      value: currentAov,
      isString: false,
      isRupiah: true,
      delta: dAov,
      icon: DollarSign,
      color: '#701604', // Suka Brown
      subtext: 'Rata-rata nilai per belanja',
    },
  ]

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.08 } },
        hidden: {},
      }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
    >
      {cards.map((c) => {
        if (!c) return null; // In case we want to filter out undefined ones easily
        const Icon = c.icon
        const hasDelta = c.delta !== null && c.delta !== 0 && c.delta !== undefined
        const isPositive = c.delta && c.delta > 0
        
        return (
          <motion.div 
            key={c.label} 
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
            }}
            className="bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm relative overflow-hidden group hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-w-0"
          >
            {/* Aksen Warna Vertikal */}
            <div className="absolute top-0 left-0 w-2 h-full opacity-50 group-hover:opacity-100 transition-opacity duration-300 rounded-l-3xl" style={{ backgroundColor: c.color }} />
            
            <div className="relative z-10 flex flex-col h-full justify-between ml-2">
              <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">{c.label}</p>
                <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">{c.subtext}</p>
              </div>
              <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: `${c.color}10` }}>
                <Icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
            </div>

            <div className="mt-5 flex items-baseline justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-bold text-suka-brown tracking-tight tabular-nums whitespace-nowrap">
                  {c.isString ? (
                    c.value
                  ) : (
                    <>
                      {c.isRupiah ? 'Rp ' : ''}
                      <CountUp 
                        end={c.value as number} 
                        duration={1} 
                        separator="." 
                        decimals={c.isPercent || c.isDecimal ? 1 : 0}
                        decimal=","
                      />
                      {c.isPercent ? '%' : ''}
                    </>
                  )}
                </h3>
              </div>
              
              {hasDelta && (
                <span 
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 ${
                    isPositive 
                      ? 'text-green-700 bg-green-100/80' 
                      : 'text-rose-500 bg-rose-50'
                  }`}
                >
                  {isPositive ? '▲' : '▼'} {Math.abs(c.delta as number).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                </span>
              )}
            </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

