'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Card } from '@/components/ui'
import { formatRupiah } from '@/lib/validations'
import { Loader2, ExternalLink, Search, ImageIcon, X } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { PeriodFilter } from '@/components/PeriodFilter'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'

export default function BuktiQrisPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  
  const supabase = createClient()
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
  
  const scopedOutlets = useMemo(
    () => (lockedOutletId ? outlets.filter((o) => o.id === lockedOutletId) : outlets),
    [outlets, lockedOutletId]
  )

  useEffect(() => {
    fetchProofs()
  }, [filter.from, filter.to, filter.outletId, filter.source])

  async function fetchProofs() {
    setLoading(true)
    try {
      let q = supabase
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

      if (filter.outletId !== 'all') {
        q = q.eq('outlet_id', filter.outletId)
      }

      if (filter.from) {
        const start = new Date(filter.from)
        start.setHours(0, 0, 0, 0)
        q = q.gte('created_at', start.toISOString())
      }

      if (filter.to) {
        const end = new Date(filter.to)
        end.setHours(23, 59, 59, 999)
        q = q.lte('created_at', end.toISOString())
      }

      if (filter.source && filter.source !== 'all') {
        if (filter.source === 'pos') {
          q = q.eq('sales_source', 'pos').is('channel', null)
        } else if (filter.source === 'online') {
          q = q.eq('sales_source', 'online')
        } else {
          q = q.eq('channel', filter.source)
        }
      }

      const { data, error } = await q

      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      console.error('Failed to fetch proofs:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders
    const lowerQuery = searchQuery.toLowerCase()
    return orders.filter(o => 
      o.order_number?.toLowerCase().includes(lowerQuery) ||
      o.customer_name?.toLowerCase().includes(lowerQuery)
    )
  }, [orders, searchQuery])

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Galeri Bukti QRIS" 
        description="Tinjau bukti transfer QRIS yang diunggah oleh kasir."
      >
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
          <PeriodFilter 
            value={filter} 
            onChange={setFilter} 
            outlets={scopedOutlets} 
            lockedOutletId={lockedOutletId} 
          />
        </div>
      </PageHeader>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-suka-brown/10 shadow-sm max-w-md">
        <div className="pl-3 text-suka-gray-400">
          <Search className="w-5 h-5" />
        </div>
        <input 
          type="text" 
          placeholder="Cari Nomor Pesanan / Nama Customer..."
          className="flex-1 bg-transparent border-none focus:outline-none text-sm text-suka-ink py-1 placeholder:text-suka-gray-400"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card padded={false}>
        <div className="w-full p-0">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-20 text-suka-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-suka-orange mb-3" />
              <p className="text-sm font-medium">Memuat data bukti QRIS...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-suka-gray-400">
              <div className="w-16 h-16 bg-suka-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-suka-gray-100">
                <ImageIcon className="w-8 h-8 text-suka-gray-300" />
              </div>
              <p className="font-semibold text-suka-gray-500">Belum ada bukti transfer QRIS</p>
              <p className="text-sm mt-1">Coba sesuaikan filter tanggal atau pencarian</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:gap-4 md:p-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 sm:p-5 hover:bg-suka-gray-50 md:bg-white md:border md:border-suka-gray-200 md:rounded-2xl transition-all flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-suka-ink text-base">#{order.order_number}</span>
                      </div>
                      <div className="text-sm text-suka-gray-600 mb-1">
                        <span className="font-semibold text-suka-ink">{order.customer_name || 'Tanpa Nama'}</span>
                      </div>
                      <div className="text-xs text-suka-gray-400 font-medium bg-suka-gray-100 w-max px-2 py-0.5 rounded-md">
                        {order.outlet?.name || 'Outlet Tidak Diketahui'}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-[11px] font-semibold text-suka-gray-400 uppercase tracking-wider mb-0.5">Total</div>
                      <div className="font-bold text-suka-orange">{formatRupiah(order.total_amount)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-suka-gray-100 mt-auto">
                    <div className="text-xs text-suka-gray-400">
                      {new Date(order.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta',  
                        day: 'numeric', month: 'short', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                    <button 
                      onClick={() => {
                        const url = order.payment_proof_url?.startsWith('http') 
                          ? order.payment_proof_url 
                          : supabase.storage.from('payment_proofs').getPublicUrl(order.payment_proof_url).data.publicUrl;
                        setSelectedImage(url);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors font-semibold text-xs border border-blue-100"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Lihat Foto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={selectedImage} 
              alt="Bukti QRIS" 
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
