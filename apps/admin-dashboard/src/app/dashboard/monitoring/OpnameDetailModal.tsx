'use client'

import { useEffect, useState } from 'react'
import { getOpnameDetails } from './actions'
import { Spinner } from '@suka/design-system'
import { X, AlertCircle, CheckCircle2, Search, Filter, TrendingUp, TrendingDown } from 'lucide-react'

/**
 * Smart quantity formatter — makes numbers human-readable based on unit type.
 * - Weight units (kg, gram, g, liter, ml): show up to 2 decimals
 * - Count units (pack, dus, ikat, buah, pcs, lembar, bungkus, tabung, blok): round to whole number
 * - Everything else: show up to 1 decimal
 */
const WEIGHT_UNITS = ['kg', 'gram', 'g', 'liter', 'ml', 'l']

function getUnitDecimals(satuan?: string): number {
  const unit = (satuan || '').toLowerCase().trim()
  if (WEIGHT_UNITS.includes(unit)) return 3
  return 2
}

function smartQty(num: number | null | undefined, satuan?: string): string {
  if (num === null || num === undefined || isNaN(num)) return '-'
  const decimals = getUnitDecimals(satuan)
  
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num)
}

/** Capitalise first letter of unit for display */
function displayUnit(satuan: string): string {
  if (!satuan) return ''
  return satuan.charAt(0).toUpperCase() + satuan.slice(1).toLowerCase()
}

type OpnameItemDetail = {
  id: string
  bahan_baku_id: string
  qty_fisik: number | null
  qty_system: number
  selisih: number
  flagged: boolean
  catatan: string | null
  bahan_baku: {
    nama: string
    satuan: string
  }
}

type OpnameHeader = {
  id: string
  outlet_id: string
  tanggal: string
  tipe: string
  status: string
  notes: string | null
  created_at: string
  outlet_staff: {
    name: string
  } | null
}

interface Props {
  opnameId: string
  outletName: string
  onClose: () => void
}

type FilterTab = 'ALL' | 'SELISIH' | 'FLAGGED'

export default function OpnameDetailModal({ opnameId, outletName, onClose }: Props) {
  const [header, setHeader] = useState<OpnameHeader | null>(null)
  const [items, setItems] = useState<OpnameItemDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true)
      try {
        const { header, items } = await getOpnameDetails(opnameId)
        setHeader(header)
        setItems(items)
      } catch (err) {
        console.error('Failed to fetch opname details', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (opnameId) fetchDetails()
  }, [opnameId])

  // Filter items
  const filteredItems = items.filter(item => {
    // Text search
    if (searchQuery && !item.bahan_baku?.nama?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    // Tab filter
    if (activeTab === 'SELISIH') {
      const selisihNum = Math.round((Number(item.selisih) || 0) * 100) / 100
      if (selisihNum === 0) return false
    }
    if (activeTab === 'FLAGGED' && !item.flagged) return false
    return true
  })

  const countSelisih = items.filter(i => {
    const decimals = getUnitDecimals(i.bahan_baku.satuan)
    const multiplier = Math.pow(10, decimals)
    const s = Math.round((Number(i.selisih) || 0) * multiplier) / multiplier
    return s !== 0
  }).length
  const countFlagged = items.filter(i => i.flagged).length

  // Outside click handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const timeStr = header ? new Date(header.created_at).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(':', '.') + ' WIB' : ''

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-4xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 border-t sm:border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 lg:px-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-900">Detail Opname Harian</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-bold text-suka-orange">{outletName}</span>
              <span className="text-slate-300">•</span>
              <span className="text-sm font-semibold text-slate-500">
                {header ? `Pukul ${timeStr}` : 'Memuat...'}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[400px]">
            <Spinner className="w-8 h-8 text-suka-orange mb-4" />
            <p className="text-sm font-semibold text-slate-500">Memuat detail opname...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Meta Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 lg:px-6 bg-white border-b border-slate-100">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                <span className="text-sm font-extrabold text-slate-800 capitalize">{header?.status}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipe</span>
                <span className="text-sm font-extrabold text-slate-800 capitalize">{header?.tipe}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Kru Pelapor</span>
                <span className="text-sm font-extrabold text-slate-800">{header?.outlet_staff?.name || '-'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Item</span>
                <span className="text-sm font-extrabold text-slate-800">{filteredItems.length} Bahan Baku</span>
              </div>
              {header?.notes && (
                <div className="col-span-2 md:col-span-4">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Catatan Khusus</span>
                  <p className="text-sm font-semibold text-slate-700 bg-amber-50 p-3 rounded-lg border border-amber-100 mt-1">
                    {header.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="p-4 lg:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 border-b border-slate-100">
              <div className="flex p-1.5 bg-slate-200/60 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar gap-1">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Semua ({items.length})
                </button>
                <button
                  onClick={() => setActiveTab('SELISIH')}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'SELISIH' ? 'bg-white text-suka-orange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <AlertCircle size={16} className={activeTab === 'SELISIH' ? 'text-suka-orange' : 'text-slate-400'} />
                  Selisih ({countSelisih})
                </button>
                <button
                  onClick={() => setActiveTab('FLAGGED')}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'FLAGGED' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Ditandai ({countFlagged})
                </button>
              </div>

              <div className="relative w-full sm:w-[250px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari bahan baku..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-suka-orange/20 focus:border-suka-orange transition-all"
                />
              </div>
            </div>

            {/* Table for Desktop */}
            <div className="hidden md:block flex-1 overflow-auto bg-white p-0 m-0">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">Bahan Baku</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 text-right">Qty Sistem</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 text-right">Qty Fisik</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 text-right">Selisih</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Filter className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-500">Tidak ada item yang sesuai filter</p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const rawSelisih = Number(item.selisih) || 0
                      const decimals = getUnitDecimals(item.bahan_baku.satuan)
                      const multiplier = Math.pow(10, decimals)
                      const selisihNum = Math.round(rawSelisih * multiplier) / multiplier
                      const hasSelisih = selisihNum !== 0
                      const isMinus = selisihNum < 0

                      return (
                        <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.flagged ? 'bg-red-50/40' : ''}`}>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-800">{item.bahan_baku.nama}</span>
                              {item.flagged && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700">Flagged</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-semibold text-slate-600 tabular-nums">{smartQty(Number(item.qty_system), item.bahan_baku.satuan)}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{displayUnit(item.bahan_baku.satuan)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-slate-900 tabular-nums">{item.qty_fisik !== null ? smartQty(Number(item.qty_fisik), item.bahan_baku.satuan) : '-'}</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{displayUnit(item.bahan_baku.satuan)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            {hasSelisih ? (
                              <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs font-black ${isMinus ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                <div className="flex items-center gap-1">
                                  {isMinus ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                                  <span className="text-sm tabular-nums">{smartQty(Math.abs(selisihNum), item.bahan_baku.satuan)}</span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${isMinus ? 'text-red-500' : 'text-emerald-500'}`}>{isMinus ? 'Kurang' : 'Lebih'} · {displayUnit(item.bahan_baku.satuan)}</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">
                                <CheckCircle2 size={14} className="opacity-50" /> Sinkron
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {item.catatan ? (
                              <p className="text-xs font-medium text-slate-600 line-clamp-2 max-w-[200px]" title={item.catatan}>
                                {item.catatan}
                              </p>
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden flex-1 overflow-y-auto bg-slate-50 p-4 flex flex-col gap-3">
              {filteredItems.length === 0 ? (
                <div className="px-6 py-12 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
                  <Filter className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500">Tidak ada item yang sesuai filter</p>
                </div>
              ) : (
                filteredItems.map(item => {
                  const rawSelisih = Number(item.selisih) || 0
                  const decimals = getUnitDecimals(item.bahan_baku.satuan)
                  const multiplier = Math.pow(10, decimals)
                  const selisihNum = Math.round(rawSelisih * multiplier) / multiplier
                  const hasSelisih = selisihNum !== 0
                  const isMinus = selisihNum < 0
                  
                  return (
                    <div key={item.id} className={`bg-white rounded-2xl shadow-sm border p-4 ${item.flagged ? 'border-red-200' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-extrabold text-slate-900 text-base">{item.bahan_baku.nama}</span>
                        {item.flagged && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700">Flagged</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider mb-1">Qty Sistem</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-slate-700 tabular-nums leading-none">
                              {smartQty(Number(item.qty_system), item.bahan_baku.satuan)}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">{displayUnit(item.bahan_baku.satuan)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end text-right border-l border-slate-200/50 pl-3">
                          <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider mb-1">Qty Fisik</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-slate-900 tabular-nums leading-none">
                              {item.qty_fisik !== null ? smartQty(Number(item.qty_fisik), item.bahan_baku.satuan) : '-'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">{displayUnit(item.bahan_baku.satuan)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        {hasSelisih ? (
                          <div className={`flex items-center justify-between px-3.5 py-3 rounded-xl border ${isMinus ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isMinus ? 'text-red-600/80' : 'text-emerald-600/80'}`}>Selisih {isMinus ? 'Kurang' : 'Lebih'}</span>
                            <div className={`flex items-center gap-1.5 font-black ${isMinus ? 'text-red-700' : 'text-emerald-700'}`}>
                              {isMinus ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                              <div className="flex items-baseline gap-1">
                                <span className="text-base tabular-nums leading-none">{smartQty(Math.abs(selisihNum), item.bahan_baku.satuan)}</span>
                                <span className="text-[10px] font-bold">{displayUnit(item.bahan_baku.satuan)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 font-bold text-sm">
                            <CheckCircle2 size={16} className="opacity-50" /> Sinkron
                          </div>
                        )}
                      </div>

                      {item.catatan && (
                        <div className="mt-3 text-xs font-medium text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                          <span className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Catatan</span>
                          {item.catatan}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
