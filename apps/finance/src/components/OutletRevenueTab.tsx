'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useOutlets } from '@/hooks/useOutlets'
import { Spinner, EmptyState } from '@suka/design-system'
import { rupiah, formatNumber } from '@/lib/format'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, ShoppingBag, PackageSearch } from 'lucide-react'
import NumberFlow from '@number-flow/react'

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
    } else if (val === '1_bulan') {
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

  const handleCustomDateChange = (isStart: boolean, val: string) => {
    setPreset('custom')
    if (isStart) setStartDate(val)
    else setEndDate(val)
  }

  const { data: revenueData = [], isLoading: loadingRevenue, error: errorRevenue } = useQuery({
    queryKey: ['outlet_revenue', startDate, endDate, selectedOutletId, selectedChannel],
    queryFn: async () => {
      const from = startDate
      const to = endDate

      let q = supabase
        .from('sales_hourly_spv')
        .select('outlet_id, sales_source, omzet, jumlah_order_completed')
        .gte('sales_date', from)
        .lte('sales_date', to)
      
      if (selectedOutletId !== 'all') {
        q = q.eq('outlet_id', selectedOutletId)
      }
      
      if (selectedChannel !== 'all') {
        q = q.eq('sales_source', selectedChannel)
      }

      const [salesRes, outletsRes] = await Promise.all([
        q,
        supabase
          .from('outlets')
          .select('id, name')
      ])

      if (salesRes.error) throw salesRes.error
      if (outletsRes.error) throw outletsRes.error

      const nameMap = new Map<string, string>()
      outletsRes.data?.forEach(o => nameMap.set(o.id, o.name))

      const aggMap = new Map<string, { outletId: string; outletName: string; channel: string; totalRevenue: number; totalOrders: number }>()

      salesRes.data?.forEach(s => {
        const outletId = s.outlet_id
        const channel = s.sales_source || 'Offline'
        const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
        const key = `${outletId}-${channel}`
        
        const existing = aggMap.get(key)
        if (existing) {
          existing.totalRevenue += Number(s.omzet || 0)
          existing.totalOrders += Number(s.jumlah_order_completed || 0)
        } else {
          aggMap.set(key, {
            outletId,
            outletName,
            channel,
            totalRevenue: Number(s.omzet || 0),
            totalOrders: Number(s.jumlah_order_completed || 0)
          })
        }
      })

      // Tampilkan juga semua outlet terdaftar meskipun 0 omzet (jika filter "Semua Outlet")
      if (selectedOutletId === 'all') {
        outletsRes.data?.forEach(o => {
          if (!Array.from(aggMap.values()).some(a => a.outletId === o.id)) {
            aggMap.set(`${o.id}-offline`, {
              outletId: o.id,
              outletName: o.name,
              channel: 'Offline',
              totalRevenue: 0,
              totalOrders: 0
            })
          }
        })
      } else {
        // Jika filter ke satu outlet dan tidak ada transaksi
        if (aggMap.size === 0) {
          const outletName = nameMap.get(selectedOutletId) || 'Outlet'
          aggMap.set(`${selectedOutletId}-offline`, {
            outletId: selectedOutletId,
            outletName: outletName,
            channel: 'Offline',
            totalRevenue: 0,
            totalOrders: 0
          })
        }
      }

      return Array.from(aggMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)
    }
  })
  
  const { data: itemsData = [], isLoading: loadingItems, error: errorItems } = useQuery({
    queryKey: ['sales_items_spv', startDate, endDate, selectedOutletId, selectedChannel],
    queryFn: async () => {
      const from = startDate
      const to = endDate

      let q = supabase
        .from('sales_items_spv')
        .select('outlet_id, sales_source, menu_item_name, total_qty, total_revenue')
        .gte('sales_date', from)
        .lte('sales_date', to)

      if (selectedOutletId !== 'all') {
        q = q.eq('outlet_id', selectedOutletId)
      }

      if (selectedChannel !== 'all') {
        q = q.eq('sales_source', selectedChannel)
      }

      const [itemsRes, outletsRes] = await Promise.all([
        q,
        supabase
          .from('outlets')
          .select('id, name')
      ])

      if (itemsRes.error) throw itemsRes.error
      if (outletsRes.error) throw outletsRes.error

      const nameMap = new Map<string, string>()
      outletsRes.data?.forEach(o => nameMap.set(o.id, o.name))
      
      const aggMap = new Map<string, { outletId: string; outletName: string; channel: string; itemName: string; totalQty: number; totalRevenue: number }>()

      itemsRes.data?.forEach(s => {
        const outletId = s.outlet_id
        const channel = s.sales_source || 'Offline'
        const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
        
        // Bersihkan nama item (hapus |ID|... dan variannya)
        let cleanName = s.menu_item_name || 'Unknown Item'
        const idIndex = cleanName.indexOf('|ID|')
        if (idIndex !== -1) {
          cleanName = cleanName.substring(0, idIndex).trim()
        }

        const key = `${outletId}-${channel}-${cleanName}`
        
        const existing = aggMap.get(key)
        if (existing) {
          existing.totalQty += Number(s.total_qty || 0)
          existing.totalRevenue += Number(s.total_revenue || 0)
        } else {
          aggMap.set(key, {
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
        if (a.outletName === b.outletName) {
           return b.totalQty - a.totalQty
        }
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
                <option value="1_bulan">1 Bulan Terakhir</option>
                <option value="bulan_ini">Bulan Ini</option>
                <option value="custom">Kustom...</option>
              </select>
              
              {preset === 'custom' && (
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => handleCustomDateChange(true, e.target.value)}
                    className="w-full border border-suka-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                  />
                  <span className="flex items-center text-suka-gray-400 font-bold">-</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => handleCustomDateChange(false, e.target.value)}
                    className="w-full border border-suka-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-center gap-4">
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Filter Outlet</p>
            <select 
              value={selectedOutletId} 
              onChange={e => setSelectedOutletId(e.target.value)}
              className="w-full border border-suka-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
            >
              <option value="all">Semua Outlet</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Filter Channel</p>
            <select 
              value={selectedChannel} 
              onChange={e => setSelectedChannel(e.target.value)}
              className="w-full border border-suka-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
            >
              <option value="all">Semua Channel</option>
              <option value="offline">Offline</option>
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
          
          <div className="flex bg-suka-cream rounded-xl p-1 shadow-sm border border-suka-brown/5 self-start">
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
        </div>

        {viewMode === 'ringkasan' ? (
          loadingRevenue ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : revenueData.length === 0 ? (
            <EmptyState title="Tidak ada data penjualan" description="Belum ada transaksi terekam pada periode ini." />
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
                    <th className="py-3 px-5 font-semibold">Nama Outlet</th>
                    <th className="py-3 px-5 font-semibold">Channel</th>
                    <th className="py-3 px-5 font-semibold text-right">Jumlah Order</th>
                    <th className="py-3 px-5 font-semibold text-right">Total Omzet</th>
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
                  {revenueData.map((item) => (
                    <motion.tr 
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                      }}
                      key={`${item.outletId}-${item.channel}`} 
                      className="hover:bg-orange-50/20 transition-colors"
                    >
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
                    </motion.tr>
                  ))}
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
              <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
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
                    const isNewOutlet = index === 0 || itemsData[index - 1].outletName !== item.outletName;
                    return (
                      <motion.tr 
                        variants={{
                          hidden: { opacity: 0, y: 10 },
                          visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                        }}
                        key={`${item.outletId}-${item.channel}-${item.itemName}`} 
                        className={`hover:bg-orange-50/20 transition-colors ${isNewOutlet ? 'border-t-2 border-suka-brown/10' : ''}`}
                      >
                        <td className="py-3 px-5 font-bold text-suka-ink/70">
                          {isNewOutlet ? item.outletName : ''}
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
