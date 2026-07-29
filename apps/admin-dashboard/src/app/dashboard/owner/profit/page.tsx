// @ts-nocheck
'use client'

import { useMemo } from 'react'
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
import { TrendingUp, Percent, ArrowLeftRight, TrendingDown, Boxes, Layers, Building2 } from 'lucide-react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'

const ProfitCashFlowChart = dynamic(
  () => import('@/components/ProfitCashFlowChart').then((m) => m.ProfitCashFlowChart),
  { ssr: false, loading: () => <div className="h-80 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function ProfitPage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  const sales = useSalesDaily(filter, outlets)
  const expenses = useExpenses(filter)
  const hpp = useHpp(filter)
  const waste = useWaste(filter)

  const loading = sales.loading || expenses.loading || hpp.loading || waste.loading
  const error = sales.error || expenses.error || hpp.error || waste.error

  const isAllOutlets = filter.outletId === 'all'

  // Calculations — pisah pengeluaran outlet (dibebankan ke P&L outlet) vs pusat (company-wide).
  // Note: r.omzet in DB (sales_daily_scoped) is SUM(total_amount), which is actually Net Revenue
  const actualNetRevenue = useMemo(() => sales.rows.reduce((sum, r) => sum + r.omzet, 0), [sales.rows])
  const totalPotongan = useMemo(() => sales.rows.reduce((sum, r) => sum + (r.total_deductions || 0), 0), [sales.rows])
  const totalPlatformFee = useMemo(() => sales.rows.reduce((sum, r) => sum + (r.platform_fee || 0), 0), [sales.rows])
  const totalDeductions = totalPotongan + totalPlatformFee
  
  const actualGrossRevenue = actualNetRevenue + totalDeductions

  const pengeluaranOutletBulanan = useMemo(
    () => expenses.rows.filter(r => r.scope === 'outlet' && r.source === 'monthly').reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows])
  const pengeluaranOutletPettyCash = useMemo(
    () => expenses.rows.filter(r => r.scope === 'outlet' && r.source === 'petty_cash').reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows])
  const pengeluaranOutlet = pengeluaranOutletBulanan + pengeluaranOutletPettyCash
  const pengeluaranPusat = useMemo(
    () => expenses.rows.filter(r => r.scope === 'pusat').reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows])
  const totalHpp = useMemo(() => hpp.rows.reduce((sum, r) => sum + r.hpp, 0), [hpp.rows])
  const totalWaste = useMemo(() => waste.rows.reduce((sum, r) => sum + r.nilai_waste, 0), [waste.rows])
  
  // Laba outlet: Net Revenue − HPP − Pengeluaran Outlet - Waste.
  const { netRevenue, labaKotor, labaBersih, marginKotor } = computeProfit(actualGrossRevenue, totalDeductions, totalHpp, pengeluaranOutlet, totalWaste)
  
  // Saat "Semua Outlet": Laba Perusahaan = Σ laba outlet − Pengeluaran Pusat. Satu outlet: pusat = 0.
  const labaPerusahaan = computeCompanyProfit(labaBersih, pengeluaranPusat).labaPerusahaan
  const displayLaba = isAllOutlets ? labaPerusahaan : labaBersih
  const displayMargin = netRevenue > 0 ? (displayLaba / netRevenue) * 100 : 0

  // Outlets breakdown
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; deductions: number; expense: number; hpp: number; waste: number }>()

    outlets.forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 })
    })

    sales.rows.forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name, omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.omzet += s.omzet
      cur.deductions += (s.total_deductions || 0) + (s.platform_fee || 0)
      map.set(s.outlet_id, cur)
    })

    expenses.rows.forEach(e => {
      if (e.scope !== 'outlet' || !e.outlet_id) return
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    hpp.rows.forEach(h => {
      const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.hpp += h.hpp
      map.set(h.outlet_id, cur)
    })

    waste.rows.forEach(w => {
      const cur = map.get(w.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.waste += w.nilai_waste
      map.set(w.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        // Fix: val.omzet is actually Net Revenue
        const netRev = val.omzet
        const grossRev = val.omzet + val.deductions
        const labaKotor = netRev - val.hpp
        const net = labaKotor - val.expense - val.waste
        const margin = netRev > 0 ? (net / netRev) * 100 : 0
        return { id, name: val.name, omzet: grossRev, deductions: val.deductions, netRev, expense: val.expense, hpp: val.hpp, waste: val.waste, labaKotor, net, margin }
      })
      .filter(item => item.omzet > 0 || item.expense > 0 || item.hpp > 0 || item.waste > 0)
      .sort((a, b) => b.net - a.net)
  }, [sales.rows, expenses.rows, hpp.rows, waste.rows, outlets])

  // Group by date for Cash Flow Chart
  const byDate = useMemo(() => {
    const map = new Map<string, { date: string; omzet: number; expense: number }>()

    sales.rows.forEach(s => {
      const cur = map.get(s.sales_date) ?? { date: s.sales_date, omzet: 0, expense: 0 }
      cur.omzet += s.omzet
      map.set(s.sales_date, cur)
    })

    expenses.rows.forEach(e => {
      // Tren arus kas biaya = biaya outlet; pusat (company-wide, satu nilai/bulan) disurfacekan di kartu terpisah.
      if (e.scope !== 'outlet') return
      const cur = map.get(e.expense_date) ?? { date: e.expense_date, omzet: 0, expense: 0 }
      cur.expense += e.amount
      map.set(e.expense_date, cur)
    })

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [sales.rows, expenses.rows])

  return (
    <div className="space-y-6">
      <PageHeader title="Untung Rugi" description="Perbandingan omzet penjualan vs biaya operasional" icon={ArrowLeftRight}>
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} />
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data keuangan: {error}
        </div>
      )}

      {loading ? (
        <StatTilesSkeleton count={3} />
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* ── KIRI: SUMMARY KPI ────────────────────────── */}
          <div className="w-full lg:w-1/3 xl:w-[35%] flex flex-col gap-6 shrink-0 lg:sticky lg:top-6">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
              className="flex flex-col gap-4"
            >
              <Section title="Alur Laba Rugi (Profit & Loss)">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <StatTile
                label="Omzet Kotor (Gross)"
                value={<><span className="text-lg align-top">Rp </span><CountUp end={actualGrossRevenue} duration={1} separator="." /></>}
                sub="Harga menu murni sebelum dipotong"
                icon={TrendingUp}
                accent="brown"
                tooltip="Nilai murni dari harga menu sebelum dipotong apa pun. Menunjukkan seberapa besar demand pasar terhadap produk."
              />
              <StatTile
                label="Total Potongan & Fee"
                value={<><span className="text-lg align-top">-Rp </span><CountUp end={totalDeductions} duration={1} separator="." /></>}
                sub={`Diskon: ${rupiah(totalPotongan)} | Aplikasi: ${rupiah(totalPlatformFee)}`}
                icon={TrendingDown}
                accent="red"
                tooltip="Berapa uang yang hilang untuk diskon kustomer dan estimasi komisi platform (Grab/GoFood/Tiktok)."
              />
              <StatTile
                label="Pendapatan Bersih (Net)"
                value={<><span className="text-lg align-top">Rp </span><CountUp end={netRevenue} duration={1} separator="." /></>}
                sub="Uang riil masuk ke sistem"
                icon={TrendingUp}
                accent="green"
                tooltip="Uang riil yang mendarat di laci kasir atau rekening (Gross Revenue - Total Potongan)."
              />
              <StatTile
                label="Total HPP (COGS)"
                value={<><span className="text-lg align-top">-Rp </span><CountUp end={totalHpp} duration={1} separator="." /></>}
                sub="Modal bahan dasar (Resep)"
                icon={Boxes}
                accent="brown"
                tooltip="Modal bahan baku dasar dari menu-menu yang berhasil terjual."
              />
              <StatTile
                label="Waste (Bahan Terbuang)"
                value={<><span className="text-lg align-top">-Rp </span><CountUp end={totalWaste} duration={1} separator="." /></>}
                sub="Basi / Rusak (Kerugian Murni)"
                icon={TrendingDown}
                accent="red"
                tooltip="Bahan basi atau rusak adalah kerugian murni yang memotong laba. Dipisah dari HPP reguler untuk evaluasi SOP."
              />
              <StatTile
                label="Laba Kotor (Gross Profit)"
                value={<><span className="text-lg align-top">Rp </span><CountUp end={labaKotor} duration={1} separator="." /></>}
                sub={`Margin Kotor: ${marginKotor.toFixed(1)}%`}
                icon={Layers}
                accent="green"
                tooltip="Sisa pendapatan setelah Net Revenue dipotong harga modal bahan baku (HPP) dan Waste."
              />
              <StatTile
                label="Pengeluaran (Opex)"
                value={<><span className="text-lg align-top">-Rp </span><CountUp end={pengeluaranOutlet + pengeluaranPusat} duration={1} separator="." /></>}
                sub={isAllOutlets ? `Outlet: ${rupiah(pengeluaranOutlet)} | Pusat: ${rupiah(pengeluaranPusat)}` : `Bulanan: ${rupiah(pengeluaranOutletBulanan)} | Kas: ${rupiah(pengeluaranOutletPettyCash)}`}
                icon={TrendingDown}
                accent="red"
                tooltip="Total seluruh beban biaya operasional, tagihan bulanan (gaji, listrik, sewa), dan kas kecil."
              />
              <StatTile
                label="Laba Bersih (Net Profit)"
                value={<><span className="text-lg align-top">Rp </span><CountUp end={displayLaba} duration={1} separator="." /></>}
                sub={`Margin Bersih: ${displayMargin.toFixed(1)}%`}
                icon={ArrowLeftRight}
                accent={displayLaba >= 0 ? 'orange' : 'red'}
                tooltip="Hasil keuntungan murni akhir setelah semua biaya dipotong."
              />
                </div>
              </Section>
            </motion.div>
          </div>

          {/* ── KANAN: ANALISIS GRAFIK & TABEL ─────────────────────────────── */}
          <div className="w-full lg:w-2/3 xl:w-[65%] flex flex-col gap-6 min-w-0">
            {/* Cash Flow Comparison Chart */}
          <Section title="Arus Kas Penjualan vs Pengeluaran">
            <ProfitCashFlowChart byDate={byDate} />
          </Section>

          {/* Outlet Profitability Leaderboard Table */}
          {isAllOutlets && (
            <motion.div 
              variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } } }}
              className="bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-suka-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-suka-brown text-sm tracking-tight uppercase">Profitabilitas per Outlet</h3>
                <span className="text-xs font-semibold text-suka-gray-500 uppercase">Diurutkan dari Profit Bersih Tertinggi</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-suka-cream/20 text-left text-suka-gray-500 font-semibold border-b border-suka-brown/5">
                      <th className="py-3 px-6 w-12 text-center">#</th>
                      <th className="py-3 px-6">Nama Outlet</th>
                      <th className="py-3 px-6 text-right">Omzet Kotor</th>
                      <th className="py-3 px-6 text-right">Potongan</th>
                      <th className="py-3 px-6 text-right">Net Revenue</th>
                      <th className="py-3 px-6 text-right">HPP & Waste</th>
                      <th className="py-3 px-6 text-right">Laba Kotor</th>
                      <th className="py-3 px-6 text-right">Pengeluaran</th>
                      <th className="py-3 px-6 text-right">Laba Bersih</th>
                      <th className="py-3 px-6 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <motion.tbody 
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.05 } },
                      hidden: {},
                    }}
                    className="divide-y divide-suka-gray-100 font-medium text-suka-ink"
                  >
                    {outletBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-suka-gray-400">Belum ada aktivitas bisnis pada periode ini</td>
                      </tr>
                    ) : (
                      outletBreakdown.map((row, index) => {
                        const isProfit = row.net >= 0
                        const marginColor = row.margin >= 20 
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-200/80' 
                          : row.margin >= 5 
                          ? 'text-amber-800 bg-amber-50 border-amber-200/80' 
                          : 'text-rose-800 bg-rose-50 border-rose-200/80'

                        return (
                          <motion.tr 
                            key={row.id} 
                            variants={{
                              hidden: { opacity: 0, y: 10 },
                              visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                            }}
                            className="hover:bg-orange-50/30 transition-colors group"
                          >
                            <td className="py-3.5 px-6 text-center text-suka-gray-400 font-bold">{index + 1}</td>
                            <td className="py-3.5 px-6 text-suka-ink font-bold">{row.name.replace('SUKA SHAWARMA ', '')}</td>
                            <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.omzet)}</td>
                            <td className="py-3.5 px-6 text-right text-suka-gray-600">-{rupiah(row.deductions)}</td>
                            <td className="py-3.5 px-6 text-right text-suka-gray-700 font-bold">{rupiah(row.netRev)}</td>
                            <td className="py-3.5 px-6 text-right text-suka-gray-600">-{rupiah(row.hpp + row.waste)}</td>
                            <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.labaKotor)}</td>
                            <td className="py-3.5 px-6 text-right text-suka-gray-600">-{rupiah(row.expense)}</td>
                            <td className={`py-3.5 px-6 text-right font-bold ${isProfit ? 'text-suka-green' : 'text-rose-600'}`}>
                              {rupiah(row.net)}
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${marginColor}`}>
                                {row.margin.toFixed(1)}%
                              </span>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
                  </motion.tbody>
                </table>
              </div>
            </motion.div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}

