'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatRupiah } from '@/lib/validations'
import { Loader2, ExternalLink, CheckCircle } from 'lucide-react'

export default function BuktiQrisPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchProofs()
  }, [])

  async function fetchProofs() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          total_amount,
          created_at,
          payment_proof_url,
          status,
          outlet:outlet_id (
            name
          )
        `)
        .eq('payment_method', 'qris')
        .not('payment_proof_url', 'is', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      console.error('Failed to fetch proofs:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-suka-ink">Bukti QRIS</h1>
        <p className="text-sm text-suka-gray-500">
          Tinjau bukti transfer QRIS yang diunggah oleh kasir.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-suka-orange" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 text-suka-gray-500">
              Belum ada bukti transfer QRIS.
            </div>
          ) : (
            <div className="divide-y divide-suka-gray-100">
              {orders.map((order) => (
                <div key={order.id} className="p-4 sm:p-6 hover:bg-suka-gray-50 transition-colors flex flex-col sm:flex-row gap-4 items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-suka-ink">#{order.order_number}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">QRIS</span>
                    </div>
                    <div className="text-sm text-suka-gray-600 mb-2">
                      <span className="font-medium text-suka-ink">{order.customer_name}</span> • {order.outlet?.name || 'Outlet Tidak Diketahui'}
                    </div>
                    <div className="text-xs text-suka-gray-400">
                      {new Date(order.created_at).toLocaleString('id-ID')}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <div className="text-sm text-suka-gray-500 mb-1">Total</div>
                      <div className="font-bold text-suka-orange text-lg">{formatRupiah(order.total_amount)}</div>
                    </div>
                    <a 
                      href={supabase.storage.from('payment_proofs').getPublicUrl(order.payment_proof_url).data.publicUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-center w-12 h-12 rounded-xl bg-suka-gray-100 hover:bg-suka-orange hover:text-white transition-colors text-suka-gray-600 border border-suka-gray-200"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
