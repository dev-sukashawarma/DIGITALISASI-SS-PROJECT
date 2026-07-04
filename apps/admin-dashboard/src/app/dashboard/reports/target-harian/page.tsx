'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import { useHistoricalTargets } from '@/hooks/useHistoricalTargets'
import { useOutlets } from '@/hooks/useOutlets'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PageHeader } from '@/components/ui'
import { Target, Search, FileText } from 'lucide-react'

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}

export default function TargetHarianPage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
  const scopedOutlets = useMemo(
    () => (lockedOutletId ? outlets.filter((o) => o.id === lockedOutletId) : outlets),
    [outlets, lockedOutletId]
  )
  
  const { rows, isLoading } = useHistoricalTargets(filter)

  // Group by date
  const groupedData = useMemo(() => {
    const groups: Record<string, typeof rows> = {}
    rows.forEach(row => {
      if (!groups[row.record_date]) {
        groups[row.record_date] = []
      }
      groups[row.record_date].push(row)
    })
    
    // Sort dates descending
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        records: groups[date]
      }))
  }, [rows])

  const dateRangeLabel = useMemo(() => {
    try {
      if (filter.from === filter.to) {
        return format(parseISO(filter.from), 'dd MMMM yyyy', { locale: id })
      }
      return `${format(parseISO(filter.from), 'dd MMM yyyy', { locale: id })} - ${format(parseISO(filter.to), 'dd MMM yyyy', { locale: id })}`
    } catch {
      return ''
    }
  }, [filter.from, filter.to])

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Laporan Target Harian" 
        description="Rekapitulasi historis pencapaian target harian per outlet."
      >
        <PeriodFilter 
          value={filter} 
          onChange={setFilter} 
          outlets={scopedOutlets} 
          lockedOutletId={lockedOutletId} 
        />
      </PageHeader>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-suka-brown font-bold text-sm bg-white rounded-3xl border border-suka-brown/10 shadow-sm">
          <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mb-4"></div>
          Memuat data laporan...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-suka-brown/10 shadow-sm border-dashed">
          <div className="w-16 h-16 bg-suka-cream/50 rounded-2xl flex items-center justify-center mb-4 text-suka-brown/30">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-suka-brown mb-1">Belum Ada Data Laporan</h3>
          <p className="text-sm text-suka-brown/50 text-center max-w-sm">
            Data laporan untuk periode {dateRangeLabel} belum tersedia.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedData.map((group) => {
            const formattedDate = format(parseISO(group.date), 'EEEE, dd MMMM yyyy', { locale: id })
            
            return (
              <div key={group.date} className="bg-white rounded-3xl shadow-sm border border-suka-brown/10 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-suka-cream/30 to-transparent border-b border-suka-brown/10">
                  <h3 className="font-bold text-suka-brown flex items-center gap-2">
                    <Target className="w-4 h-4 text-suka-orange" />
                    {formattedDate}
                  </h3>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.records.map((record) => {
                      const isAchieved = record.achieved_pct >= 100
                      
                      return (
                        <div 
                          key={record.id}
                          className="p-4 rounded-2xl border border-suka-gray-200 bg-white hover:border-suka-orange/30 hover:shadow-md transition-all duration-300 relative overflow-hidden group"
                        >
                          <div className={`absolute top-0 left-0 w-1 h-full ${
                            isAchieved ? 'bg-emerald-500' : record.achieved_pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          
                          <div className="pl-3">
                            <h4 className="font-bold text-suka-brown text-sm mb-3">
                              {record.outlets?.name || 'Outlet Tidak Diketahui'}
                            </h4>
                            
                            <div className="space-y-3">
                              <div>
                                <div className="text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider mb-0.5">Omzet Dicapai</div>
                                <div className="font-extrabold text-suka-brown text-lg">
                                  {formatRupiah(record.omzet_achieved)}
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex justify-between items-end mb-1">
                                  <div className="text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider">Target</div>
                                  <div className="font-bold text-suka-gray-600 text-xs">
                                    {formatRupiah(record.target_amount)}
                                  </div>
                                </div>
                                <div className="h-1.5 w-full bg-suka-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-500
                                      ${isAchieved ? 'bg-emerald-500' : record.achieved_pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'}
                                    `}
                                    style={{ width: `${Math.min(record.achieved_pct, 100)}%` }}
                                  ></div>
                                </div>
                                <div className="mt-1.5 text-right">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                    isAchieved ? 'bg-emerald-50 text-emerald-600' : 
                                    record.achieved_pct >= 80 ? 'bg-amber-50 text-amber-600' : 
                                    'bg-rose-50 text-rose-600'
                                  }`}>
                                    {record.achieved_pct.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
