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

  if (loading) return <div className="text-center p-4 text-gray-500">Memuat orderan...</div>
  if (orders.length === 0) return <div className="text-center p-4 text-gray-500">Belum ada orderan.</div>

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50">
          <div>
            <div className="font-medium text-sm">
              {new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-gray-500 mt-1 uppercase">{o.order_source || 'POS'}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-sm">
              {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(o.total_amount)}
            </div>
            <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded ${
              o.status === 'completed' ? 'bg-green-100 text-green-700' :
              o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {o.status}
            </span>
          </div>
        </div>
      ))}
      <div className="text-xs text-center text-gray-400 mt-4">
        Menampilkan 15 transaksi terakhir
      </div>
    </div>
  )
}
