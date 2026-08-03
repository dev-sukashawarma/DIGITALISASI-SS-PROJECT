'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { Spinner, EmptyState } from '@suka/design-system'
import { rupiah } from '@/lib/format'
import { motion } from 'framer-motion'
import { TrendingUp, ShoppingBag } from 'lucide-react'
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
  const supabase = useMemo(() => createClient(), [])

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

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['outlet_revenue', startDate, endDate],
    queryFn: async () => {
      const from = startDate
      const to = endDate

      const [salesRes, outletsRes] = await Promise.all([
        supabase
          .from('sales_hourly_spv')
          .select('outlet_id, omzet, jumlah_order_completed')
          .gte('sales_date', from)
          .lte('sales_date', to),
        supabase
          .from('outlets')
          .select('id, name')
      ])

      if (salesRes.error) throw salesRes.error
      if (outletsRes.error) throw outletsRes.error

      const nameMap = new Map<string, string>()
      outletsRes.data?.forEach(o => nameMap.set(o.id, o.name))

      const aggMap = new Map<string, { outletId: string; outletName: string; totalRevenue: number; totalOrders: number }>()

      salesRes.data?.forEach(s => {
        const outletId = s.outlet_id
        const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
        const existing = aggMap.get(outletId)
        if (existing) {
          existing.totalRevenue += Number(s.omzet || 0)
          existing.totalOrders += Number(s.jumlah_order_completed || 0)
        } else {
          aggMap.set(outletId, {
            outletId,
            outletName,
            totalRevenue: Number(s.omzet || 0),
            totalOrders: Number(s.jumlah_order_completed || 0)
          })
        }
      })

      // Tampilkan juga semua outlet terdaftar meskipun 0 omzet
      outletsRes.data?.forEach(o => {
        if (!aggMap.has(o.id)) {
          aggMap.set(o.id, {
            outletId: o.id,
            outletName: o.name,
            totalRevenue: 0,
            totalOrders: 0
          })
        }
      })

      return Array.from(aggMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)
    }
  })

  const totalOmzetAllOutlets = useMemo(() => {
    return data.reduce((sum, item) => sum + item.totalRevenue, 0)
  }, [data])

  const totalOrdersAllOutlets = useMemo(() => {
    return data.reduce((sum, item) => sum + item.totalOrders, 0)
  }, [data])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data omzet: {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter & Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
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
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl text-suka-brown">Laporan Omzet Penjualan Outlet</h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : data.length === 0 ? (
          <EmptyState title="Tidak ada data penjualan" description="Belum ada transaksi terekam pada periode ini." />
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
                  <th className="py-3 px-5 font-semibold">Nama Outlet</th>
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
                {data.map((item) => (
                  <motion.tr 
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    key={item.outletId} 
                    className="hover:bg-orange-50/20 transition-colors"
                  >
                    <td className="py-4 px-5 font-bold text-suka-ink">
                      {item.outletName}
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
        )}
      </div>
    </div>
  )
}
