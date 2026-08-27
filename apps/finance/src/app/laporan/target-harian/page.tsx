'use client'

import { useMemo, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import { useHistoricalTargets, useSyncTargets } from '@/hooks/useHistoricalTargets'
import { useOutlets } from '@/hooks/useOutlets'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PageHeader, Section } from '@/components/ui'
import { FileText, AlertCircle, RefreshCw } from 'lucide-react'
import { cleanOutletName } from '@/components/OutletCombobox'
import { rupiah } from '@/lib/format'

export default function TargetHarianPage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
  const scopedOutlets = useMemo(
    () => (lockedOutletId ? outlets.filter((o) => o.id === lockedOutletId) : outlets),
    [outlets, lockedOutletId]
  )
  
  const { rows, groupedByDate, isLoading, isError, error } = useHistoricalTargets(filter)
  const syncMutation = useSyncTargets()

  useEffect(() => {
    if (filter.from && filter.to) {
      syncMutation.mutate({ from: filter.from, to: filter.to })
    }
  }, [filter.from, filter.to])

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
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
          <PeriodFilter 
            value={filter} 
            onChange={setFilter} 
            outlets={scopedOutlets} 
            lockedOutletId={lockedOutletId} 
          />
          <button
            onClick={() => syncMutation.mutate({ from: filter.from, to: filter.to })}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-suka-orange text-white text-xs font-bold rounded-2xl hover:bg-amber-600 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Menyinkronkan...' : 'Sinkronisasi Data'}
          </button>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-suka-brown font-bold text-sm bg-white rounded-3xl border border-suka-brown/10 shadow-sm">
          <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mb-4"></div>
          Memuat data laporan...
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 bg-red-50 rounded-3xl border border-red-200 shadow-sm border-dashed text-red-600">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4 text-red-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-1">Gagal Memuat Data</h3>
          <p className="text-sm text-center max-w-sm">
            Terjadi kesalahan saat mengambil laporan target harian: {error?.message}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-suka-brown/10 shadow-sm border-dashed">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-suka-orange/40">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-suka-brown mb-1">Belum Ada Data Laporan</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm">
            Data laporan untuk periode {dateRangeLabel} belum tersedia.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dateStr, dateRows]) => {
              const formattedDateGroup = format(parseISO(dateStr), 'EEEE, dd MMMM yyyy', { locale: id })
              return (
                <Section key={dateStr} title={formattedDateGroup} collapsible defaultOpen={false}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {dateRows.map((record) => {
                      const isAchieved = record.achieved_pct >= 100
                      const formattedDate = format(parseISO(record.record_date), 'dd MMM yyyy', { locale: id })
                      
                      return (
                        <div 
                          key={record.id}
                          className="p-4 rounded-2xl border border-suka-gray-200 bg-white hover:border-suka-orange/30 hover:shadow-md transition-all duration-300 relative overflow-hidden group"
                        >
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${
                            isAchieved ? 'bg-emerald-500' : record.achieved_pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          
                          <div className="pl-3">
                            <div className="flex justify-between items-start mb-3 gap-2">
                              <h4 className="font-bold text-suka-brown text-xs leading-tight">
                                {cleanOutletName(record.outlet_name)}
                              </h4>
                              <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-md">
                                {formattedDate}
                              </span>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Omzet Dicapai</div>
                                <div className="font-extrabold text-suka-brown text-base">
                                  {rupiah(record.omzet_achieved)}
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex justify-between items-end mb-1">
                                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target</div>
                                  <div className="font-bold text-gray-600 text-xs">
                                    {rupiah(record.target_amount)}
                                  </div>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-500
                                      ${isAchieved ? 'bg-emerald-500' : record.achieved_pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'}
                                    `}
                                    style={{ width: `${Math.min(record.achieved_pct, 100)}%` }}
                                  ></div>
                                </div>
                                <div className="mt-1.5 text-right">
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
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
                </Section>
              )
          })}
        </div>
      )}
    </div>
  )
}
