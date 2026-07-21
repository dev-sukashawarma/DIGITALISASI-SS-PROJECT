'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export function TabOrderan({ outletId }: { outletId: string }) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      if (!outletId) return
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('id, created_at, status, total_amount, order_source')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false })
        .limit(15)
        
      setOrders(data || [])
      setLoading(false)
    }
    fetchOrders()
  }, [outletId])

  if (loading) return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5">
      <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-suka-gray-500 font-bold uppercase tracking-wider text-sm">Memuat data orderan...</p>
    </div>
  )

  if (orders.length === 0) return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-16 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
      <div className="bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-suka-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h3 className="text-xl font-extrabold text-suka-brown mb-2">Belum Ada Orderan</h3>
      <p className="text-suka-gray-500 font-medium text-sm">Transaksi penjualan untuk outlet ini akan muncul di sini.</p>
    </div>
  )

  return (
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
        Menampilkan 15 transaksi terakhir
      </div>
    </div>
  )
}
