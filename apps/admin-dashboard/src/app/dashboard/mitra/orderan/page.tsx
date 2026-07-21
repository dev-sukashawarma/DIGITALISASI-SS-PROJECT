'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { ShoppingBag, Search, Filter } from 'lucide-react'

export default function OrderanPage() {
  const { selectedOutletId, selectedOutlet } = useMitraOutlet()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all') // 'all', 'today', 'week', 'month'

  useEffect(() => {
    async function fetchOrders() {
      if (!selectedOutletId) return
      setLoading(true)
      const supabase = createClient()
      
      let query = supabase
        .from('orders')
        .select('id, created_at, status, total_amount, order_source')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false })
        
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      
      if (dateFilter !== 'all') {
        const today = new Date()
        let fromDate = new Date()
        
        if (dateFilter === 'today') {
          fromDate.setHours(0, 0, 0, 0)
        } else if (dateFilter === 'week') {
          fromDate.setDate(today.getDate() - 7)
        } else if (dateFilter === 'month') {
          fromDate.setMonth(today.getMonth() - 1)
        }
        
        query = query.gte('created_at', fromDate.toISOString())
      }
      
      // Limit to 100 for performance
      query = query.limit(100)
        
      const { data } = await query
      setOrders(data || [])
      setLoading(false)
    }
    fetchOrders()
  }, [selectedOutletId, statusFilter, dateFilter])

  if (!selectedOutletId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Silakan pilih outlet terlebih dahulu dari halaman Dashboard.
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader 
          title="Riwayat Orderan" 
          description={`Breakdown transaksi untuk outlet ${selectedOutlet?.name || 'terpilih'}`}
        />

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-auto flex-1">
            <label className="block text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Filter Status</label>
            <div className="relative">
              <select 
                className="w-full appearance-none bg-white border border-suka-gray-200 text-suka-brown font-medium rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-suka-orange"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai (Completed)</option>
                <option value="cancelled">Dibatalkan (Cancelled)</option>
                <option value="processing">Diproses (Processing)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-suka-gray-400">
                <Filter className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          <div className="w-full sm:w-auto flex-1">
            <label className="block text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Periode Tanggal</label>
            <div className="relative">
              <select 
                className="w-full appearance-none bg-white border border-suka-gray-200 text-suka-brown font-medium rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-suka-orange"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">Semua Waktu</option>
                <option value="today">Hari Ini</option>
                <option value="week">7 Hari Terakhir</option>
                <option value="month">1 Bulan Terakhir</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-suka-gray-400">
                <Search className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Order List */}
        {loading ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5">
            <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-suka-gray-500 font-bold uppercase tracking-wider text-sm">Memuat data orderan...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-16 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
            <div className="bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ShoppingBag className="h-8 w-8 text-suka-orange" />
            </div>
            <h3 className="text-xl font-extrabold text-suka-brown mb-2">Tidak Ada Orderan</h3>
            <p className="text-suka-gray-500 font-medium text-sm">Coba ubah filter status atau tanggal Anda.</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {orders.map((o) => (
              <div key={o.id} className="flex justify-between items-center p-5 bg-white/70 backdrop-blur-md rounded-[24px] border border-white shadow-lg shadow-suka-orange/5 hover:bg-white/90 hover:scale-[1.01] transition-all duration-300">
                <div>
                  <div className="font-extrabold text-sm text-suka-brown mb-1">
                    {new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-suka-orange"></span>
                    {o.order_source || 'Point of Sales'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg text-suka-brown">
                    {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(o.total_amount)}
                  </div>
                  <span className={`inline-block mt-1 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm ${
                    o.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-suka-green text-white shadow-green-500/30' :
                    o.status === 'cancelled' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30' :
                    'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-yellow-500/30'
                  }`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
            <div className="text-xs font-bold text-center text-suka-gray-400 uppercase tracking-widest mt-6 bg-white/50 py-3 rounded-full border border-white/60">
              Menampilkan {orders.length} transaksi
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
