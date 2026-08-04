'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useOutlets } from '@/hooks/useOutlets'
import { Spinner, EmptyState } from '@suka/design-system'
import { rupiah, formatNumber } from '@/lib/format'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Wallet, ShoppingBag, PackageSearch, FileText, FileSpreadsheet } from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { exportToCSV, exportToPDF } from '@/lib/exportUtils'
import { TargetCombobox } from '@/components/TargetCombobox'
import { Calendar, Globe, Monitor, Check, ChevronDown } from 'lucide-react'
import { getChannel } from '@/lib/channels'

export function cleanOutletName(name: string) {
  const upper = (name || '').toUpperCase()
  return upper.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

// Custom Date Range Popover component for better UI
function CustomDateRangePopover({
  from, to, onChange, isActive
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  isActive: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  React.useEffect(() => {
    if (open) {
      setLocalFrom(from)
      setLocalTo(to)
    }
  }, [open, from, to])

  React.useEffect(() => {
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
    <div ref={rootRef} className="relative flex w-full sm:w-auto mt-2 sm:mt-0">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
          isActive || open
            ? 'bg-suka-orange text-white shadow-md font-extrabold ring-1 ring-black/5'
            : 'bg-white text-suka-brown/70 hover:text-suka-brown border border-suka-gray-200'
        }`}
        title="Rentang tanggal kustom"
      >
        <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span>Kustom</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 sm:right-auto sm:left-0 mt-2 p-4 w-[280px] max-w-[calc(100vw-2rem)] bg-white border border-suka-gray-200 rounded-2xl shadow-xl shadow-suka-brown/10 z-[50] animate-in fade-in zoom-in-95 duration-200">
          <h4 className="text-sm font-bold text-suka-brown mb-3">Pilih Rentang Tanggal</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider mb-1">Dari Tanggal</label>
              <input 
                type="date" 
                value={localFrom} 
                onChange={(e) => setLocalFrom(e.target.value)} 
                className="w-full px-3 py-2 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-sm outline-none transition-all text-suka-ink font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider mb-1">Sampai Tanggal</label>
              <input 
                type="date" 
                value={localTo} 
                onChange={(e) => setLocalTo(e.target.value)} 
                min={localFrom}
                className="w-full px-3 py-2 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-sm outline-none transition-all text-suka-ink font-medium"
              />
            </div>
            <button 
              onClick={handleApply}
              disabled={!localFrom || !localTo || localTo < localFrom}
              className="w-full mt-2 bg-suka-orange hover:bg-amber-600 disabled:bg-suka-gray-200 disabled:text-suka-gray-400 disabled:shadow-none text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-suka-orange/20 active:scale-95"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const SOURCES = ['all', 'offline', 'online', 'gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo']
const SOURCE_LABELS: Record<string, string> = {
  all: 'Semua Channel',
  offline: 'Offline',
  online: 'Website Online',
  gofood: 'GoFood',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  tiktok: 'TikTok Shop',
  tiktokgo: 'TikTok Go'
}

function SourceCombobox({
  value, onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  const selectedLabel = SOURCE_LABELS[value] ?? value

  React.useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const renderIcon = (id: string, w = "w-4", h = "h-4") => {
    if (id === "all") return <Globe className={`${w} ${h} text-suka-brown/50`} />
    if (id === "offline" || id === "pos") return <Monitor className={`${w} ${h} text-suka-brown/50`} />
    if (id === "online") return <Globe className={`${w} ${h} text-suka-brown/50`} />
    
    const ch = getChannel(id)
    if (ch?.logoPath) {
      return (
        <svg viewBox="0 0 24 24" className={`${w} ${h}`} style={{ fill: ch.bg }}>
          <path d={ch.logoPath} />
        </svg>
      )
    }
    return <Globe className={`${w} ${h} text-suka-brown/50`} />
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-[180px] flex items-center gap-2 pl-9 pr-8 py-2.5 sm:py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
          {renderIcon(value)}
        </span>
        <span className="truncate text-left flex-1">{selectedLabel}</span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full sm:min-w-[180px] sm:right-0 bg-white border border-suka-gray-200 rounded-xl shadow-lg shadow-suka-brown/10 overflow-hidden">
          <ul className="max-h-64 overflow-y-auto py-1">
            {SOURCES.map((s) => {
              const isActive = s === value
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(s)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-left transition-colors ${
                      isActive ? "bg-suka-orange/10 text-suka-orange" : "text-suka-brown hover:bg-suka-cream/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {renderIcon(s)}
                      <span className="truncate">{SOURCE_LABELS[s] ?? s}</span>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function OutletRevenueTab() {
  const [preset, setPreset] = useState('bulan_ini')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  
  const [viewMode, setViewMode] = useState<'ringkasan' | 'item'>('ringkasan')
  const [selectedOutletId, setSelectedOutletId] = useState('all')
  const [selectedChannel, setSelectedChannel] = useState('all')
  const [isExporting, setIsExporting] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const { data: outlets = [] } = useOutlets()

  const handlePresetChange = (val: string) => {
    setPreset(val)
    const today = new Date()
    
    if (val === 'hari_ini') {
      const d = today.toISOString().slice(0, 10)
      setStartDate(d)
      setEndDate(d)
    } else if (val === 'kemarin') {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      const str = d.toISOString().slice(0, 10)
      setStartDate(str)
      setEndDate(str)
    } else if (val === '7_hari') {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      setStartDate(start.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    } else if (val === '30_hari') {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      setStartDate(start.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    } else if (val === 'bulan_ini') {
      const d = new Date(today)
      setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
      setEndDate(d.toISOString().slice(0, 10))
    }
  }

  const handleCustomDateChange = (range: { from: string; to: string }) => {
    setPreset('custom')
    setStartDate(range.from)
    setEndDate(range.to)
  }

  const { data: revenueData = [], isLoading: loadingRevenue, error: errorRevenue } = useQuery({
    queryKey: ['outlet_revenue', startDate, endDate, selectedOutletId, selectedChannel],
    queryFn: async () => {
      const from = startDate
      const to = endDate

      const fetchAllSales = async () => {
        let allSales: any[] = []
        let offset = 0
        const limit = 1000
        while (true) {
          let q = supabase
            .from('orders')
            .select('created_at, outlet_id, sales_source, total_amount, discount_amount, promo_subsidy, order_items(subtotal)')
            .eq('status', 'completed')
            .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
            .gte('created_at', `${from}T00:00:00+07:00`)
            .lte('created_at', `${to}T23:59:59+07:00`)
            .range(offset, offset + limit - 1)
          
          if (selectedOutletId !== 'all') {
            q = q.eq('outlet_id', selectedOutletId)
          }
          if (selectedChannel !== 'all') {
            q = q.eq('sales_source', selectedChannel)
          }
          
          const { data, error } = await q
          if (error) throw error
          if (data) allSales = allSales.concat(data)
          if (!data || data.length < limit) break
          offset += limit
        }
        return allSales
      }

      const [salesData, outletsRes] = await Promise.all([
        fetchAllSales(),
        supabase
          .from('outlets')
          .select('id, name')
      ])

      if (outletsRes.error) throw outletsRes.error

      const nameMap = new Map<string, string>()
      outletsRes.data?.forEach(o => nameMap.set(o.id, o.name))

      const aggMap = new Map<string, { date: string; outletId: string; outletName: string; channel: string; totalRevenue: number; totalOrders: number; totalPotongan: number; netRevenue: number; potonganSource: string }>()

      salesData.forEach(s => {
        const d = new Date(s.created_at)
        const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
        const outletId = s.outlet_id
        const channel = s.sales_source || 'Offline'
        const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
        const key = `${date}-${outletId}-${channel}`
        
        const netAmt = Number(s.total_amount || 0)
        let disc = Number(s.discount_amount || 0)
        let promoApps = Number(s.promo_subsidy || 0)
        let potongan = 0
        let src = ''
        
        if (disc > 0 || promoApps > 0) {
          potongan = disc + promoApps
          if (disc > 0 && promoApps > 0) src = 'Promo/Diskon, Promo Apps'
          else if (disc > 0) src = 'Promo/Diskon'
          else if (promoApps > 0) src = 'Promo Apps'
        } else {
          // Fallback like admin-dashboard: check order_items subtotal vs total_amount
          const itemSubtotal = (s.order_items as any[] || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)
          const itemDiff = itemSubtotal > netAmt ? itemSubtotal - netAmt : 0
          if (itemDiff > 0) {
            potongan = itemDiff
            src = 'Diskon Item'
          }
        }
        
        // Gross = Net + Potongan
        const gross = netAmt + potongan
        const net = netAmt
        
        const existing = aggMap.get(key)
        if (existing) {
          existing.totalRevenue += gross
          existing.totalOrders += 1
          existing.totalPotongan += potongan
          existing.netRevenue += net
          if (src.includes('Promo/Diskon') && !existing.potonganSource.includes('Promo/Diskon')) {
            existing.potonganSource += existing.potonganSource ? ', Promo/Diskon' : 'Promo/Diskon'
          }
          if (src.includes('Promo Apps') && !existing.potonganSource.includes('Promo Apps')) {
            existing.potonganSource += existing.potonganSource ? ', Promo Apps' : 'Promo Apps'
          }
          if (src.includes('Diskon Item') && !existing.potonganSource.includes('Diskon Item')) {
            existing.potonganSource += existing.potonganSource ? ', Diskon Item' : 'Diskon Item'
          }
        } else {
          aggMap.set(key, {
            date,
            outletId,
            outletName,
            channel,
            totalRevenue: gross,
            totalOrders: 1,
            totalPotongan: potongan,
            netRevenue: net,
            potonganSource: src
          })
        }
      })

      return Array.from(aggMap.values()).sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date) // Sort descending by date
        return b.totalRevenue - a.totalRevenue
      })
    }
  })
  
  const { data: itemsData = [], isLoading: loadingItems, error: errorItems } = useQuery({
    queryKey: ['sales_items_spv', startDate, endDate, selectedOutletId, selectedChannel],
    queryFn: async () => {
      const from = startDate
      const to = endDate

      const fetchAllItems = async () => {
        let allItems: any[] = []
        let offset = 0
        const limit = 1000
        while (true) {
          let q = supabase
            .from('sales_items_spv')
            .select('sales_date, outlet_id, sales_source, menu_item_name, total_qty, total_revenue')
            .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
            .gte('sales_date', from)
            .lte('sales_date', to)
            .range(offset, offset + limit - 1)

          if (selectedOutletId !== 'all') {
            q = q.eq('outlet_id', selectedOutletId)
          }
          if (selectedChannel !== 'all') {
            q = q.eq('sales_source', selectedChannel)
          }

          const { data, error } = await q
          if (error) throw error
          if (data) allItems = allItems.concat(data)
          if (!data || data.length < limit) break
          offset += limit
        }
        return allItems
      }

      const [itemsDataRaw, outletsRes] = await Promise.all([
        fetchAllItems(),
        supabase
          .from('outlets')
          .select('id, name')
      ])

      if (outletsRes.error) throw outletsRes.error

      const nameMap = new Map<string, string>()
      outletsRes.data?.forEach(o => nameMap.set(o.id, o.name))
      
      const aggMap = new Map<string, { date: string; outletId: string; outletName: string; channel: string; itemName: string; totalQty: number; totalRevenue: number }>()

      itemsDataRaw.forEach(s => {
        const date = s.sales_date || 'Unknown Date'
        const outletId = s.outlet_id
        const channel = s.sales_source || 'Offline'
        const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
        
        let cleanName = s.menu_item_name || 'Unknown Item'
        const idIndex = cleanName.indexOf('|ID|')
        if (idIndex !== -1) {
          cleanName = cleanName.substring(0, idIndex).trim()
        }

        const key = `${date}-${outletId}-${channel}-${cleanName}`
        
        const existing = aggMap.get(key)
        if (existing) {
          existing.totalQty += Number(s.total_qty || 0)
          existing.totalRevenue += Number(s.total_revenue || 0)
        } else {
          aggMap.set(key, {
            date,
            outletId,
            outletName,
            channel,
            itemName: cleanName,
            totalQty: Number(s.total_qty || 0),
            totalRevenue: Number(s.total_revenue || 0)
          })
        }
      })
      
      return Array.from(aggMap.values()).sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        if (a.outletName === b.outletName) return b.totalQty - a.totalQty
        return a.outletName.localeCompare(b.outletName)
      })
    }
  })

  const totalOmzetAllOutlets = useMemo(() => {
    return revenueData.reduce((sum, item) => sum + item.totalRevenue, 0)
  }, [revenueData])

  const totalOrdersAllOutlets = useMemo(() => {
    return revenueData.reduce((sum, item) => sum + item.totalOrders, 0)
  }, [revenueData])

  const totalPotonganAllOutlets = useMemo(() => {
    return revenueData.reduce((sum, item) => sum + item.totalPotongan, 0)
  }, [revenueData])

  const totalPendapatanBersihAllOutlets = useMemo(() => {
    return revenueData.reduce((sum, item) => sum + item.netRevenue, 0)
  }, [revenueData])

  const handleExport = async (format: 'pdf' | 'csv') => {
    setIsExporting(true)
    
    let outletName = 'Semua Outlet'
    if (selectedOutletId !== 'all') {
      outletName = outlets.find(o => o.id === selectedOutletId)?.name || outletName
    }

    let channelName = 'Semua Channel'
    if (selectedChannel !== 'all') {
      channelName = selectedChannel
    }

    try {
      const dataToExport = viewMode === 'ringkasan' ? revenueData : itemsData
      
      if (format === 'csv') {
        exportToCSV(dataToExport, viewMode, startDate, endDate, outletName, channelName)
      } else {
        await exportToPDF(dataToExport, viewMode, startDate, endDate, outletName, channelName)
      }
    } catch (error) {
      console.error("Gagal export:", error)
      alert("Gagal men-download laporan")
    } finally {
      setIsExporting(false)
    }
  }

  if (errorRevenue || errorItems) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data omzet: {((errorRevenue || errorItems) as Error).message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          
          {/* Date Range Selector */}
          <div className="flex flex-col gap-2">
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider">Pilih Periode Laporan</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="bg-suka-cream/40 p-1.5 rounded-2xl border border-suka-gray-200 flex items-stretch gap-1 text-xs font-bold w-full sm:w-auto flex-wrap sm:flex-nowrap">
                {(['hari_ini', 'kemarin', '7_hari', '30_hari', 'bulan_ini']).map((p) => {
                  const isActive = preset === p
                  const label = p === 'hari_ini' ? 'Hari ini' : p === 'kemarin' ? 'Kemarin' : p === '7_hari' ? '7 Hari' : p === '30_hari' ? '30 Hari' : 'Bulan Ini'
                  return (
                    <button
                      key={p}
                      onClick={() => handlePresetChange(p)}
                      className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? 'bg-suka-orange text-white shadow-md font-extrabold ring-1 ring-black/5'
                          : 'text-suka-brown/70 hover:text-suka-brown hover:bg-suka-orange/5'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <CustomDateRangePopover
                from={startDate}
                to={endDate}
                onChange={handleCustomDateChange}
                isActive={preset === 'custom'}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider">Filter Outlet</p>
              <TargetCombobox 
                value={selectedOutletId} 
                onChange={setSelectedOutletId}
                options={[
                  { value: 'all', label: 'Semua Outlet' },
                  ...outlets.map(o => ({ value: o.id, label: cleanOutletName(o.name) }))
                ]}
                className="w-full sm:w-[200px]"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider">Filter Channel</p>
              <SourceCombobox 
                value={selectedChannel} 
                onChange={setSelectedChannel}
              />
            </div>
          </div>
          
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Total Omzet Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-suka-green/10 transition-all">
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                  <TrendingUp size={20} />
                </div>
              </div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-1">Total Omzet Keseluruhan</p>
              <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                <span className="text-lg mr-1 font-sans font-bold">Rp</span>
                <NumberFlow value={totalOmzetAllOutlets} />
              </h3>
            </div>
          </div>
        </div>

        {/* Total Potongan Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-red-500/10 transition-all">
          <div className="absolute right-0 top-0 w-32 h-32 bg-red-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="bg-red-100 p-2 rounded-xl text-red-600">
                  <TrendingDown size={20} />
                </div>
              </div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-1">Total Potongan (Promo)</p>
              <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                <span className="text-lg mr-1 font-sans font-bold text-red-500">-Rp</span>
                <NumberFlow value={totalPotonganAllOutlets} className="text-red-500" />
              </h3>
            </div>
          </div>
        </div>

        {/* Pendapatan Bersih Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-500/10 transition-all">
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                  <Wallet size={20} />
                </div>
              </div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-1">Pendapatan Bersih</p>
              <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                <span className="text-lg mr-1 font-sans font-bold text-emerald-600">Rp</span>
                <NumberFlow value={totalPendapatanBersihAllOutlets} className="text-emerald-600" />
              </h3>
            </div>
          </div>
        </div>

        {/* Total Orders Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-suka-primary/10 transition-all">
          <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="bg-orange-100 p-2 rounded-xl text-suka-orange">
                  <ShoppingBag size={20} />
                </div>
              </div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-1">Total Order Selesai</p>
              <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                <NumberFlow value={totalOrdersAllOutlets} />
                <span className="text-sm ml-2 font-sans font-bold text-suka-ink/60">order</span>
              </h3>
            </div>
          </div>
        </div>

      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-display text-xl text-suka-brown">Laporan Omzet & Penjualan Outlet</h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex bg-suka-cream rounded-xl p-1 shadow-sm border border-suka-brown/5">
              <button
                onClick={() => setViewMode('ringkasan')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                  viewMode === 'ringkasan' ? 'bg-white text-suka-brown shadow-sm' : 'text-suka-ink/60 hover:text-suka-ink'
                }`}
              >
                Ringkasan Outlet
              </button>
              <button
                onClick={() => setViewMode('item')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  viewMode === 'item' ? 'bg-white text-suka-brown shadow-sm' : 'text-suka-ink/60 hover:text-suka-ink'
                }`}
              >
                <PackageSearch size={16} />
                Penjualan per Item
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting || (viewMode === 'ringkasan' ? revenueData.length === 0 : itemsData.length === 0)}
                className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              >
                {isExporting ? <Spinner size={16} /> : <FileText size={16} />}
                PDF
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting || (viewMode === 'ringkasan' ? revenueData.length === 0 : itemsData.length === 0)}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              >
                {isExporting ? <Spinner size={16} /> : <FileSpreadsheet size={16} />}
                CSV
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'ringkasan' ? (
          loadingRevenue ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : revenueData.length === 0 ? (
            <EmptyState title="Tidak ada data penjualan" description="Belum ada transaksi terekam pada periode ini." />
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
                    <th className="py-3 px-5 font-semibold">Tanggal</th>
                    <th className="py-3 px-5 font-semibold">Nama Outlet</th>
                    <th className="py-3 px-5 font-semibold">Channel</th>
                    <th className="py-3 px-5 font-semibold text-right">Jumlah Order</th>
                    <th className="py-3 px-5 font-semibold text-right">Total Omzet</th>
                    <th className="py-3 px-5 font-semibold text-right text-red-600">Potongan</th>
                    <th className="py-3 px-5 font-semibold">Sumber Potongan</th>
                    <th className="py-3 px-5 font-semibold text-right text-emerald-700">Pendapatan Bersih</th>
                  </tr>
                </thead>
                <motion.tbody 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.05 } },
                    hidden: {},
                  }}
                  className="divide-y divide-suka-brown/5"
                >
                  {revenueData.map((item, index) => {
                    const isNewDate = index === 0 || revenueData[index - 1].date !== item.date
                    return (
                      <motion.tr 
                        variants={{
                          hidden: { opacity: 0, y: 10 },
                          visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                        }}
                        key={`${item.date}-${item.outletId}-${item.channel}`} 
                        className={`hover:bg-orange-50/20 transition-colors ${isNewDate && index !== 0 ? 'border-t-2 border-suka-brown/10' : ''}`}
                      >
                        <td className="py-4 px-5 font-bold text-suka-ink/70">
                          {isNewDate ? item.date : ''}
                        </td>
                        <td className="py-4 px-5 font-bold text-suka-ink">
                          {item.outletName}
                        </td>
                        <td className="py-4 px-5 font-medium text-suka-ink/70 uppercase text-xs">
                          {item.channel}
                        </td>
                        <td className="py-4 px-5 text-right font-medium text-suka-gray-600">
                          {item.totalOrders.toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-5 text-right font-black text-suka-brown">
                          {rupiah(item.totalRevenue)}
                        </td>
                        <td className="py-4 px-5 text-right font-medium text-red-600">
                          {item.totalPotongan > 0 ? `-${rupiah(item.totalPotongan)}` : '-'}
                        </td>
                        <td className="py-4 px-5 font-medium text-suka-ink/70 text-xs">
                          {item.potonganSource || '-'}
                        </td>
                        <td className="py-4 px-5 text-right font-black text-emerald-600 bg-emerald-50/30">
                          {rupiah(item.netRevenue)}
                        </td>
                      </motion.tr>
                    )
                  })}
                </motion.tbody>
              </table>
            </div>
          )
        ) : (
          loadingItems ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : itemsData.length === 0 ? (
            <EmptyState title="Tidak ada data item penjualan" description="Belum ada item yang terjual pada periode ini." />
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
                    <th className="py-3 px-5 font-semibold">Tanggal</th>
                    <th className="py-3 px-5 font-semibold">Nama Outlet</th>
                    <th className="py-3 px-5 font-semibold">Channel</th>
                    <th className="py-3 px-5 font-semibold">Nama Item</th>
                    <th className="py-3 px-5 font-semibold text-right">Qty Terjual</th>
                    <th className="py-3 px-5 font-semibold text-right">Total Omzet Item</th>
                  </tr>
                </thead>
                <motion.tbody 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.05 } },
                    hidden: {},
                  }}
                  className="divide-y divide-suka-brown/5"
                >
                  {itemsData.map((item, index) => {
                    const isNewDate = index === 0 || itemsData[index - 1].date !== item.date;
                    const isNewOutletForDate = isNewDate || itemsData[index - 1].outletName !== item.outletName;
                    
                    return (
                      <motion.tr 
                        variants={{
                          hidden: { opacity: 0, y: 10 },
                          visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                        }}
                        key={`${item.date}-${item.outletId}-${item.channel}-${item.itemName}`} 
                        className={`hover:bg-orange-50/20 transition-colors ${isNewDate && index !== 0 ? 'border-t-[3px] border-suka-brown/20' : isNewOutletForDate && index !== 0 ? 'border-t border-suka-brown/10' : ''}`}
                      >
                        <td className="py-3 px-5 font-bold text-suka-ink/70">
                          {isNewDate ? item.date : ''}
                        </td>
                        <td className="py-3 px-5 font-bold text-suka-ink/70">
                          {isNewOutletForDate ? item.outletName : ''}
                        </td>
                        <td className="py-3 px-5 font-medium text-suka-ink/70 uppercase text-xs">
                          {item.channel}
                        </td>
                        <td className="py-3 px-5 font-medium text-suka-ink">
                          {item.itemName}
                        </td>
                        <td className="py-3 px-5 text-right font-medium text-suka-gray-600">
                          {formatNumber(item.totalQty)}
                        </td>
                        <td className="py-3 px-5 text-right font-black text-suka-brown">
                          {rupiah(item.totalRevenue)}
                        </td>
                      </motion.tr>
                    )
                  })}
                </motion.tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}

