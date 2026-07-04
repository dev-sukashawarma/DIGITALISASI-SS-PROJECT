'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import { useHistoricalTargets } from '@/hooks/useHistoricalTargets'

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export default function LaporanTargetHarianPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1 // 1-12

  const { groupedByDate, isLoading } = useHistoricalTargets(year, month)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  // Get days array sorted descending
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 pb-24">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl border border-white/50 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Laporan Target Harian
          </h1>
          <p className="text-gray-500 mt-1">Rekapitulasi pencapaian target harian per outlet.</p>
        </div>

        {/* Month Picker */}
        <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-inner">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-white rounded-xl transition-all text-gray-500 hover:text-gray-900 hover:shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="font-semibold text-gray-700 min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: id })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-white rounded-xl transition-all text-gray-500 hover:text-gray-900 hover:shadow-sm"
            disabled={year === new Date().getFullYear() && month === new Date().getMonth() + 1}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Content section */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 border-dashed shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-xl font-medium text-gray-900">Belum Ada Data Laporan</p>
          <p className="text-gray-500 mt-2">Data laporan untuk bulan {format(currentDate, 'MMMM yyyy', { locale: id })} belum tersedia.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dayRecords = groupedByDate[dateStr]
            const totalTarget = dayRecords.reduce((sum, r) => sum + r.target_amount, 0)
            const totalOmzet = dayRecords.reduce((sum, r) => sum + r.omzet_achieved, 0)
            const overallPct = totalTarget > 0 ? (totalOmzet / totalTarget) * 100 : 0
            
            return (
              <div key={dateStr} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {/* Date Header */}
                <div className="bg-gray-50/50 border-b border-gray-100 p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {format(parseISO(dateStr), 'EEEE, d MMMM yyyy', { locale: id })}
                    </h2>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Target</span>
                        <span className="font-semibold text-gray-700">{formatRupiah(totalTarget)}</span>
                      </div>
                      <div className="w-px h-8 bg-gray-200"></div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Omzet</span>
                        <span className="font-semibold text-gray-900">{formatRupiah(totalOmzet)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Overall Progress for the day */}
                  <div className="flex flex-col items-end min-w-[120px]">
                    <span className="text-sm font-medium text-gray-500 mb-1">Pencapaian Total</span>
                    <div className="flex items-center gap-3 w-full justify-end">
                      <span className={`text-2xl font-bold ${overallPct >= 100 ? 'text-emerald-500' : overallPct >= 80 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {overallPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Outlet List */}
                <div className="p-2 sm:p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dayRecords.map((record) => (
                      <div key={record.id} className="p-4 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50/50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-gray-800 line-clamp-1">{record.outlet_name}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                            ${record.achieved_pct >= 100 ? 'bg-emerald-100 text-emerald-700' 
                              : record.achieved_pct >= 80 ? 'bg-amber-100 text-amber-700' 
                              : 'bg-rose-100 text-rose-700'}`}
                          >
                            {record.achieved_pct.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Target</span>
                            <span className="font-medium text-gray-700">{formatRupiah(record.target_amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Tercapai</span>
                            <span className="font-medium text-gray-900">{formatRupiah(record.omzet_achieved)}</span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="pt-2">
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-500
                                  ${record.achieved_pct >= 100 ? 'bg-emerald-500' : record.achieved_pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'}
                                `}
                                style={{ width: \`\${Math.min(record.achieved_pct, 100)}%\` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
