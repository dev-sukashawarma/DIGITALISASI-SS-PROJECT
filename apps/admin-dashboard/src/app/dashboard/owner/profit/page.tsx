'use client'

import { useMemo } from 'react'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesDaily } from '@/hooks/useSalesDaily'
import { useExpenses } from '@/hooks/useExpenses'
import { useHpp } from '@/hooks/useHpp'
import { computeProfit, computeCompanyProfit } from '@/lib/profit'
import { PeriodFilter } from '@/components/PeriodFilter'
import { rupiah } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingUp, Percent, ArrowLeftRight, TrendingDown, Boxes, Layers, Building2 } from 'lucide-react'
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

  const loading = sales.loading || expenses.loading || hpp.loading
  const error = sales.error || expenses.error || hpp.error

  const isAllOutlets = filter.outletId === 'all'

  // Calculations — pisah pengeluaran outlet (dibebankan ke P&L outlet) vs pusat (company-wide).
  const totalOmzet = useMemo(() => sales.rows.reduce((sum, r) => sum + r.omzet, 0), [sales.rows])
  const pengeluaranOutlet = useMemo(
    () => expenses.rows.filter(r => r.scope === 'outlet').reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows])
  const pengeluaranPusat = useMemo(
    () => expenses.rows.filter(r => r.scope === 'pusat').reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows])
  const totalHpp = useMemo(() => hpp.rows.reduce((sum, r) => sum + r.hpp, 0), [hpp.rows])
  // Laba outlet: Omzet − HPP − Pengeluaran Outlet. labaBersih di sini = Σ laba outlet saat "Semua Outlet".
  const { labaKotor, labaBersih, marginKotor } = computeProfit(totalOmzet, totalHpp, pengeluaranOutlet)
  // Saat "Semua Outlet": Laba Perusahaan = Σ laba outlet − Pengeluaran Pusat. Satu outlet: pusat = 0.
  const labaPerusahaan = computeCompanyProfit(labaBersih, pengeluaranPusat).labaPerusahaan
  const displayLaba = isAllOutlets ? labaPerusahaan : labaBersih
  const displayMargin = totalOmzet > 0 ? (displayLaba / totalOmzet) * 100 : 0

  // Outlets breakdown
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; expense: number; hpp: number }>()

    outlets.forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, expense: 0, hpp: 0 })
    })

    sales.rows.forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name, omzet: 0, expense: 0, hpp: 0 }
      cur.omzet += s.omzet
      map.set(s.outlet_id, cur)
    })

    expenses.rows.forEach(e => {
      // Pengeluaran Pusat (scope pusat / outlet_id NULL) tak dibebankan ke outlet manapun.
      if (e.scope !== 'outlet' || !e.outlet_id) return
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet Tidak Dikenal', omzet: 0, expense: 0, hpp: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    hpp.rows.forEach(h => {
      const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, expense: 0, hpp: 0 }
      cur.hpp += h.hpp
      map.set(h.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        const net = val.omzet - val.hpp - val.expense
        const labaKotor = val.omzet - val.hpp
        const margin = val.omzet > 0 ? (net / val.omzet) * 100 : 0
        return { id, name: val.name, omzet: val.omzet, expense: val.expense, hpp: val.hpp, labaKotor, net, margin }
      })
      .filter(item => item.omzet > 0 || item.expense > 0 || item.hpp > 0)
      .sort((a, b) => b.net - a.net)
  }, [sales.rows, expenses.rows, hpp.rows, outlets])

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
      {/* Header and Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Analisis Laba Rugi</h2>
          <p className="text-xs text-suka-gray-500 font-medium">Perbandingan omzet penjualan vs biaya operasional</p>
        </div>
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} />
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data keuangan: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-suka-brown font-bold text-sm">
          Memuat analisis laba rugi...
        </div>
      ) : (
        <>
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Omzet Penjualan */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Omzet Penjualan</p>
                <div className="p-2 bg-suka-green/10 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-suka-green" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={totalOmzet} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-suka-green font-bold mt-1 uppercase">Pemasukan Completed Orders</p>
              </div>
            </div>

            {/* HPP Bahan Baku */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">HPP Bahan Baku</p>
                <div className="p-2 bg-suka-brown/10 rounded-xl">
                  <Boxes className="w-5 h-5 text-suka-brown" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={totalHpp} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-suka-brown font-bold mt-1 uppercase">Biaya Bahan Terjual</p>
              </div>
            </div>

            {/* Laba Kotor */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Laba Kotor</p>
                <div className="p-2 bg-suka-green/10 rounded-xl">
                  <Layers className="w-5 h-5 text-suka-green" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={labaKotor} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-suka-green font-bold mt-1 uppercase">Omzet − HPP · {marginKotor.toFixed(1)}%</p>
              </div>
            </div>

            {/* 2. Pengeluaran Outlet */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Total Pengeluaran</p>
                <div className="p-2 bg-red-55/10 rounded-xl">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={pengeluaranOutlet} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Biaya Operasional Outlet</p>
              </div>
            </div>

            {/* Biaya Pusat — company-wide, hanya saat semua outlet */}
            {isAllOutlets && (
              <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Biaya Pusat</p>
                  <div className="p-2 rounded-xl" style={{ backgroundColor: '#dc262610' }}>
                    <Building2 className="w-5 h-5" style={{ color: '#dc2626' }} />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-extrabold text-suka-brown">
                    Rp <CountUp end={pengeluaranPusat} duration={1} separator="." />
                  </h3>
                  <p className="text-[10px] font-bold mt-1 uppercase" style={{ color: '#dc2626' }}>
                    Tak dibebankan ke outlet
                  </p>
                </div>
              </div>
            )}

            {/* 3. Laba Bersih (outlet vs perusahaan) */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
                  {isAllOutlets ? 'Laba Bersih Perusahaan' : 'Laba Bersih Outlet'}
                </p>
                <div className="p-2 bg-suka-orange/10 rounded-xl">
                  <ArrowLeftRight className="w-5 h-5 text-suka-orange" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={displayLaba} duration={1} separator="." />
                </h3>
                <p className={`text-[10px] font-bold mt-1 uppercase ${displayLaba >= 0 ? 'text-suka-green' : 'text-red-650'}`}>
                  {isAllOutlets
                    ? (displayLaba >= 0 ? 'Σ Laba Outlet − Biaya Pusat' : 'Defisit Perusahaan')
                    : (displayLaba >= 0 ? 'Surplus Bersih' : 'Defisit Bersih')}
                </p>
              </div>
            </div>

            {/* 4. Profit Margin */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Profit Margin</p>
                <div className="p-2 bg-suka-brown/5 rounded-xl">
                  <Percent className="w-5 h-5 text-suka-brown" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  <CountUp end={displayMargin} duration={1} decimals={1} /> %
                </h3>
                <p className="text-[10px] text-suka-gray-400 font-semibold mt-1 uppercase">Efisiensi Profitabilitas</p>
              </div>
            </div>
          </div>

          {/* Cash Flow Comparison Chart */}
          <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm">
            <h3 className="font-extrabold text-suka-brown text-sm tracking-tight mb-4 uppercase">Arus Kas Penjualan vs Pengeluaran</h3>
            <ProfitCashFlowChart byDate={byDate} />
          </div>

          {/* Outlet Profitability Leaderboard Table */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-suka-gray-100 flex justify-between items-center">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Profitabilitas per Outlet</h3>
              <span className="text-xs font-bold text-suka-gray-500 uppercase">Diurutkan dari Profit Bersih Tertinggi</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                    <th className="py-3 px-6 w-12 text-center">#</th>
                    <th className="py-3 px-6">Nama Outlet</th>
                    <th className="py-3 px-6 text-right">Omzet</th>
                    <th className="py-3 px-6 text-right">HPP</th>
                    <th className="py-3 px-6 text-right">Laba Kotor</th>
                    <th className="py-3 px-6 text-right">Pengeluaran</th>
                    <th className="py-3 px-6 text-right">Laba Bersih</th>
                    <th className="py-3 px-6 text-center">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 font-medium">
                  {outletBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-suka-gray-400">Belum ada aktivitas bisnis pada periode ini</td>
                    </tr>
                  ) : (
                    outletBreakdown.map((row, index) => {
                      const isProfit = row.net >= 0
                      const marginColor = row.margin >= 20 
                        ? 'text-suka-green bg-green-50' 
                        : row.margin >= 5 
                        ? 'text-suka-orange bg-suka-cream' 
                        : 'text-red-700 bg-red-50'

                      return (
                        <tr key={row.id} className="hover:bg-suka-cream/20 transition-colors">
                          <td className="py-3.5 px-6 text-center text-suka-gray-400 font-bold">{index + 1}</td>
                          <td className="py-3.5 px-6 text-suka-ink font-bold">{row.name.replace('SUKA SHAWARMA ', '')}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.omzet)}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.hpp)}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.labaKotor)}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.expense)}</td>
                          <td className={`py-3.5 px-6 text-right font-extrabold ${isProfit ? 'text-suka-green' : 'text-red-700'}`}>
                            {rupiah(row.net)}
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${marginColor}`}>
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
        </>
      )}
    </div>
  )
}
