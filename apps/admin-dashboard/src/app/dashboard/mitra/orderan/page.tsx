'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { ShoppingBag, Search, Filter, Clock, CheckCircle2, XCircle, Loader2, Store, ExternalLink, ArrowLeft, Receipt, User } from 'lucide-react'

interface OrderItem {
  id: string
  menu_item_name: string
  quantity: number
  unit_price: number
  subtotal: number
  notes?: string | null
}

export default function OrderanPage() {
  const { selectedOutletId, selectedOutlet } = useMitraOutlet()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    totalItems: 0,
    totalTransactions: 0,
    grossRevenue: 0
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('today') 
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Split View State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderItemsCache, setOrderItemsCache] = useState<Record<string, OrderItem[]>>({})
  const [loadingItemsId, setLoadingItemsId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrders() {
      if (!selectedOutletId) return
      setLoading(true)
      const supabase = createClient()
      
      let query = supabase
        .from('orders')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false })
        
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      
      if (dateFilter !== 'all') {
        const today = new Date()
        let fromDate = new Date()
        let toDate = new Date()
        let useToDate = false
        
        if (dateFilter === 'today') {
          fromDate.setHours(0, 0, 0, 0)
        } else if (dateFilter === 'yesterday') {
          fromDate.setDate(today.getDate() - 1)
          fromDate.setHours(0, 0, 0, 0)
          toDate.setDate(today.getDate() - 1)
          toDate.setHours(23, 59, 59, 999)
          useToDate = true
        } else if (dateFilter === 'week') {
          fromDate.setDate(today.getDate() - 7)
        } else if (dateFilter === 'month') {
          fromDate.setMonth(today.getMonth() - 1)
        }
        
        query = query.gte('created_at', fromDate.toISOString())
        if (useToDate) {
          query = query.lte('created_at', toDate.toISOString())
        }
      }

      if (searchQuery.trim()) {
        query = query.or(`customer_name.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`)
      }

      if (channelFilter !== 'all') {
        if (channelFilter === 'pos') {
          query = query.or('channel.eq.POS,channel.eq.pos,channel.is.null,source.eq.POS,source.eq.pos,source.is.null')
        } else {
          query = query.or(`channel.ilike.%${channelFilter}%,source.ilike.%${channelFilter}%`)
        }
      }
      
      // Limit to 500 for better client-side pagination scope
      query = query.limit(500)
        
      const { data } = await query
      setOrders(data || [])
      setCurrentPage(1)

      let totalItems = 0
      let grossRevenue = 0
      
      if (data && data.length > 0) {
        grossRevenue = data.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0)
        
        // Ambil order_items untuk menghitung total item terjual
        const orderIds = data.map(o => o.id)
        
        // Supabase URL length limits prevent sending too many IDs in one IN clause, 
        // but 100 limit on orders is safe enough for a single query
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('quantity')
          .in('order_id', orderIds)
          
        if (itemsData) {
          totalItems = itemsData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
        }
      }

      setMetrics({
        totalTransactions: data?.length || 0,
        grossRevenue,
        totalItems
      })

      setLoading(false)
    }
    
    // Add small debounce for search
    const timer = setTimeout(() => {
      fetchOrders()
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedOutletId, statusFilter, dateFilter, channelFilter, searchQuery])

  const selectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId)
    
    // Fetch items if not cached
    if (!orderItemsCache[orderId]) {
      setLoadingItemsId(orderId)
      const supabase = createClient()
      const { data } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
      
      setOrderItemsCache(prev => ({
        ...prev,
        [orderId]: data || []
      }))
      setLoadingItemsId(null)
    }
  }

  if (!selectedOutletId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Silakan pilih outlet terlebih dahulu dari halaman Dashboard.
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'text-suka-green bg-suka-green/10'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-suka-orange bg-suka-orange/10'
    }
  }

  const selectedOrder = orders.find(o => o.id === selectedOrderId)
  const selectedItems = selectedOrder ? (orderItemsCache[selectedOrderId!] || []) : []
  const isItemsLoading = selectedOrderId === loadingItemsId

  // Pagination Logic
  const totalPages = Math.ceil(orders.length / itemsPerPage)
  const paginatedOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader 
          title="Riwayat Orderan" 
          description={`Breakdown transaksi untuk outlet ${selectedOutlet?.name || 'terpilih'}`}
        />

        {/* MAIN LIST CONTAINER */}
        <div className="max-w-4xl mx-auto space-y-6 relative">
          
          {/* LIST OF ORDERS */}
          <div className="w-full flex-shrink-0 flex flex-col gap-4">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest mb-1">Total Terjual</p>
                <h3 className="text-2xl font-bold text-suka-brown">{metrics.totalItems} <span className="text-sm font-medium text-suka-gray-500">Item</span></h3>
              </div>
              <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest mb-1">Total Transaksi</p>
                <h3 className="text-2xl font-bold text-suka-brown">{metrics.totalTransactions}</h3>
              </div>
              <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm flex flex-col items-center justify-center text-center sm:col-span-1">
                <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest mb-1">Omzet Kotor</p>
                <h3 className="text-2xl font-bold text-suka-orange">
                  {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(metrics.grossRevenue)}
                </h3>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm flex flex-col gap-3">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Cari Nama / ID Struk..."
                  className="w-full bg-white border border-suka-gray-200 text-suka-brown font-medium rounded-xl px-4 py-2.5 pl-10 focus:outline-none focus:ring-2 focus:ring-suka-orange"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-suka-gray-400">
                  <Search className="w-4 h-4" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <select 
                    className="w-full appearance-none bg-white border border-suka-gray-200 text-suka-brown text-sm font-bold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-suka-orange"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Semua Status</option>
                    <option value="completed">Selesai</option>
                    <option value="cancelled">Batal</option>
                    <option value="pending">Tertunda</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-suka-gray-400">
                    <Filter className="w-3 h-3" />
                  </div>
                </div>
                <div className="relative flex-1">
                  <select 
                    className="w-full appearance-none bg-white border border-suka-gray-200 text-suka-brown text-sm font-bold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-suka-orange"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <option value="all">Semua Waktu</option>
                    <option value="today">Hari Ini</option>
                    <option value="yesterday">Kemarin</option>
                    <option value="week">7 Hari</option>
                    <option value="month">1 Bulan</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-suka-gray-400">
                    <Clock className="w-3 h-3" />
                  </div>
                </div>
                <div className="relative flex-1">
                  <select 
                    className="w-full appearance-none bg-white border border-suka-gray-200 text-suka-brown text-sm font-bold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-suka-orange"
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                  >
                    <option value="all">Semua Channel</option>
                    <option value="pos">POS (Offline)</option>
                    <option value="grab">GrabFood</option>
                    <option value="go">GoFood</option>
                    <option value="shopee">ShopeeFood</option>
                    <option value="tiktok">Tiktok</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-suka-gray-400">
                    <Store className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Order List */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col h-[calc(100vh-280px)] lg:h-[calc(100vh-230px)]">
              <div className="p-3 border-b border-suka-gray-100 bg-white/50 text-xs font-bold text-suka-gray-400 uppercase tracking-widest text-center">
                {loading ? 'Memuat Data...' : `${orders.length} Transaksi Ditemukan`}
              </div>
              
              <div className="flex-1 flex flex-col min-h-0">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  {loading ? (
                    <div className="flex justify-center items-center h-full p-8">
                      <Loader2 className="w-6 h-6 text-suka-orange animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-full p-8 text-center text-suka-gray-400">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">Tidak ada orderan.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-suka-gray-100">
                      {paginatedOrders.map((o) => (
                        <div 
                          key={o.id} 
                          onClick={() => selectOrder(o.id)}
                          className={`p-4 cursor-pointer transition-all duration-200 group relative hover:bg-suka-gray-50`}
                        >

                          <div className="flex justify-between items-start mb-2 pl-1">
                            <div className="font-semibold text-suka-brown truncate pr-2 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${o.status === 'completed' ? 'bg-suka-green' : o.status === 'cancelled' ? 'bg-red-500' : 'bg-suka-orange'}`} />
                              {o.customer_name || 'Walk-in'}
                            </div>
                            <div className="text-[11px] font-bold text-suka-gray-400 whitespace-nowrap bg-suka-gray-100 px-2 py-0.5 rounded-full">
                              {new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center pl-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-suka-gray-400 uppercase tracking-wider">
                              <span>#{o.id.substring(0,6).toUpperCase()}</span>
                              <span>•</span>
                              <span className={o.channel?.toLowerCase().includes('grab') || o.channel?.toLowerCase().includes('go') ? 'text-suka-orange' : ''}>
                                {o.channel || o.source || 'POS'}
                              </span>
                            </div>
                            <div className="font-bold text-suka-brown">
                              {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(o.total_amount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                  <div className="p-3 border-t border-suka-gray-100 bg-white/50 flex items-center justify-between">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-suka-gray-50 text-suka-brown hover:bg-suka-gray-100 disabled:opacity-30 disabled:hover:bg-suka-gray-50 transition-colors"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest">
                      Hal {currentPage} dari {totalPages}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-suka-gray-50 text-suka-brown hover:bg-suka-gray-100 disabled:opacity-30 disabled:hover:bg-suka-gray-50 transition-colors"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
        
        {/* DRAWER OVERLAY */}
        <div 
          className={`
            fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity duration-300
            ${selectedOrderId ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `} 
          onClick={() => setSelectedOrderId(null)}
        />

        {/* DRAWER PANEL */}
        <div 
          className={`
            fixed top-0 right-0 bottom-0 z-[110] w-full max-w-md bg-white shadow-[auto_-10px_50px_rgba(0,0,0,0.2)] 
            flex flex-col overflow-hidden transition-transform duration-300 ease-in-out transform
            ${selectedOrderId ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {selectedOrder && (
            <>
                  {/* Receipt Header */}
                  <div className="bg-white px-6 py-5 border-b border-dashed border-suka-gray-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                      {/* Close Button */}
                      <button 
                        onClick={() => setSelectedOrderId(null)}
                        className="p-2 -ml-2 bg-suka-gray-50 hover:bg-suka-gray-100 transition-colors rounded-full text-suka-brown"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      
                      <div>
                        <h2 className="font-bold text-xl text-suka-brown">#{selectedOrder.id.substring(0,8).toUpperCase()}</h2>
                        <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest mt-0.5">
                          {new Date(selectedOrder.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </div>
                  </div>

                  {/* Receipt Scrollable Body */}
                  <div className="flex-1 overflow-y-auto p-6 bg-[#fcfbf9] custom-scrollbar">
                    
                    {/* Customer Info Card */}
                    <div className="bg-white p-5 rounded-2xl border border-suka-gray-100 shadow-sm mb-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-suka-orange/10 flex items-center justify-center text-suka-orange">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest">Pemesan</p>
                        <p className="font-bold text-lg text-suka-brown">{selectedOrder.customer_name || 'Walk-in Customer'}</p>
                        <p className="text-xs font-bold text-suka-orange mt-0.5">{selectedOrder.channel || selectedOrder.source || 'POS'}</p>
                      </div>
                    </div>

                    {isItemsLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 text-suka-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-suka-orange" />
                        <p className="text-xs font-bold uppercase tracking-widest">Mencetak Nota...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Order Items */}
                        <div>
                          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4" /> Daftar Pesanan
                          </h3>
                          
                          <div className="space-y-4">
                            {selectedItems.map((item) => (
                              <div key={item.id} className="flex justify-between items-start">
                                <div className="flex gap-3">
                                  <div className="font-bold text-suka-gray-400 text-sm">{item.quantity}x</div>
                                  <div>
                                    <div className="font-bold text-suka-brown">{item.menu_item_name?.split('|ID|')[0]}</div>
                                    <div className="text-xs text-suka-gray-400 font-medium">
                                      @ {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.unit_price)}
                                    </div>
                                    {item.notes && (
                                      <div className="text-[11px] text-suka-orange bg-suka-orange/5 px-2 py-1 rounded-md mt-1 inline-block">
                                        Catatan: {item.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="font-bold text-suka-brown text-right">
                                  {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.subtotal)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order Notes */}
                        {selectedOrder.notes && (
                          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100/50">
                            <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-1">Catatan Tambahan</p>
                            <p className="text-sm font-medium text-yellow-800 italic">"{selectedOrder.notes}"</p>
                          </div>
                        )}
                        
                        <hr className="border-dashed border-suka-gray-200" />

                        {/* Payment Details */}
                        <div>
                          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest mb-4">Rincian Pembayaran</h3>
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-suka-gray-500 font-medium">Subtotal Item</span>
                              <span className="font-bold text-suka-brown">
                                {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedItems.reduce((sum, i) => sum + i.subtotal, 0))}
                              </span>
                            </div>
                            
                            {selectedOrder.total_amount !== selectedItems.reduce((sum, i) => sum + i.subtotal, 0) && (
                              <div className="flex justify-between text-sm">
                                <span className="text-suka-orange font-bold">Penyesuaian (Pajak/Diskon/Ongkir)</span>
                                <span className="font-bold text-suka-orange">
                                  {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedOrder.total_amount - selectedItems.reduce((sum, i) => sum + i.subtotal, 0))}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="bg-suka-brown text-white p-5 rounded-2xl flex justify-between items-center shadow-lg shadow-suka-brown/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
                            <div>
                              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">Grand Total</p>
                              <p className="text-xs font-medium text-white/80">{selectedOrder.payment_method?.toUpperCase() || 'BELUM DIBAYAR'}</p>
                            </div>
                            <div className="font-bold text-2xl relative z-10">
                              {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedOrder.total_amount)}
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
            </>
          )}
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e5e7eb;
          border-radius: 20px;
        }
      `}} />
    </div>
  )
}
