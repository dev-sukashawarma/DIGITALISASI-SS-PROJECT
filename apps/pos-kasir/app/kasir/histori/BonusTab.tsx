'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import { Skeleton } from '@/components/Skeleton'
import { Trophy, CheckCircle2, XCircle, TrendingUp, Users, Calendar } from 'lucide-react'

export default function BonusTab() {
  const { outletId } = useMyOutlet()
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // 1. Fetch Summary
  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['bonus_summary', outletId, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!outletId) return null
      const supabase = createClient()
      const { data, error } = await supabase.rpc('calculate_monthly_crew_bonus', {
        p_month: selectedMonth,
        p_year: selectedYear,
        p_outlet_id: outletId
      })
      if (error) throw error
      return data || []
    },
    enabled: !!outletId
  })

  // 2. Fetch Daily Breakdown
  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ['bonus_daily', outletId, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!outletId) return null
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_daily_bonus_breakdown', {
        p_month: selectedMonth,
        p_year: selectedYear,
        p_outlet_id: outletId
      })
      if (error) throw error
      return data || []
    },
    enabled: !!outletId
  })

  // Derive stats
  const totalDaysReached = dailyData?.filter((d: any) => d.is_reached)?.length || 0;
  const totalBonusPool = dailyData?.filter((d: any) => d.is_reached)?.reduce((acc: number, d: any) => acc + Number(d.bonus_amount), 0) || 0;
  const activeCrewCount = summaryData?.length || 0;
  const bonusPerPerson = summaryData?.[0]?.total_bonus_received || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer pr-4"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer pr-4"
          >
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Target Achieved */}
        <div className="card p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-amber-100 font-semibold text-sm">Target Tercapai</span>
          </div>
          <p className="text-3xl font-bold">{loadingDaily ? '-' : totalDaysReached}</p>
          <p className="text-amber-100 text-xs mt-1">Hari di bulan ini</p>
        </div>

        {/* Estimasi Bonus Per Orang */}
        <div className="card p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" strokeWidth={2} />
            </div>
            <span className="text-gray-400 font-semibold text-sm">Bonus Per Orang</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{loadingSummary ? '-' : formatRupiah(bonusPerPerson)}</p>
          <p className="text-gray-400 text-xs mt-1">Estimasi dibagikan ke {activeCrewCount} orang</p>
        </div>

        {/* Total Keseluruhan Bonus */}
        <div className="card p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" strokeWidth={2} />
            </div>
            <span className="text-gray-400 font-semibold text-sm">Total Terkumpul</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{loadingDaily ? '-' : formatRupiah(totalBonusPool)}</p>
          <p className="text-gray-400 text-xs mt-1">Keseluruhan sebelum dibagi</p>
        </div>
      </div>

      {/* ── Daily Breakdown Table ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-bold text-gray-900">Rincian Penjualan per Hari</h2>
          <p className="text-sm text-gray-500">Lihat rekam jejak pencapaian target harian outletmu</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-5 py-3 rounded-tl-xl">Tanggal</th>
                <th className="px-5 py-3">Total Penjualan</th>
                <th className="px-5 py-3">Target Hari Ini</th>
                <th className="px-5 py-3">Bonus</th>
                <th className="px-5 py-3 text-center rounded-tr-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingDaily ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-4 w-10 mx-auto" /></td>
                  </tr>
                ))
              ) : dailyData?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400 font-medium">
                    Belum ada data untuk bulan ini
                  </td>
                </tr>
              ) : (
                dailyData?.map((row: any, i: number) => {
                  const dateLabel = new Date(row.order_date).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short'
                  })
                  const isToday = new Date(row.order_date).toDateString() === new Date().toDateString()
                  
                  return (
                    <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${isToday ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-5 py-3.5">
                        <span className={`font-semibold ${isToday ? 'text-amber-700' : 'text-gray-900'}`}>
                          {dateLabel} {isToday && <span className="text-[10px] ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">Hari Ini</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">
                        {formatRupiah(row.daily_sales)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {formatRupiah(row.target_amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-semibold ${row.is_reached ? 'text-green-600' : 'text-gray-400'}`}>
                          {row.is_reached ? `+ ${formatRupiah(row.bonus_amount)}` : '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {row.is_reached ? (
                          <div className="inline-flex items-center justify-center bg-green-50 text-green-600 rounded-full p-1.5">
                            <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center bg-gray-50 text-gray-400 rounded-full p-1.5">
                            <XCircle className="w-4 h-4" strokeWidth={2.5} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
