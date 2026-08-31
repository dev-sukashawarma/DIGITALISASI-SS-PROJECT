// @ts-nocheck
import type { SalesSummaryRow } from '@/lib/types'
import type { AggregatedMenuSales } from '@/app/actions/menuSales'
import { aov, deltaPct } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingUp, DollarSign, UtensilsCrossed, Boxes, Receipt } from 'lucide-react'
import { motion } from 'framer-motion'

interface KpiCardsProps {
  rows: SalesSummaryRow[]
  prevRows?: SalesSummaryRow[]
  hourlyRows?: { sales_hour: number; omzet: number; jumlah_order_completed: number }[]
  menuRows?: AggregatedMenuSales[]
  prevMenuRows?: AggregatedMenuSales[]
  curCogs?: number
  prevCogs?: number
  curOpex?: number
  prevOpex?: number
  curCogsOpex?: number
  prevCogsOpex?: number
  cogsBreakdown?: { cogs: number; opex: number }
}

export function KpiCards({
  rows,
  prevRows = [],
  hourlyRows = [],
  menuRows = [],
  prevMenuRows = [],
  curCogs: propCurCogs,
  prevCogs: propPrevCogs,
  curOpex: propCurOpex,
  prevOpex: propPrevOpex,
  curCogsOpex = 0,
  prevCogsOpex = 0,
  cogsBreakdown,
}: KpiCardsProps) {
  // Extract COGS & OPEX with fallback
  const curCogs = propCurCogs ?? cogsBreakdown?.cogs ?? 0
  const curOpex = propCurOpex ?? cogsBreakdown?.opex ?? 0
  const prevCogs = propPrevCogs ?? 0
  const prevOpex = propPrevOpex ?? 0

  const totalCurCogsOpex = curCogsOpex || (curCogs + curOpex)
  const totalPrevCogsOpex = prevCogsOpex || (prevCogs + prevOpex)

  // Current values
  // Note: r.omzet in DB (sales_hourly_scoped) is SUM(total_amount), which is actually Net Revenue
  const netRevenue = rows.reduce((s, r) => s + r.omzet, 0)
  const totalDeductions = rows.reduce((s, r) => s + (Number((r as any).total_deductions) || 0), 0)
  // To get Gross Revenue (Omzet Kotor), we add the deductions back to the Net Revenue
  const grossRevenue = netRevenue + totalDeductions
  const completed = rows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const currentAov = aov(netRevenue, completed)
  const totalPcs = (menuRows || []).reduce((s, r) => s + (Number(r.qty) || 0), 0)

  // Previous values
  const prevNetRevenue = prevRows.reduce((s, r) => s + r.omzet, 0)
  const prevTotalDeductions = prevRows.reduce((s, r) => s + (Number((r as any).total_deductions) || 0), 0)
  const prevGrossRevenue = prevNetRevenue + prevTotalDeductions
  const prevCompleted = prevRows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const prevAov = aov(prevNetRevenue, prevCompleted)
  const prevTotalPcs = (prevMenuRows || []).reduce((s, r) => s + (Number(r.qty) || 0), 0)

  // Deltas: Laba Bersih (Net) = Omzet Kotor - Potongan - (COGS + OPEX)
  const netProfit = (grossRevenue - totalDeductions) - totalCurCogsOpex
  const prevNetProfit = (prevGrossRevenue - prevTotalDeductions) - totalPrevCogsOpex

  const dGross = deltaPct(grossRevenue, prevGrossRevenue)
  const dCogs = prevCogs > 0 ? deltaPct(curCogs, prevCogs) : null
  const dOpex = prevOpex > 0 ? deltaPct(curOpex, prevOpex) : null
  const dPcs = prevTotalPcs > 0 ? deltaPct(totalPcs, prevTotalPcs) : (totalPcs > 0 && prevTotalPcs === 0 ? 100 : null)
  const dCompleted = deltaPct(completed, prevCompleted)
  const dAov = deltaPct(currentAov, prevAov)
  const dNet = prevNetProfit !== 0 ? deltaPct(netProfit, prevNetProfit) : null

  const cards = [
    // 1. Omzet Kotor
    {
      id: 'omzet-kotor',
      label: 'Omzet Penjualan (Kotor)',
      value: grossRevenue,
      isString: false,
      isRupiah: true,
      delta: dGross,
      icon: TrendingUp,
      color: '#f29744', // Suka Orange
      subtext: 'Pemasukan kotor sebelum potongan',
    },
    // 2. Total COGS (HPP)
    {
      id: 'cogs',
      label: 'Total COGS (HPP)',
      value: curCogs,
      isString: false,
      isRupiah: true,
      delta: dCogs,
      icon: Boxes,
      color: '#f97316', // Orange / Amber
      subtext: 'HPP bahan baku resep',
    },
    // 3. Beban Operasional (OPEX)
    {
      id: 'opex',
      label: 'Beban Operasional (OPEX)',
      value: curOpex,
      isString: false,
      isRupiah: true,
      delta: dOpex,
      icon: Receipt,
      color: '#ef4444', // Rose / Red
      subtext: 'Biaya operasional & petty cash',
    },
    // 4. Total Pcs Terjual + Jumlah Order (Combined)
    {
      id: 'pcs-order',
      isCustom: true,
      label: 'Total Pcs & Order',
      subtext: 'Porsi makanan & transaksi selesai',
      totalPcs,
      completed,
      dPcs,
      dCompleted,
      icon: UtensilsCrossed,
      color: '#8b5cf6', // Violet
    },
    // 5. Average (AOV)
    {
      id: 'average',
      label: 'AOV (Average Order Value)',
      value: currentAov,
      isString: false,
      isRupiah: true,
      delta: dAov,
      icon: DollarSign,
      color: '#0284c7', // Sky Blue
      subtext: 'Rata-rata nilai per belanja',
    },
    // 6. Net (Laba Bersih: Omzet Kotor - (COGS+OPEX))
    {
      id: 'net',
      label: 'Laba Bersih (Net)',
      value: netProfit,
      isString: false,
      isRupiah: true,
      delta: dNet,
      icon: TrendingUp,
      color: netProfit >= 0 ? '#0a7d2c' : '#ef4444',
      subtext: 'Omzet kotor - potongan - (COGS+OPEX)',
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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4"
    >
      {cards.map((c) => {
        if (!c) return null
        const Icon = c.icon

        if (c.isCustom && c.id === 'pcs-order') {
          const hasPcsDelta = c.dPcs !== null && c.dPcs !== 0 && c.dPcs !== undefined
          const isPcsPositive = c.dPcs && c.dPcs > 0

          return (
            <motion.div 
              key={c.id} 
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
              }}
              className="bg-white/80 backdrop-blur-xl p-3.5 sm:p-4 xl:p-4.5 rounded-2xl sm:rounded-3xl border border-suka-brown/10 shadow-sm relative overflow-hidden group hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-w-0"
            >
              {/* Aksen Warna Vertikal */}
              <div className="absolute top-0 left-0 w-2 h-full opacity-50 group-hover:opacity-100 transition-opacity duration-300 rounded-l-2xl sm:rounded-l-3xl" style={{ backgroundColor: c.color }} />
              
              <div className="relative z-10 flex flex-col h-full justify-between ml-1.5 sm:ml-2">
                <div className="flex justify-between items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-xs font-semibold text-suka-gray-500 uppercase tracking-wider truncate" title={c.label}>{c.label}</p>
                    <p className="text-[10px] sm:text-[11px] text-suka-gray-400 font-medium mt-0.5 truncate" title={c.subtext}>{c.subtext}</p>
                  </div>
                  <div className="p-1.5 sm:p-2 rounded-xl shrink-0" style={{ backgroundColor: `${c.color}10` }}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: c.color }} />
                  </div>
                </div>

                <div className="mt-3.5 sm:mt-4 flex items-baseline justify-between gap-1.5 flex-wrap">
                  <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
                    <div className="flex items-baseline gap-1">
                      <h3 className="text-base sm:text-lg xl:text-xl font-bold text-suka-brown tracking-tight tabular-nums whitespace-nowrap">
                        <CountUp end={c.totalPcs as number} duration={1} separator="." />
                      </h3>
                      <span className="text-[10px] sm:text-[11px] font-bold text-suka-gray-500 uppercase">Pcs</span>
                    </div>

                    <span className="text-suka-gray-300 font-bold">•</span>

                    <div className="flex items-baseline gap-1">
                      <h3 className="text-base sm:text-lg xl:text-xl font-bold text-suka-brown tracking-tight tabular-nums whitespace-nowrap">
                        <CountUp end={c.completed as number} duration={1} separator="." />
                      </h3>
                      <span className="text-[10px] sm:text-[11px] font-bold text-suka-gray-500 uppercase">Order</span>
                    </div>
                  </div>
                  
                  {hasPcsDelta && (
                    <span 
                      className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 shrink-0 ${
                        isPcsPositive 
                          ? 'text-green-700 bg-green-100/80' 
                          : 'text-rose-500 bg-rose-50'
                      }`}
                      title="Pertumbuhan Pcs"
                    >
                      {isPcsPositive ? '▲' : '▼'} {Math.abs(c.dPcs as number).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )
        }

        const hasDelta = c.delta !== null && c.delta !== 0 && c.delta !== undefined
        const isPositive = c.delta && c.delta > 0
        const isNegativeVal = typeof c.value === 'number' && c.value < 0
        const absVal = Math.abs((c.value as number) || 0)
        
        return (
          <motion.div 
            key={c.id || c.label} 
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
            }}
            className="bg-white/80 backdrop-blur-xl p-3.5 sm:p-4 xl:p-4.5 rounded-2xl sm:rounded-3xl border border-suka-brown/10 shadow-sm relative overflow-hidden group hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-w-0"
          >
            {/* Aksen Warna Vertikal */}
            <div className="absolute top-0 left-0 w-2 h-full opacity-50 group-hover:opacity-100 transition-opacity duration-300 rounded-l-2xl sm:rounded-l-3xl" style={{ backgroundColor: c.color }} />
            
            <div className="relative z-10 flex flex-col h-full justify-between ml-1.5 sm:ml-2">
              <div className="flex justify-between items-start gap-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs font-semibold text-suka-gray-500 uppercase tracking-wider truncate" title={c.label}>{c.label}</p>
                  <p className="text-[10px] sm:text-[11px] text-suka-gray-400 font-medium mt-0.5 truncate" title={c.subtext}>{c.subtext}</p>
                </div>
                <div className="p-1.5 sm:p-2 rounded-xl shrink-0" style={{ backgroundColor: `${c.color}10` }}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: c.color }} />
                </div>
              </div>

              <div className="mt-3.5 sm:mt-4 flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg xl:text-xl font-bold text-suka-brown tracking-tight tabular-nums whitespace-nowrap">
                    {c.isString ? (
                      c.value
                    ) : (
                      <>
                        {c.isRupiah ? (isNegativeVal ? '-Rp ' : 'Rp ') : ''}
                        <CountUp 
                          end={absVal} 
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
                    className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 shrink-0 ${
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

