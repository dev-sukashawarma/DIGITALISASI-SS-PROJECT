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
import { PageHeader, StatTile, Section, StatTilesSkeleton } from '@/components/ui'
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
      <PageHeader title="Untung Rugi" description="Perbandingan omzet penjualan vs biaya operasional">
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
        <>
          {/* 3 angka headline — informasi terpenting menonjol */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Omzet Penjualan"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalOmzet} duration={1} separator="." /></>}
              sub="Pemasukan Completed Orders"
              icon={TrendingUp}
              accent="green"
            />
            <StatTile
              label={isAllOutlets ? 'Laba Bersih Perusahaan' : 'Laba Bersih Outlet'}
              value={<><span className="text-lg align-top">Rp </span><CountUp end={displayLaba} duration={1} separator="." /></>}
              sub={isAllOutlets
                ? (displayLaba >= 0 ? 'Σ Laba Outlet − Biaya Pusat' : 'Defisit Perusahaan')
                : (displayLaba >= 0 ? 'Surplus Bersih' : 'Defisit Bersih')}
              icon={ArrowLeftRight}
              accent={displayLaba >= 0 ? 'orange' : 'red'}
            />
            <StatTile
              label="Profit Margin"
              value={<><CountUp end={displayMargin} duration={1} decimals={1} /> %</>}
              sub="Efisiensi Profitabilitas"
              icon={Percent}
              accent="brown"
            />
          </div>

          {/* Rincian — angka pendukung disembunyikan agar layar tidak sesak */}
          <Section title="Rincian Perhitungan">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="HPP Bahan Baku" value={<><span className="text-lg align-top">Rp </span><CountUp end={totalHpp} duration={1} separator="." /></>} sub="Biaya Bahan Terjual" icon={Boxes} accent="brown" />
              <StatTile label="Laba Kotor" value={<><span className="text-lg align-top">Rp </span><CountUp end={labaKotor} duration={1} separator="." /></>} sub={`Omzet − HPP · ${marginKotor.toFixed(1)}%`} icon={Layers} accent="green" />
              <StatTile label="Pengeluaran Outlet" value={<><span className="text-lg align-top">Rp </span><CountUp end={pengeluaranOutlet} duration={1} separator="." /></>} sub={`Bulanan: Rp ${(pengeluaranOutletBulanan/1000).toLocaleString('id-ID')}k | Kas Kecil: Rp ${(pengeluaranOutletPettyCash/1000).toLocaleString('id-ID')}k`} icon={TrendingDown} accent="red" />
              {isAllOutlets && (
                <StatTile label="Biaya Pusat" value={<><span className="text-lg align-top">Rp </span><CountUp end={pengeluaranPusat} duration={1} separator="." /></>} sub="Tak dibebankan ke outlet" icon={Building2} accent="red" />
              )}
            </div>
          </Section>

          {/* Cash Flow Comparison Chart */}
          <Section title="Arus Kas Penjualan vs Pengeluaran">
            <ProfitCashFlowChart byDate={byDate} />
          </Section>

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
