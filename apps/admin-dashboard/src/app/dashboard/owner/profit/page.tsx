'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useDashboardStore } from '@/hooks/useDashboardStore'
import { useSalesSummary } from '@/hooks/useSalesSummary'
import { useExpenses } from '@/hooks/useExpenses'
import { PeriodFilter } from '@/components/PeriodFilter'
import { rupiah, rupiahCompact } from '@/lib/format'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import CountUp from 'react-countup'
import { TrendingUp, Percent, ArrowLeftRight, TrendingDown } from 'lucide-react'

export default function ProfitPage() {
  const supabase = useMemo(() => createClient(), [])
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([])
  const { filter, setFilter } = useDashboardStore()

  useEffect(() => {
    supabase
      .from('outlets')
      .select('id,name')
      .order('name')
      .then(({ data }) => setOutlets(data ?? []))
  }, [supabase])

  const sales = useSalesSummary(filter)
  const expenses = useExpenses(filter)

  const loading = sales.loading || expenses.loading
  const error = sales.error || expenses.error

  // Calculations
  const totalOmzet = useMemo(() => sales.rows.reduce((sum, r) => sum + r.omzet, 0), [sales.rows])
  const totalExpenses = useMemo(() => expenses.rows.reduce((sum, r) => sum + r.amount, 0), [expenses.rows])
  const netProfit = totalOmzet - totalExpenses
  const profitMargin = totalOmzet > 0 ? (netProfit / totalOmzet) * 100 : 0

  // Outlets breakdown
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; expense: number }>()
    
    // Seed Map with all outlets
    outlets.forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, expense: 0 })
    })

    sales.rows.forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name, omzet: 0, expense: 0 }
      cur.omzet += s.omzet
      map.set(s.outlet_id, cur)
    })

    expenses.rows.forEach(e => {
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name, omzet: 0, expense: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        const net = val.omzet - val.expense
        const margin = val.omzet > 0 ? (net / val.omzet) * 100 : 0
        return {
          id,
          name: val.name,
          omzet: val.omzet,
          expense: val.expense,
          net,
          margin
        }
      })
      .filter(item => item.omzet > 0 || item.expense > 0)
      .sort((a, b) => b.net - a.net) // Sort by net profit
  }, [sales.rows, expenses.rows, outlets])

  // Group by date for Cash Flow Chart
  const byDate = useMemo(() => {
    const map = new Map<string, { date: string; omzet: number; expense: number }>()

    sales.rows.forEach(s => {
      const cur = map.get(s.sales_date) ?? { date: s.sales_date, omzet: 0, expense: 0 }
      cur.omzet += s.omzet
      map.set(s.sales_date, cur)
    })

    expenses.rows.forEach(e => {
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
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* 2. Total Pengeluaran */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Total Pengeluaran</p>
                <div className="p-2 bg-red-55/10 rounded-xl">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={totalExpenses} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Seluruh Biaya Operasional</p>
              </div>
            </div>

            {/* 3. Laba Bersih */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Laba Bersih</p>
                <div className="p-2 bg-suka-orange/10 rounded-xl">
                  <ArrowLeftRight className="w-5 h-5 text-suka-orange" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={netProfit} duration={1} separator="." />
                </h3>
                <p className={`text-[10px] font-bold mt-1 uppercase ${netProfit >= 0 ? 'text-suka-green' : 'text-red-650'}`}>
                  {netProfit >= 0 ? 'Surplus Bersih' : 'Defisit Bersih'}
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
                  <CountUp end={profitMargin} duration={1} decimals={1} /> %
                </h3>
                <p className="text-[10px] text-suka-gray-400 font-semibold mt-1 uppercase">Efisiensi Profitabilitas</p>
              </div>
            </div>
          </div>

          {/* Cash Flow Comparison Chart */}
          <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm">
            <h3 className="font-extrabold text-suka-brown text-sm tracking-tight mb-4 uppercase">Arus Kas Penjualan vs Pengeluaran</h3>
            {byDate.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada transaksi</div>
            ) : (
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDate} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" fontSize={10} tickLine={false} />
                    <YAxis tickFormatter={(v) => rupiahCompact(Number(v))} fontSize={10} tickLine={false} axisLine={false} width={80} />
                    <Tooltip formatter={(value) => rupiah(Number(value))} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Bar dataKey="omzet" name="Omzet Pemasukan" fill="#0a7d2c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Biaya Pengeluaran" fill="#701604" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
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
                    <th className="py-3 px-6 text-right">Pengeluaran</th>
                    <th className="py-3 px-6 text-right">Laba Bersih</th>
                    <th className="py-3 px-6 text-center">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 font-medium">
                  {outletBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-suka-gray-400">Belum ada aktivitas bisnis pada periode ini</td>
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
