'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@suka/design-system'
import { Select } from '@/components/ui/Select'
import { Calendar, ClipboardList, Store, CalendarClock, User, ChevronRight, CheckCircle2 } from 'lucide-react'
import { presetRange } from '@/lib/period'
import OpnameDetailModal from '../monitoring/OpnameDetailModal'
import { getOpnamesData } from './actions'

type Outlet = { id: string; name: string }

function formatIndonesianDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', 
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function formatWIBTime(tsServerStr: string): string {
  try {
    const d = new Date(tsServerStr)
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(':', '.') + ' WIB'
  } catch {
    return ''
  }
}

function CustomDateRangePopover({
  from, to, onChange, isActive
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  isActive: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  useEffect(() => {
    if (open) {
      setLocalFrom(from)
      setLocalTo(to)
    }
  }, [open, from, to])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleApply = () => {
    if (localFrom && localTo) {
      onChange({ from: localFrom, to: localTo })
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative flex">
      <button
        onClick={() => setOpen(!open)}
        className={`px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-sm cursor-pointer ${
          isActive || open
            ? 'bg-suka-orange text-white shadow-sm font-extrabold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-bold'
        }`}
        title="Rentang tanggal kustom"
      >
        <Calendar className="w-4 h-4" />
        <span>Kustom</span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 sm:left-auto bg-white p-4 rounded-xl shadow-xl border border-slate-200 z-50 flex flex-col gap-3 min-w-[280px] w-max sm:w-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dari</label>
              <input
                type="date"
                value={localFrom}
                onChange={e => setLocalFrom(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-suka-orange/20 focus:border-suka-orange transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sampai</label>
              <input
                type="date"
                value={localTo}
                onChange={e => setLocalTo(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-suka-orange/20 focus:border-suka-orange transition-all"
                min={localFrom}
              />
            </div>
          </div>
          <button
            onClick={handleApply}
            disabled={!localFrom || !localTo || localTo < localFrom}
            className="w-full bg-suka-orange text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Terapkan Filter
          </button>
        </div>
      )}
    </div>
  )
}

export default function OpnamePage() {
  const supabase = createClient()
  const today = presetRange('today')
  
  const [period, setPeriod] = useState<{ from: string; to: string }>(today)
  const [outletId, setOutletId] = useState<string>('ALL')
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [opnames, setOpnames] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOpname, setSelectedOpname] = useState<{ id: string; outletName: string } | null>(null)

  // Fetch Outlets
  useEffect(() => {
    const fetchOutlets = async () => {
      const { data } = await supabase.from('outlets').select('id, name').eq('is_active', true)
      if (data) setOutlets(data)
    }
    fetchOutlets()
  }, [])

  // Fetch Data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getOpnamesData(period.from, period.to, outletId)
      setOpnames(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [period.from, period.to, outletId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isPresetActive = (p: string) => {
    if (p === 'custom') {
      return (
        JSON.stringify(period) !== JSON.stringify(presetRange('today')) &&
        JSON.stringify(period) !== JSON.stringify(presetRange('yesterday')) &&
        JSON.stringify(period) !== JSON.stringify(presetRange('7d')) &&
        JSON.stringify(period) !== JSON.stringify(presetRange('30d'))
      )
    }
    return JSON.stringify(period) === JSON.stringify(presetRange(p as any))
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Detail Opname Outlet</h1>
            <p className="text-slate-500 text-sm mt-1">Pantau dan kelola laporan stok opname dari seluruh mitra.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          
          {/* Period Filter */}
          <div className="flex p-1.5 bg-slate-100 rounded-xl w-full md:w-auto overflow-x-auto hide-scrollbar gap-1">
            <button
              onClick={() => setPeriod(presetRange('today'))}
              className={`px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-sm font-bold whitespace-nowrap cursor-pointer flex-1 md:flex-none ${
                isPresetActive('today') ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setPeriod(presetRange('yesterday'))}
              className={`px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-sm font-bold whitespace-nowrap cursor-pointer flex-1 md:flex-none ${
                isPresetActive('yesterday') ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              Kemarin
            </button>
            <button
              onClick={() => setPeriod(presetRange('7d'))}
              className={`px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-sm font-bold whitespace-nowrap cursor-pointer flex-1 md:flex-none ${
                isPresetActive('7d') ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriod(presetRange('30d'))}
              className={`px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-sm font-bold whitespace-nowrap cursor-pointer flex-1 md:flex-none ${
                isPresetActive('30d') ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              30 Hari
            </button>
            <div className="flex-1 md:flex-none flex items-center">
              <CustomDateRangePopover
              from={period.from}
              to={period.to}
              onChange={setPeriod}
              isActive={isPresetActive('custom')}
            />
            </div>
          </div>

          {/* Outlet Filter */}
          <div className="w-full md:w-[250px]">
            <Select
              value={outletId}
              onChange={(val) => setOutletId(val)}
              options={[
                { value: 'ALL', label: 'Semua Outlet' },
                ...outlets.map(o => ({ value: o.id, label: o.name }))
              ]}
              className="bg-slate-50"
              searchable={true}
              searchPlaceholder="Cari outlet..."
            />
          </div>
        </div>

        {/* Data List */}
        <div>
          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col items-center justify-center py-24">
              <Spinner className="w-8 h-8 text-suka-orange mb-4" />
              <p className="text-slate-500 font-medium">Memuat data opname...</p>
            </div>
          ) : opnames.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col items-center justify-center py-24">
              <ClipboardList className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-600 font-bold">Belum ada laporan opname.</p>
              <p className="text-slate-400 text-sm mt-1 text-center max-w-sm">
                Coba ubah filter rentang tanggal atau outlet untuk melihat data lainnya.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {opnames.map(op => (
                <div 
                  key={op.id} 
                  onClick={() => setSelectedOpname({ id: op.id, outletName: op.outletName })}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:border-suka-orange/50 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center flex-shrink-0 group-hover:bg-suka-orange group-hover:text-white transition-colors">
                      <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-suka-orange transition-colors">{op.outletName || 'Outlet tidak diketahui'}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                        <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {formatIndonesianDate(op.tanggal || op.created_at)} {formatWIBTime(op.created_at)}</span>
                        <span className="hidden md:inline text-slate-300">•</span>
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {op.staffName || '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t border-slate-100 md:border-t-0 pt-4 md:pt-0">
                    <div className="text-left md:text-right">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                        op.status === 'finalized' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {op.status}
                      </span>
                      <div className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 inline-block mt-1 uppercase tracking-widest md:ml-2">
                        {op.tipe}
                      </div>
                    </div>
                    
                    <div className="px-4 border-l border-slate-100 flex items-center justify-center min-w-[120px]">
                      {op.totalSelisih > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-black text-red-600">{op.totalSelisih} <span className="text-[10px] uppercase font-bold text-red-600/70 tracking-widest">Selisih</span></span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Dari {op.totalItem} Bahan</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                            <CheckCircle2 className="w-4 h-4" /> Aman
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{op.totalItem} Bahan dicek</span>
                        </div>
                      )}
                    </div>
            
                    <button className="flex items-center justify-center bg-slate-50 border border-slate-200 group-hover:border-suka-orange group-hover:text-suka-orange group-hover:bg-orange-50 text-slate-400 p-2.5 rounded-xl transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedOpname && (
        <OpnameDetailModal
          opnameId={selectedOpname.id}
          outletName={selectedOpname.outletName}
          onClose={() => setSelectedOpname(null)}
        />
      )}
    </div>
  )
}
