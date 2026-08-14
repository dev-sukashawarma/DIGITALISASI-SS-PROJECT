'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useOutlets } from '@/hooks/useOutlets'
import { Spinner, EmptyState } from '@suka/design-system'
import { rupiah, formatNumber } from '@/lib/format'
import { TrendingUp, ShoppingBag, PackageSearch, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, Gift } from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { exportToExcel, exportToPDF } from '@/lib/exportUtils'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { TargetCombobox } from '@/components/TargetCombobox'

interface SalesItemRow {
  sales_date: string | null
  outlet_id: string
  sales_source: string | null
  menu_item_name: string | null
  total_qty: number | null
  total_revenue: number | null
  is_endorse: boolean | null
}

const ITEMS_PER_PAGE = 50;

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
  
  const [pageRingkasan, setPageRingkasan] = useState(1)
  const [pageItems, setPageItems] = useState(1)

  const supabase = useMemo(() => createClient(), [])
  const { data: outlets = [] } = useOutlets()

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
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
    setPageRingkasan(1)
    setPageItems(1)
  }

  const handleCustomDateChange = (isStart: boolean, val: string) => {
    setPreset('custom')
    if (isStart) setStartDate(val)
    else setEndDate(val)
    setPageRingkasan(1)
    setPageItems(1)
  }
  
  const handleOutletChange = (val: string) => {
    setSelectedOutletId(val)
    setPageRingkasan(1)
    setPageItems(1)
  }

  const handleChannelChange = (val: string) => {
    setSelectedChannel(val)
    setPageRingkasan(1)
    setPageItems(1)
  }
  
  const handleViewModeChange = (mode: 'ringkasan' | 'item') => {
    setViewMode(mode)
  }

  const { data: revenueData = [], isLoading: loadingRevenue, error: errorRevenue } = useQuery({
    queryKey: ['outlet_revenue', startDate, endDate, selectedOutletId, selectedChannel, outlets.length],
    queryFn: async () => {
      if (outlets.length === 0) return []
      const from = startDate
      const to = endDate

      const buildSalesQuery = () => {
        return supabase
          .from('orders')
          .select('outlet_id, sales_source, channel, is_endorse, total_amount, created_at, status')
          .eq('status', 'completed')
          .gte('created_at', `${from}T00:00:00.000+07:00`)
          .lte('created_at', `${to}T23:59:59.999+07:00`) as any // Type bypass
      }

      const orderRows = await fetchAllRows<any>(buildSalesQuery, 'Omzet outlet')

      const nameMap = new Map<string, string>()
      outlets.forEach(o => nameMap.set(o.id, o.name))

      const aggMap = new Map<string, { date: string; outletId: string; outletName: string; channel: string; totalRevenue: number; totalOrders: number }>()

      orderRows.forEach(s => {
        if (selectedOutletId !== 'all' && s.outlet_id !== selectedOutletId) return;
        
        const channelRaw = (s.is_endorse || s.channel === 'endorse' || s.channel === 'endors' || s.sales_source === 'endorse' || s.sales_source === 'endors') ? 'endors' : (s.sales_source || 'Offline')
        if (selectedChannel !== 'all' && channelRaw !== selectedChannel) return;

        const d = new Date(s.created_at)
        const localDate = new Date(d.getTime() + 7 * 3600 * 1000)
        const date = localDate.toISOString().split('T')[0]
        
        const outletId = s.outlet_id
        const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
        const key = `${date}-${outletId}-${channelRaw}`
        
        const existing = aggMap.get(key)
        if (existing) {
          existing.totalRevenue += Number(s.total_amount || 0)
          existing.totalOrders += 1
        } else {
          aggMap.set(key, {
            date,
            outletId,
            outletName,
            channel: channelRaw,
            totalRevenue: Number(s.total_amount || 0),
            totalOrders: 1
          })
        }
      })

      return Array.from(aggMap.values()).sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date) // Sort descending by date
        return b.totalRevenue - a.totalRevenue
      })
    },
    enabled: outlets.length > 0
  })
  
  const { data: itemsData = [], isLoading: loadingItems, error: errorItems } = useQuery({
    queryKey: ['sales_items_spv', startDate, endDate, selectedOutletId, selectedChannel, outlets.length],
    enabled: viewMode === 'item' && outlets.length > 0,
    queryFn: async () => {
      const from = startDate
      const to = endDate

      const buildItemsQuery = () => {
        return supabase
          .from('sales_items_spv')
          .select('sales_date, outlet_id, sales_source, menu_item_name, total_qty, total_revenue, is_endorse', { count: 'exact' })
          .gte('sales_date', from)
          .lte('sales_date', to)
          .order('sales_date')
          .order('outlet_id')
          .order('sales_source')
          .order('menu_item_name') as any // Type bypass
      }

      const itemRows = await fetchAllRows<SalesItemRow>(buildItemsQuery, 'Penjualan per item')

      const nameMap = new Map<string, string>()
      outlets.forEach(o => nameMap.set(o.id, o.name))

      const aggMap = new Map<string, { date: string; outletId: string; outletName: string; channel: string; itemName: string; isEndorse: boolean | null; totalQty: number; totalRevenue: number }>()

      itemRows.forEach(s => {
        if (selectedOutletId !== 'all' && s.outlet_id !== selectedOutletId) return;
        
        const channel = (s.is_endorse || s.sales_source === 'endorse' || s.sales_source === 'endors') ? 'endors' : (s.sales_source || 'Offline')
        if (selectedChannel !== 'all' && channel !== selectedChannel) return;

        const date = s.sales_date || 'Unknown Date'
        const outletId = s.outlet_id
        const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
        
        let cleanName = s.menu_item_name || 'Unknown Item'
        const idIndex = cleanName.indexOf('|ID|')
        if (idIndex !== -1) {
          cleanName = cleanName.substring(0, idIndex).trim()
        }

        const key = `${date}-${outletId}-${channel}-${cleanName}-${s.is_endorse}`
        
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
            isEndorse: s.is_endorse,
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

  const handleExport = async (format: 'pdf' | 'excel') => {
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
      
      if (format === 'excel') {
        await exportToExcel(dataToExport, viewMode, startDate, endDate, outletName, channelName)
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

  // Pagination derived state
  const totalPagesRingkasan = Math.ceil(revenueData.length / ITEMS_PER_PAGE)
  const currentRingkasanData = useMemo(() => {
    const start = (pageRingkasan - 1) * ITEMS_PER_PAGE
    return revenueData.slice(start, start + ITEMS_PER_PAGE)
  }, [revenueData, pageRingkasan])

  const totalPagesItems = Math.ceil(itemsData.length / ITEMS_PER_PAGE)
  const currentItemsData = useMemo(() => {
    const start = (pageItems - 1) * ITEMS_PER_PAGE
    return itemsData.slice(start, start + ITEMS_PER_PAGE)
  }, [itemsData, pageItems])

  if (errorRevenue || errorItems) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data omzet: {((errorRevenue || errorItems) as Error).message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter & Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Date Range Selector Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-center">
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Pilih Periode Laporan</p>
            <div className="flex flex-col gap-2">
              <select 
                value={preset} 
                onChange={handlePresetChange}
                className="w-full border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
              >
                <option value="hari_ini">Hari Ini</option>
                <option value="kemarin">Kemarin</option>
                <option value="7_hari">7 Hari Terakhir</option>
                <option value="30_hari">30 Hari Terakhir</option>
                <option value="bulan_ini">Bulan Ini</option>
                <option value="custom">Kustom...</option>
              </select>
              
              {preset === 'custom' && (
                <div className="flex flex-col gap-2 mt-1 pt-3 border-t border-suka-brown/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-suka-gray-400 uppercase w-12">Dari</span>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => handleCustomDateChange(true, e.target.value)}
                      className="flex-1 border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-suka-gray-400 uppercase w-12">Sampai</span>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => handleCustomDateChange(false, e.target.value)}
                      className="flex-1 border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-center gap-4">
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Filter Outlet</p>
            <TargetCombobox 
              value={selectedOutletId} 
              onChange={handleOutletChange}
              options={[
                { value: 'all', label: 'Semua Outlet' },
                ...outlets.map(o => ({ value: o.id, label: o.name }))
              ]}
              className="w-full"
            />
          </div>
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Filter Channel</p>
            <select 
              value={selectedChannel} 
              onChange={e => handleChannelChange(e.target.value)}
              className="w-full border border-suka-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
            >
              <option value="all">Semua Channel</option>
              <option value="offline">Offline</option>
              <option value="endors">Endorse (Kado)</option>
              <option value="gofood">GoFood</option>
              <option value="grabfood">GrabFood</option>
              <option value="shopeefood">ShopeeFood</option>
              <option value="tiktok">TikTok</option>
              <option value="tiktokgo">TikTok Go</option>
            </select>
          </div>
        </div>

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
                onClick={() => handleViewModeChange('ringkasan')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                  viewMode === 'ringkasan' ? 'bg-white text-suka-brown shadow-sm' : 'text-suka-ink/60 hover:text-suka-ink'
                }`}
              >
                Ringkasan Outlet
              </button>
              <button
                onClick={() => handleViewModeChange('item')}
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
                onClick={() => handleExport('excel')}
                disabled={isExporting || (viewMode === 'ringkasan' ? revenueData.length === 0 : itemsData.length === 0)}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              >
                {isExporting ? <Spinner size={16} /> : <FileSpreadsheet size={16} />}
                Excel
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'ringkasan' ? (
          loadingRevenue ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : currentRingkasanData.length === 0 ? (
            <EmptyState title="Tidak ada data penjualan" description="Belum ada transaksi terekam pada periode ini." />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
                      <th className="py-3 px-5 font-semibold">Tanggal</th>
                      <th className="py-3 px-5 font-semibold">Nama Outlet</th>
                      <th className="py-3 px-5 font-semibold">Channel</th>
                      <th className="py-3 px-5 font-semibold text-right">Jumlah Order</th>
                      <th className="py-3 px-5 font-semibold text-right">Total Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-brown/5">
                    {currentRingkasanData.map((item, index) => {
                      const isNewDate = index === 0 || currentRingkasanData[index - 1].date !== item.date
                      return (
                        <tr 
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
                            {item.channel === 'endors' ? (
                              <div className="flex items-center gap-1.5 text-[#d946ef] font-bold">
                                <Gift size={14} />
                                ENDORSE
                              </div>
                            ) : (
                              item.channel
                            )}
                          </td>
                          <td className="py-4 px-5 text-right font-medium text-suka-gray-600">
                            {item.totalOrders.toLocaleString('id-ID')}
                          </td>
                          <td className="py-4 px-5 text-right font-black text-suka-brown">
                            {item.channel === 'endors' ? (
                              <span className="text-[#d946ef]">{item.totalOrders} porsi</span>
                            ) : (
                              rupiah(item.totalRevenue)
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPagesRingkasan > 1 && (
                <div className="flex items-center justify-between border-t border-suka-brown/5 pt-4">
                  <div className="text-sm text-suka-gray-500 font-medium">
                    Menampilkan <span className="font-bold text-suka-brown">{(pageRingkasan - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-bold text-suka-brown">{Math.min(pageRingkasan * ITEMS_PER_PAGE, revenueData.length)}</span> dari <span className="font-bold text-suka-brown">{revenueData.length}</span> data
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPageRingkasan(p => Math.max(1, p - 1))}
                      disabled={pageRingkasan === 1}
                      className="p-1 rounded-lg border border-suka-gray-200 text-suka-brown disabled:opacity-50 disabled:cursor-not-allowed hover:bg-suka-cream transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-suka-brown px-2">{pageRingkasan} / {totalPagesRingkasan}</span>
                    <button 
                      onClick={() => setPageRingkasan(p => Math.min(totalPagesRingkasan, p + 1))}
                      disabled={pageRingkasan === totalPagesRingkasan}
                      className="p-1 rounded-lg border border-suka-gray-200 text-suka-brown disabled:opacity-50 disabled:cursor-not-allowed hover:bg-suka-cream transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          loadingItems ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : currentItemsData.length === 0 ? (
            <EmptyState title="Tidak ada data item penjualan" description="Belum ada item yang terjual pada periode ini." />
          ) : (
            <div className="flex flex-col gap-4">
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
                  <tbody className="divide-y divide-suka-brown/5">
                    {currentItemsData.map((item, index) => {
                      const isNewDate = index === 0 || currentItemsData[index - 1].date !== item.date;
                      const isNewOutletForDate = isNewDate || currentItemsData[index - 1].outletName !== item.outletName;
                      
                      return (
                        <tr 
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
                            {item.channel === 'endors' ? (
                              <div className="flex items-center gap-1.5 text-[#d946ef] font-bold">
                                <Gift size={14} />
                                ENDORSE
                              </div>
                            ) : (
                              item.channel
                            )}
                          </td>
                          <td className="py-3 px-5 font-medium text-suka-ink">
                            <div className="flex items-center gap-2">
                              {item.itemName}
                              {item.isEndorse && item.channel !== 'endors' && (
                                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200">
                                  ENDORSE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-right font-medium text-suka-gray-600">
                            {formatNumber(item.totalQty)}
                          </td>
                          <td className="py-3 px-5 text-right font-black text-suka-brown">
                            {item.channel === 'endors' ? (
                              <span className="text-[#d946ef]">{formatNumber(item.totalQty)} porsi</span>
                            ) : (
                              rupiah(item.totalRevenue)
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPagesItems > 1 && (
                <div className="flex items-center justify-between border-t border-suka-brown/5 pt-4">
                  <div className="text-sm text-suka-gray-500 font-medium">
                    Menampilkan <span className="font-bold text-suka-brown">{(pageItems - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-bold text-suka-brown">{Math.min(pageItems * ITEMS_PER_PAGE, itemsData.length)}</span> dari <span className="font-bold text-suka-brown">{itemsData.length}</span> data
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPageItems(p => Math.max(1, p - 1))}
                      disabled={pageItems === 1}
                      className="p-1 rounded-lg border border-suka-gray-200 text-suka-brown disabled:opacity-50 disabled:cursor-not-allowed hover:bg-suka-cream transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-suka-brown px-2">{pageItems} / {totalPagesItems}</span>
                    <button 
                      onClick={() => setPageItems(p => Math.min(totalPagesItems, p + 1))}
                      disabled={pageItems === totalPagesItems}
                      className="p-1 rounded-lg border border-suka-gray-200 text-suka-brown disabled:opacity-50 disabled:cursor-not-allowed hover:bg-suka-cream transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
