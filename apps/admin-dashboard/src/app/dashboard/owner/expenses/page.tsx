'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useDashboardStore } from '@/hooks/useDashboardStore'
import { useExpenses } from '@/hooks/useExpenses'
import { PeriodFilter } from '@/components/PeriodFilter'
import { rupiah, pct, rupiahCompact } from '@/lib/format'
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts'
import CountUp from 'react-countup'
import { Wallet, Users, Zap, Home, Receipt, MoreHorizontal } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  bahan_baku: 'Bahan Baku',
  gaji: 'Gaji Karyawan',
  operasional: 'Operasional',
  sewa: 'Sewa Tempat',
  utilitas: 'Utilitas & Energi',
  lainnya: 'Lainnya',
}

const CATEGORY_COLORS: Record<string, string> = {
  bahan_baku: '#f29744',   // Suka Orange
  gaji: '#701604',         // Suka Brown
  utilitas: '#0a7d2c',     // Suka Green
  sewa: '#d97706',         // Amber
  operasional: '#4b5563',  // Slate Gray
  lainnya: '#9ca3af',      // Light Gray
}

const CATEGORY_ICONS: Record<string, any> = {
  bahan_baku: Wallet,
  gaji: Users,
  utilitas: Zap,
  sewa: Home,
  operasional: Receipt,
  lainnya: MoreHorizontal,
}

export default function ExpensesPage() {
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

  const { rows, loading, error } = useExpenses(filter)

  // Calculations
  const totalExpenses = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows])
  
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach(r => map.set(r.category, (map.get(r.category) ?? 0) + r.amount))
    return [...map.entries()].map(([category, amount]) => ({
      name: CATEGORY_LABELS[category] ?? category,
      value: amount,
      color: CATEGORY_COLORS[category] ?? '#cccccc',
      categoryKey: category
    })).sort((a, b) => b.value - a.value)
  }, [rows])

  // Group by date for Bar Chart
  const byDate = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    rows.forEach(r => {
      const dateStr = r.expense_date
      const current = map.get(dateStr) ?? { bahan_baku: 0, gaji: 0, utilitas: 0, sewa: 0, operasional: 0, lainnya: 0 }
      current[r.category] = (current[r.category] ?? 0) + r.amount
      map.set(dateStr, current)
    })
    
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, categories]) => ({
        date,
        ...categories
      }))
  }, [rows])

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Laporan Pengeluaran</h2>
          <p className="text-xs text-suka-gray-500 font-medium">Analisis pengeluaran operasional outlet</p>
        </div>
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} />
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data pengeluaran: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-suka-brown font-bold text-sm">
          Memuat data pengeluaran...
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Pengeluaran */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Total Pengeluaran</p>
                <div className="p-2 bg-suka-brown/5 rounded-xl">
                  <Wallet className="w-5 h-5 text-suka-brown" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={totalExpenses} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-suka-gray-400 font-semibold mt-1 uppercase">100% Seluruh Biaya</p>
              </div>
            </div>

            {/* Top 3 categories as KPIs */}
            {['bahan_baku', 'gaji', 'utilitas'].map((catKey) => {
              const catAmount = byCategory.find(c => c.categoryKey === catKey)?.value ?? 0
              const percentage = totalExpenses > 0 ? pct(catAmount, totalExpenses) : 0
              const Icon = CATEGORY_ICONS[catKey] ?? Wallet
              const label = CATEGORY_LABELS[catKey]
              const color = CATEGORY_COLORS[catKey]

              return (
                <div 
                  key={catKey} 
                  className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">{label}</p>
                    <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}10` }}>
                      <Icon className="w-5 h-5" style={{ color: color }} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-extrabold text-suka-brown">
                      Rp <CountUp end={catAmount} duration={1} separator="." />
                    </h3>
                    <p className="text-[10px] font-bold mt-1 uppercase" style={{ color: color }}>
                      {percentage}% dari total pengeluaran
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Donut Chart: Expenses Distribution (2/5 Cols) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight mb-4 uppercase">Distribusi Pengeluaran</h3>
              {rows.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada transaksi</div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-full h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {byCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => rupiah(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend list */}
                  <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
                    {byCategory.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="truncate text-suka-ink">{entry.name}</span>
                        <span className="ml-auto text-suka-gray-500 font-bold">
                          {pct(entry.value, totalExpenses)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stacked Bar Chart: Expenses Trend (3/5 Cols) */}
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight mb-4 uppercase">Tren Biaya Operasional</h3>
              {rows.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada transaksi</div>
              ) : (
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byDate} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="date" fontSize={10} tickLine={false} />
                      <YAxis tickFormatter={(v) => rupiahCompact(Number(v))} fontSize={10} tickLine={false} axisLine={false} width={80} />
                      <Tooltip formatter={(value) => rupiah(Number(value))} />
                      <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                      <Bar dataKey="bahan_baku" name="Bahan Baku" stackId="a" fill={CATEGORY_COLORS.bahan_baku} />
                      <Bar dataKey="gaji" name="Gaji Karyawan" stackId="a" fill={CATEGORY_COLORS.gaji} />
                      <Bar dataKey="utilitas" name="Utilitas & Energi" stackId="a" fill={CATEGORY_COLORS.utilitas} />
                      <Bar dataKey="sewa" name="Sewa Tempat" stackId="a" fill={CATEGORY_COLORS.sewa} />
                      <Bar dataKey="operasional" name="Operasional" stackId="a" fill={CATEGORY_COLORS.operasional} />
                      <Bar dataKey="lainnya" name="Lainnya" stackId="a" fill={CATEGORY_COLORS.lainnya} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Raw Transaction Table */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-suka-gray-100 flex justify-between items-center">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Rincian Transaksi Pengeluaran</h3>
              <span className="text-xs font-bold text-suka-orange bg-suka-cream px-3 py-1 rounded-full border border-suka-brown/5">
                {rows.length} Transaksi
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                    <th className="py-3 px-6 w-12 text-center">#</th>
                    <th className="py-3 px-6">Outlet</th>
                    <th className="py-3 px-6">Kategori</th>
                    <th className="py-3 px-6">Tanggal</th>
                    <th className="py-3 px-6">Catatan / Deskripsi</th>
                    <th className="py-3 px-6 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 font-medium">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-suka-gray-400">Belum ada data pengeluaran pada periode ini</td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const color = CATEGORY_COLORS[row.category] ?? '#cccccc'
                      const label = CATEGORY_LABELS[row.category] ?? row.category
                      
                      return (
                        <tr key={row.id} className="hover:bg-suka-cream/20 transition-colors">
                          <td className="py-3.5 px-6 text-center text-suka-gray-400 font-bold">{index + 1}</td>
                          <td className="py-3.5 px-6 text-suka-ink font-bold">{row.outlet_name.replace('SUKA SHAWARMA ', '')}</td>
                          <td className="py-3.5 px-6">
                            <span 
                              className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
                              style={{ color: color, backgroundColor: `${color}10`, border: `1px solid ${color}20` }}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-suka-gray-500 font-bold">
                            {new Date(row.expense_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3.5 px-6 text-suka-gray-600 text-xs italic">{row.description}</td>
                          <td className="py-3.5 px-6 text-right text-suka-brown font-extrabold">{rupiah(row.amount)}</td>
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
