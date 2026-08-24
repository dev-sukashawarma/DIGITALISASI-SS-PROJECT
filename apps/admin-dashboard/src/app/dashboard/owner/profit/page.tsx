// @ts-nocheck
'use client'

import { useMemo, useState } from 'react'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesDaily } from '@/hooks/useSalesDaily'
import { useExpenses } from '@/hooks/useExpenses'
import { useHpp } from '@/hooks/useHpp'
import { useWaste } from '@/hooks/useWaste'
import { computeProfit, computeCompanyProfit } from '@/lib/profit'
import { PeriodFilter } from '@/components/PeriodFilter'
import { rupiah } from '@/lib/format'
import { PageHeader, StatTile, Section, StatTilesSkeleton } from '@/components/ui'
import CountUp from 'react-countup'
import { 
  TrendingUp, 
  TrendingDown, 
  Boxes, 
  Layers, 
  Building2, 
  Receipt, 
  Wallet, 
  Banknote, 
  Calculator,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  PieChart,
  Store,
  Sparkles,
  Search,
  ArrowUpDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export default function ProfitPage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
  const [outletSearch, setOutletSearch] = useState('')
  const [sortBy, setSortBy] = useState<'net' | 'margin' | 'omzet'>('net')

  const sales = useSalesDaily(filter, outlets)
  const expenses = useExpenses(filter)
  const hpp = useHpp(filter)
  const waste = useWaste(filter)

  const loading = sales.loading || expenses.loading || hpp.loading || waste.loading
  const error = sales.error || expenses.error || hpp.error || waste.error

  const isAllOutlets = filter.outletId === 'all'

  // Calculations (Filter out any test outlet)
  const actualGrossRevenue = useMemo(
    () => sales.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + r.omzet, 0), 
    [sales.rows]
  )
  const actualNetRevenue = actualGrossRevenue

  const totalPotongan = useMemo(
    () => sales.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (r.total_deductions || 0), 0), 
    [sales.rows]
  )
  const totalPlatformFee = useMemo(
    () => sales.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (r.platform_fee || 0), 0), 
    [sales.rows]
  )
  const totalDeductions = totalPotongan + totalPlatformFee

  const pengeluaranOutletBulanan = useMemo(
    () => expenses.rows.filter(r => r.scope === 'outlet' && r.source === 'monthly' && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name)).reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows]
  )
  const pengeluaranOutletPettyCash = useMemo(
    () => expenses.rows.filter(r => r.scope === 'outlet' && r.source === 'petty_cash' && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name)).reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows]
  )
  const pengeluaranOutlet = pengeluaranOutletBulanan + pengeluaranOutletPettyCash
  const pengeluaranPusat = useMemo(
    () => expenses.rows.filter(r => r.scope === 'pusat').reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows]
  )
    
  const totalHpp = useMemo(
    () => hpp.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + r.hpp, 0), 
    [hpp.rows]
  )
  const totalWaste = useMemo(
    () => waste.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + r.nilai_waste, 0), 
    [waste.rows]
  )
  
  const { netRevenue, labaKotor, labaBersih, marginKotor } = computeProfit(actualGrossRevenue, totalDeductions, totalHpp, pengeluaranOutlet, totalWaste)
  
  const labaPerusahaan = computeCompanyProfit(labaBersih, pengeluaranPusat).labaPerusahaan
  const displayLaba = isAllOutlets ? labaPerusahaan : labaBersih
  const displayMargin = netRevenue > 0 ? (displayLaba / netRevenue) * 100 : 0

  const totalBiaya = totalDeductions + totalHpp + totalWaste + pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)

  // Cost proportions
  const pctHpp = netRevenue > 0 ? Math.min(100, Math.round((totalHpp / netRevenue) * 100)) : 0
  const pctOpex = netRevenue > 0 ? Math.min(100, Math.round(((pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)) / netRevenue) * 100)) : 0
  const pctWaste = netRevenue > 0 ? Math.min(100, Math.round((totalWaste / netRevenue) * 100)) : 0
  const pctFee = netRevenue > 0 ? Math.min(100, Math.round((totalDeductions / netRevenue) * 100)) : 0

  // Outlets breakdown
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; deductions: number; expense: number; hpp: number; waste: number }>()

    outlets.filter(o => !isTestOutlet(o)).forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 })
    })

    sales.rows.filter(s => !isTestOutlet(s.outlet_id)).forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name, omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.omzet += s.omzet
      cur.deductions += (s.total_deductions || 0) + (s.platform_fee || 0)
      map.set(s.outlet_id, cur)
    })

    expenses.rows.filter(e => !isTestOutlet(e.outlet_id) && !isTestOutlet(e.outlet_name)).forEach(e => {
      if (e.scope !== 'outlet' || !e.outlet_id) return
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    hpp.rows.filter(h => !isTestOutlet(h.outlet_id)).forEach(h => {
      const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.hpp += h.hpp
      map.set(h.outlet_id, cur)
    })

    waste.rows.filter(w => !isTestOutlet(w.outlet_id)).forEach(w => {
      const cur = map.get(w.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.waste += w.nilai_waste
      map.set(w.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        const grossRev = val.omzet
        const netRev = val.omzet
        const labaKotor = grossRev - val.hpp - val.deductions
        const net = labaKotor - val.expense - val.waste
        const margin = netRev > 0 ? (net / netRev) * 100 : 0
        const totalCost = val.deductions + val.hpp + val.waste + val.expense
        return { 
          id, 
          name: val.name, 
          omzet: grossRev, 
          deductions: val.deductions, 
          netRev, 
          expense: val.expense, 
          hpp: val.hpp, 
          waste: val.waste, 
          labaKotor, 
          net, 
          margin,
          totalCost 
        }
      })
      .filter(item => item.omzet > 0 || item.expense > 0 || item.hpp > 0 || item.waste > 0)
      .sort((a, b) => {
        if (sortBy === 'margin') return b.margin - a.margin
        if (sortBy === 'omzet') return b.netRev - a.netRev
        return b.net - a.net
      })
  }, [sales.rows, expenses.rows, hpp.rows, waste.rows, outlets, sortBy])

  const filteredOutlets = useMemo(() => {
    if (!outletSearch.trim()) return outletBreakdown
    return outletBreakdown.filter(o => o.name.toLowerCase().includes(outletSearch.toLowerCase()))
  }, [outletBreakdown, outletSearch])

  const profitableOutletsCount = outletBreakdown.filter(o => o.net > 0).length
  const lossOutletsCount = outletBreakdown.filter(o => o.net < 0).length

  // Health diagnosis
  const isHealthy = displayMargin >= 20
  const isModerate = displayMargin >= 5 && displayMargin < 20

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <PageHeader 
        title="Laba Rugi & Profitabilitas" 
        description="Analisis mendalam perbandingan omzet penjualan, beban pokok, dan biaya operasional" 
        icon={Calculator}
      >
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} />
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
          <span>Gagal memuat data keuangan: {error}</span>
        </div>
      )}

      {loading ? (
        <StatTilesSkeleton count={4} />
      ) : (
        <div className="space-y-8">
          
          {/* 1. TOP EXECUTIVE HERO METRICS (Balanced 4-Column Grid) */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Card 1: Pendapatan Bersih */}
            <div className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Pendapatan Bersih</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Uang riil masuk sistem POS</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold">Rp </span>
                  <CountUp end={netRevenue} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    100% Omzet
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Beban Pokok (COGS + Waste) */}
            <div className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Beban Pokok (HPP)</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Modal bahan resep & waste</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold text-amber-800">-Rp </span>
                  <CountUp end={totalHpp + totalWaste} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-suka-gray-500 font-semibold">
                  <span>HPP: {rupiah(totalHpp)}</span>
                  <span>•</span>
                  <span>Waste: {rupiah(totalWaste)}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Beban Operasional (OPEX) */}
            <div className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Biaya Operasional</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Gaji, sewa, listrik & kas</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold text-rose-700">-Rp </span>
                  <CountUp end={pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-suka-gray-500 font-semibold">
                  <span>{isAllOutlets ? `Outlet + Pusat` : `Beban Outlet`}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Laba Bersih (Net Profit) - Hero Highlight */}
            <div className={`p-5 rounded-3xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${
              displayLaba >= 0 
                ? 'bg-gradient-to-br from-orange-50/80 via-white to-amber-50/50 border-suka-orange/30' 
                : 'bg-gradient-to-br from-rose-50/80 via-white to-red-50/50 border-rose-200'
            }`}>
              <div className={`absolute top-0 left-0 w-2 h-full rounded-l-3xl ${displayLaba >= 0 ? 'bg-suka-orange' : 'bg-rose-600'}`} />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-extrabold text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-suka-orange" /> Laba Bersih (Net)
                  </p>
                  <p className="text-[11px] text-suka-gray-500 font-medium mt-0.5">Hasil laba bersih akhir</p>
                </div>
                <div className={`p-2.5 rounded-2xl ${displayLaba >= 0 ? 'bg-orange-100 text-suka-orange' : 'bg-rose-100 text-rose-600'}`}>
                  <Banknote className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${displayLaba >= 0 ? 'text-suka-brown' : 'text-rose-600'}`}>
                  <span className="text-base font-semibold">{displayLaba < 0 ? '-Rp ' : 'Rp '}</span>
                  <CountUp end={Math.abs(displayLaba)} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    displayLaba >= 0 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}>
                    Margin: {displayMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 2. CORE DUAL SECTION: P&L Statement (2/3) + Financial Health & Cost Structure (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* LEFT 2 COLS: STRUCTURED P&L STATEMENT */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-6 sm:p-7 space-y-6">
                
                <div className="flex items-center justify-between border-b border-suka-gray-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-suka-brown tracking-tight flex items-center gap-2">
                      <Layers className="w-5 h-5 text-suka-orange" /> Laporan Laba Rugi Komprehensif
                    </h2>
                    <p className="text-xs text-suka-gray-500 font-medium mt-0.5">Alur perhitungan pendapatan bersih, biaya pokok, dan laba operasional</p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-suka-cream rounded-xl text-suka-brown border border-suka-brown/10">
                    P&L Formal
                  </span>
                </div>

                {/* BLOCK 1: PENDAPATAN (REVENUE) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-suka-gray-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 1. Aliran Pendapatan (Revenue)
                  </div>
                  <div className="bg-suka-gray-50/70 rounded-2xl p-4 space-y-2.5 text-sm border border-suka-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-suka-gray-600">Omzet Kotor Penjualan (Gross Sales)</span>
                      <span className="font-bold text-suka-brown">{rupiah(actualGrossRevenue)}</span>
                    </div>
                    {totalDeductions > 0 && (
                      <div className="flex justify-between items-center text-xs text-rose-600 pl-4 border-l-2 border-rose-300">
                        <span>Potongan Diskon & Estimasi Biaya Aplikasi</span>
                        <span className="font-semibold">-{rupiah(totalDeductions)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-suka-gray-200 flex justify-between items-center font-bold">
                      <span className="text-suka-brown">Pendapatan Bersih (Net Revenue)</span>
                      <span className="text-emerald-700 font-black text-base">{rupiah(netRevenue)}</span>
                    </div>
                  </div>
                </div>

                {/* BLOCK 2: BIAYA POKOK & MARGIN KOTOR (COGS & GROSS PROFIT) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-suka-gray-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> 2. Beban Pokok Penjualan (COGS)
                  </div>
                  <div className="bg-suka-gray-50/70 rounded-2xl p-4 space-y-2.5 text-sm border border-suka-gray-100">
                    <div className="flex justify-between items-center text-rose-600">
                      <span className="font-medium">Total Modal Bahan Dasar (HPP Resep)</span>
                      <span className="font-bold">-{rupiah(totalHpp)}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-600">
                      <span className="font-medium">Kerugian Bahan Rusak / Basi (Waste)</span>
                      <span className="font-bold">-{rupiah(totalWaste)}</span>
                    </div>
                    <div className="pt-2 border-t border-suka-gray-200 flex justify-between items-center font-bold">
                      <div className="flex items-center gap-2">
                        <span className="text-suka-brown">Laba Kotor (Gross Profit)</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Margin: {marginKotor.toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-suka-brown font-black text-base">{rupiah(labaKotor)}</span>
                    </div>
                  </div>
                </div>

                {/* BLOCK 3: BEBAN OPERASIONAL (OPEX) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-suka-gray-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> 3. Beban Operasional (OPEX)
                  </div>
                  <div className="bg-suka-gray-50/70 rounded-2xl p-4 space-y-2.5 text-sm border border-suka-gray-100">
                    <div className="flex justify-between items-center text-rose-600">
                      <span className="font-medium">Beban Tetap & Bulanan Outlet (Gaji, Listrik, Sewa)</span>
                      <span className="font-bold">-{rupiah(pengeluaranOutletBulanan)}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-600">
                      <span className="font-medium">Biaya Kas Kecil Operasional (Petty Cash)</span>
                      <span className="font-bold">-{rupiah(pengeluaranOutletPettyCash)}</span>
                    </div>
                    {isAllOutlets && pengeluaranPusat > 0 && (
                      <div className="flex justify-between items-center text-rose-600">
                        <span className="font-medium">Beban Operasional Kantor Pusat (Manajemen)</span>
                        <span className="font-bold">-{rupiah(pengeluaranPusat)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* FINAL TOTAL ROW */}
                <div className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                  displayLaba >= 0 
                    ? 'bg-suka-cream/50 border-suka-orange/30 text-suka-brown' 
                    : 'bg-rose-50/60 border-rose-200 text-rose-900'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black uppercase tracking-wide">LABA BERSIH AKHIR (NET PROFIT)</span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        displayLaba >= 0 ? 'bg-suka-orange text-white' : 'bg-rose-600 text-white'
                      }`}>
                        {displayMargin.toFixed(1)}% Margin
                      </span>
                    </div>
                    <p className="text-xs text-suka-gray-500 mt-1">Keuntungan bersih riil setelah dikurangi seluruh beban dan biaya</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl sm:text-3xl font-black tracking-tight ${displayLaba >= 0 ? 'text-suka-brown' : 'text-rose-600'}`}>
                      {displayLaba < 0 ? '-' : ''}{rupiah(Math.abs(displayLaba))}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT 1 COL: COST ANATOMY & FINANCIAL HEALTH */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Cost Anatomy Breakdown Card */}
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-suka-orange" />
                  <h3 className="font-black text-suka-brown text-sm uppercase tracking-wider">Struktur Biaya vs Omzet</h3>
                </div>

                {/* Mini Multi-Bar */}
                <div className="space-y-2">
                  <div className="h-4 w-full bg-suka-gray-100 rounded-full overflow-hidden flex shadow-inner">
                    <div style={{ width: `${pctHpp}%` }} className="bg-amber-500 h-full" title={`HPP: ${pctHpp}%`} />
                    <div style={{ width: `${pctOpex}%` }} className="bg-rose-500 h-full" title={`Opex: ${pctOpex}%`} />
                    <div style={{ width: `${pctFee}%` }} className="bg-purple-500 h-full" title={`Potongan/Fee: ${pctFee}%`} />
                    <div style={{ width: `${pctWaste}%` }} className="bg-red-700 h-full" title={`Waste: ${pctWaste}%`} />
                  </div>
                  <div className="flex justify-between text-[10px] text-suka-gray-400 font-semibold uppercase">
                    <span>Total Beban: {((totalBiaya / (netRevenue || 1)) * 100).toFixed(0)}%</span>
                    <span>Sisa Margin: {displayMargin.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Progress items */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> HPP (Bahan Baku)
                    </span>
                    <span className="font-bold text-suka-brown">{pctHpp}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Biaya Operasional (Opex)
                    </span>
                    <span className="font-bold text-suka-brown">{pctOpex}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span> Potongan & Komisi
                    </span>
                    <span className="font-bold text-suka-brown">{pctFee}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-700"></span> Waste (Bahan Basi)
                    </span>
                    <span className="font-bold text-suka-brown">{pctWaste}%</span>
                  </div>
                </div>

                {/* Diagnosis Box */}
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
                  isHealthy 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                    : isModerate
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isHealthy ? 'Margin Sehat' : isModerate ? 'Perhatian: Margin Sedang' : 'Peringatan: Margin Kritis / Rugi'}</span>
                  </div>
                  <p className="opacity-90">
                    {isHealthy 
                      ? 'Efisiensi biaya dan HPP terkendali dengan baik, menghasilkan margin laba bersih di atas target standar 20%.' 
                      : isModerate 
                      ? 'Margin bersih berada di rentang 5-20%. Evaluasi efisiensi operasional dan pengeluaran kas kecil.' 
                      : 'Bisnis mengalami defisit atau margin di bawah 5%. Segera audit HPP resep dan kurangi biaya opex outlet.'}
                  </p>
                </div>

              </div>

            </div>

          </div>

          {/* 3. OUTLET PERFORMANCE LEADERBOARD (Full Width Table with Filtering & Sorting) */}
          {isAllOutlets && (
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden space-y-4 p-6">
              
              {/* Header Table with Search and Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-suka-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-suka-brown tracking-tight flex items-center gap-2">
                    <Store className="w-5 h-5 text-suka-orange" /> Kinerja Profitabilitas per Outlet
                  </h3>
                  <p className="text-xs text-suka-gray-400 font-medium mt-0.5">
                    Menampilkan {filteredOutlets.length} outlet ({profitableOutletsCount} untung, {lossOutletsCount} rugi)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* Search box */}
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-4 h-4 text-suka-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Cari nama outlet..." 
                      value={outletSearch}
                      onChange={(e) => setOutletSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-suka-gray-50 border border-suka-gray-200 rounded-xl text-xs font-medium text-suka-brown placeholder-suka-gray-400 focus:outline-none focus:ring-2 focus:ring-suka-orange/30"
                    />
                  </div>

                  {/* Sort selector */}
                  <div className="flex items-center gap-1.5 bg-suka-gray-50 p-1 border border-suka-gray-200 rounded-xl text-xs font-semibold">
                    <button 
                      onClick={() => setSortBy('net')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'net' ? 'bg-white text-suka-brown shadow-sm font-bold' : 'text-suka-gray-500 hover:text-suka-brown'}`}
                    >
                      Laba Bersih
                    </button>
                    <button 
                      onClick={() => setSortBy('margin')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'margin' ? 'bg-white text-suka-brown shadow-sm font-bold' : 'text-suka-gray-500 hover:text-suka-brown'}`}
                    >
                      Margin %
                    </button>
                    <button 
                      onClick={() => setSortBy('omzet')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'omzet' ? 'bg-white text-suka-brown shadow-sm font-bold' : 'text-suka-gray-500 hover:text-suka-brown'}`}
                    >
                      Omzet
                    </button>
                  </div>
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-suka-cream/20 text-left text-suka-gray-500 font-bold text-xs uppercase border-b border-suka-brown/5">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">Nama Outlet</th>
                      <th className="py-3.5 px-4 text-right">Omzet Net</th>
                      <th className="py-3.5 px-4 text-right">Beban Pokok (HPP)</th>
                      <th className="py-3.5 px-4 text-right">Biaya Opex</th>
                      <th className="py-3.5 px-4 text-right">Laba Bersih</th>
                      <th className="py-3.5 px-4 text-center">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium text-suka-ink">
                    {filteredOutlets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-suka-gray-400">
                          Tidak ditemukan outlet yang cocok dengan pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredOutlets.map((row, index) => {
                        const isProfit = row.net >= 0
                        const marginBadge = row.margin >= 20 
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-200' 
                          : row.margin >= 5 
                          ? 'text-amber-800 bg-amber-50 border-amber-200' 
                          : 'text-rose-800 bg-rose-50 border-rose-200'

                        return (
                          <tr 
                            key={row.id} 
                            className="hover:bg-orange-50/30 transition-colors group"
                          >
                            <td className="py-3.5 px-4 text-center text-suka-gray-400 font-bold text-xs">
                              {index + 1}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-suka-ink">
                              {row.name.replace('SUKA SHAWARMA ', '')}
                            </td>
                            <td className="py-3.5 px-4 text-right text-suka-brown font-bold">
                              {rupiah(row.netRev)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-suka-gray-500">
                              -{rupiah(row.hpp + row.waste)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-suka-gray-500">
                              -{rupiah(row.expense)}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-black ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {rupiah(row.net)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-lg border ${marginBadge}`}>
                                {row.margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  )
}
