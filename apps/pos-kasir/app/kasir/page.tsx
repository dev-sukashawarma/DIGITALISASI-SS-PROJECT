'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  RefreshCw, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Banknote, ShoppingBag, Search, Loader2, CornerDownRight, ChefHat, Store
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import type { OrderWithItems, OrderStatus } from '@/types'

const DING_SOUND = '/sound-pesanan.mp3'

// Waktu relatif yang mudah dibaca kasir: "Baru saja", "3 menit yang lalu", dst.
function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Baru saja'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit yang lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam yang lalu`
  const day = Math.floor(hr / 24)
  return `${day} hari yang lalu`
}

export default function CashierOrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpand] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())
  
  // Audio state
  const [audioPermission, setAudioPermission] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previousOrderCountRef = useRef<number>(0)

  const supabase = createClient()
  const { outletId, outletName, loaded: outletLoaded } = useMyOutlet()

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(DING_SOUND)
    audioRef.current.volume = 1.0
  }, [])

  // Unlock audio otomatis pada interaksi pertama user (tanpa perlu toast)
  useEffect(() => {
    const unlock = () => {
      const a = audioRef.current
      if (a) {
        // Priming dalam konteks gesture user agar browser mengizinkan autoplay berikutnya
        a.play().then(() => { a.pause(); a.currentTime = 0 }).catch(() => {})
      }
      setAudioPermission(true)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Tick setiap detik agar label waktu relatif selalu sinkron
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const playNotification = useCallback(async () => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        await audioRef.current.play()
      }
    } catch (err) {
      console.warn('Audio blocked', err)
      setAudioPermission(false)
    }
  }, [])

  // Fetch data
  const fetchOrders = useCallback(async () => {
    if (!outletId) return // hanya tampilkan pesanan cabang kasir ini

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('outlet_id', outletId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (data) {
      setOrders(data)
      setLoading(false)

      // Check if there's a NEW pending order
      const currentPendingCount = data.filter(o => o.status === 'pending').length
      if (currentPendingCount > previousOrderCountRef.current && audioPermission) {
        playNotification()
      }
      previousOrderCountRef.current = currentPendingCount
    }
  }, [supabase, playNotification, audioPermission, outletId])

  // Jika kasir tidak terhubung ke outlet mana pun, jangan biarkan loading menggantung
  useEffect(() => {
    if (outletLoaded && !outletId) setLoading(false)
  }, [outletLoaded, outletId])

  // Short polling fallback + initial fetch
  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 3000)

    const channel = supabase
      .channel('orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [fetchOrders, supabase])

  // Mark as Preparing
  async function markAsPreparing(id: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'preparing' } : o))
    await supabase.from('orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', id)
    fetchOrders()
  }

  // Mark as Completed
  async function markAsCompleted(id: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'completed' } : o))
    await supabase.from('orders').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id)
    fetchOrders()
  }

  // Cancel order
  async function cancelOrder(id: string) {
    if (confirm('Batalkan pesanan ini secara permanen?')) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id)
      fetchOrders()
    }
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const preparingOrders = orders.filter((o) => o.status === 'preparing').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  
  const completedOrders = orders.filter((o) => o.status === 'completed')
  const filteredCompletedOrders = completedOrders.filter(o => {
    if (!searchQuery) return true
    return o.order_number.toString().includes(searchQuery)
  })

  const todayRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0)

  // Helper untuk merender card pesanan aktif (Pending & Preparing)
  const renderActiveCard = (order: OrderWithItems, type: 'pending' | 'preparing') => {
    const expanded = expandedId === order.id
    const isPreparing = type === 'preparing'
    
    // Helper to parse and group items
    const getGroupedItems = (orderItems: any[]) => {
      const parsed = orderItems.map(oi => {
        let name = oi.menu_item_name
        let note = ''
        let id = oi.id
        let parentId = null
        
        const noteSplit = name.split('|NOTE|')
        if (noteSplit.length > 1) { note = noteSplit[1]; name = noteSplit[0] }
        
        const parentSplit = name.split('|PARENT|')
        if (parentSplit.length > 1) { parentId = parentSplit[1]; name = parentSplit[0] }
        
        const idSplit = name.split('|ID|')
        if (idSplit.length > 1) { id = idSplit[1]; name = idSplit[0] }
        
        return { ...oi, parsedName: name, parsedNote: note, parsedId: id, parsedParentId: parentId }
      })
      
      const rootItems = parsed.filter(i => !i.parsedParentId)
      // fallback if a child's parent doesn't exist
      const validRootIds = new Set(rootItems.map(r => r.parsedId))
      
      const childrenMap: any = {}
      parsed.filter(i => i.parsedParentId).forEach(i => {
        if (!validRootIds.has(i.parsedParentId!)) {
          rootItems.push(i) // treat as root
        } else {
          if (!childrenMap[i.parsedParentId!]) childrenMap[i.parsedParentId!] = []
          childrenMap[i.parsedParentId!].push(i)
        }
      })
      
      return { rootItems, childrenMap }
    }

    return (
      <div key={order.id} className={`card overflow-hidden border-2 shadow-soft animate-fade-in ${isPreparing ? 'border-blue-200' : 'border-amber-100'}`}>
        {/* Header Row */}
        <div 
          className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${isPreparing ? 'hover:bg-blue-50/30' : 'hover:bg-amber-50/30'}`}
          onClick={() => setExpand(expanded ? null : order.id)}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-md flex-shrink-0 ${isPreparing ? 'bg-blue-500 shadow-blue-200' : 'bg-amber-500 shadow-amber-200'}`}>
              <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider leading-none mb-0.5">Antrian</span>
              <span className="font-bold text-white text-xl leading-none">#{order.order_number}</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 flex items-center gap-2">
                {formatRupiah(order.total_amount)}
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase">
                  {order.payment_method}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <span className={`font-semibold ${isPreparing ? 'text-blue-600' : 'text-amber-600'}`}>{timeAgo(order.created_at, now)}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{getGroupedItems(order.order_items).rootItems.length} pesanan utama
              </p>
            </div>
          </div>
          <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* Action Row */}
        <div className="px-5 pb-4 pt-1 flex gap-2">
          {type === 'pending' && order.payment_method === 'qris' ? (
            <div className="flex-1 bg-blue-50/70 text-blue-600 font-bold py-3.5 rounded-xl border border-blue-100 flex items-center justify-center gap-2 cursor-wait">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Menunggu QRIS Otomatis...</span>
            </div>
          ) : type === 'pending' ? (
            <button 
              onClick={(e) => { e.stopPropagation(); markAsPreparing(order.id) }}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl shadow-sm shadow-amber-200 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              Terima & Proses
            </button>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); markAsCompleted(order.id) }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              Tandai Selesai
            </button>
          )}
        </div>

        {/* Expanded Detail */}
        {expanded && (
          <div className={`border-t px-5 py-4 space-y-3 ${isPreparing ? 'border-blue-100/50 bg-blue-50/20' : 'border-amber-100/50 bg-amber-50/20'}`}>
            <div className="space-y-1.5">
              {(() => {
                const { rootItems, childrenMap } = getGroupedItems(order.order_items)
                return rootItems.map((oi) => (
                  <div key={oi.id} className="py-2 relative">
                    {/* Vertical line connecting to children/notes */}
                    {(oi.parsedNote || (childrenMap[oi.parsedId] && childrenMap[oi.parsedId].length > 0)) && (
                      <div className="absolute left-[9px] top-6 bottom-4 w-[2px] bg-gray-200" />
                    )}

                    {/* Parent Row */}
                    <div className="flex justify-between text-sm items-start gap-2">
                      <div className="text-gray-700 flex items-start gap-2.5 min-w-0 flex-1">
                        <span className={`w-5 h-5 text-[10px] font-bold rounded-md flex items-center justify-center flex-shrink-0 relative z-10 ${isPreparing ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {oi.quantity}
                        </span>
                        <span className="leading-snug font-semibold break-words min-w-0 flex-1">{oi.parsedName}</span>
                      </div>
                      <span className="font-semibold text-gray-900 flex-shrink-0">{formatRupiah(oi.subtotal)}</span>
                    </div>

                    {/* Parent Note */}
                    {oi.parsedNote && (
                      <div className="relative pl-[1.6rem] mt-1.5 mb-1.5 flex items-start">
                        <div className="absolute left-[9px] top-2.5 w-3 h-[2px] bg-gray-200" />
                        <div className={`text-[11px] px-2 py-1 rounded-md font-semibold leading-snug border break-words whitespace-pre-wrap min-w-0 flex-1 ${isPreparing ? 'bg-blue-50/80 border-blue-100 text-blue-800' : 'bg-amber-50/80 border-amber-100 text-amber-800'}`}>
                          {oi.parsedNote}
                        </div>
                      </div>
                    )}

                    {/* Children / Extras */}
                    {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                      <div key={child.id} className="relative pl-[1.6rem] py-1 flex justify-between text-sm items-start gap-2">
                        <div className="absolute left-[9px] top-3 w-3 h-[2px] bg-gray-200" />
                        <div className="text-gray-600 flex items-start gap-2 min-w-0 flex-1">
                          <span className="w-4 text-[10px] font-bold text-center mt-0.5 shrink-0">{child.quantity}x</span>
                          <div className="min-w-0 flex-1">
                            <div className="leading-snug font-medium flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-bold uppercase px-1 rounded-sm ${isPreparing ? 'bg-blue-200 text-blue-700' : 'bg-amber-200 text-amber-800'}`}>Extra</span>
                              <span className="break-words min-w-0">{child.parsedName}</span>
                            </div>
                            {child.parsedNote && (
                              <div className="mt-1 flex items-start">
                                <div className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold leading-snug border break-words whitespace-pre-wrap min-w-0 flex-1 relative ${isPreparing ? 'bg-blue-50/80 border-blue-100 text-blue-800' : 'bg-amber-50/80 border-amber-100 text-amber-800'}`}>
                                  {child.parsedNote}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="font-medium text-gray-500 flex-shrink-0 text-[13px]">{formatRupiah(child.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>

            {order.notes && (
              <div className={`rounded-xl p-3 text-sm border break-words whitespace-pre-wrap ${isPreparing ? 'bg-blue-100/50 border-blue-200/50 text-blue-800' : 'bg-amber-100/50 border-amber-200/50 text-amber-800'}`}>
                <span className="font-bold">Catatan: </span>{order.notes}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button 
                onClick={(e) => { e.stopPropagation(); cancelOrder(order.id) }}
                className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Batalkan
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 relative min-h-screen">

      {/* ── Header & Stats ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Order</h1>
          {outletName && (
            <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg w-max border border-gray-200">
              <Store className="w-4 h-4 text-amber-500" />
              Anda berada di cabang: <span className="font-bold text-gray-700">{outletName}</span>
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="bg-amber-50 border border-amber-100 px-5 py-3 rounded-2xl flex-1 sm:flex-none flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-widest leading-none">Pendapatan Lunas</p>
              <p className="text-xl font-bold text-amber-700 mt-1 leading-none">{formatRupiah(todayRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pb-20">
        
        {/* ── Column: PESANAN AKTIF ── */}
        <div className="space-y-6">
          
          {/* Section: Preparing (Sedang Diproses) */}
          {preparingOrders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-blue-100 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-blue-500" />
                  <h2 className="font-bold text-gray-900 text-lg">Sedang Diproses</h2>
                </div>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                  {preparingOrders.length} Pesanan
                </span>
              </div>

              <div className="space-y-3">
                {preparingOrders.map((order) => renderActiveCard(order, 'preparing'))}
              </div>
            </div>
          )}

          {/* Section: Pending (Menunggu Pembayaran) */}
          <div className="space-y-4">
            <div className={`flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-gray-100 shadow-sm sticky ${preparingOrders.length > 0 ? 'top-[72px]' : 'top-0'} z-10`}>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-gray-900 text-lg">Menunggu Pembayaran</h2>
              </div>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                {pendingOrders.length} Pesanan
              </span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="card h-32 animate-pulse bg-gray-50" />
              ) : pendingOrders.length === 0 && preparingOrders.length === 0 ? (
                <div className="card p-12 flex flex-col items-center text-center border-dashed border-2 border-gray-200 bg-transparent shadow-none">
                  <ShoppingBag className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1.5} />
                  <p className="font-bold text-gray-400">Tidak ada pesanan tertunda</p>
                  <p className="text-xs text-gray-400 mt-1">Pesanan baru akan muncul otomatis di sini.</p>
                </div>
              ) : pendingOrders.length === 0 && preparingOrders.length > 0 ? (
                null // Jika tidak ada pending tapi ada preparing, tidak perlu pesan kosong di bawahnya
              ) : (
                pendingOrders.map((order) => renderActiveCard(order, 'pending'))
              )}
            </div>
          </div>

        </div>

        {/* ── Column: COMPLETED (Selesai Hari Ini) ── */}
        <div className="space-y-4">
          <div className="bg-white px-5 py-3.5 rounded-2xl border border-gray-100 shadow-sm sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 opacity-95">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-gray-900 text-lg">Selesai / Lunas</h2>
              </div>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-colors text-sm"
                placeholder="Cari antrian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {completedOrders.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Belum ada pesanan selesai hari ini</p>
            ) : filteredCompletedOrders.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Nomor antrian tidak ditemukan</p>
            ) : (
              filteredCompletedOrders.slice(0, 15).map((order) => (
                <div key={order.id} className="card p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
                  
                  {/* Header Row */}
                  <div className="flex items-start justify-between border-b border-dashed border-gray-100 pb-3 mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex flex-col items-center justify-center border border-emerald-100 shadow-sm flex-shrink-0">
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider leading-none mb-0.5">Antrian</span>
                        <span className="font-bold text-emerald-700 text-xl leading-none">#{order.order_number}</span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{formatRupiah(order.total_amount)}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-emerald-600">{timeAgo(order.created_at, now)}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span className="uppercase font-bold text-[9px] tracking-wider bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                            {order.payment_method}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Order Items (Readable by laypeople) */}
                  <div className="space-y-1.5">
                    {(() => {
                      const parsed = order.order_items.map(oi => {
                        let name = oi.menu_item_name
                        let note = ''
                        let id = oi.id
                        let parentId = null
                        
                        const noteSplit = name.split('|NOTE|')
                        if (noteSplit.length > 1) { note = noteSplit[1]; name = noteSplit[0] }
                        
                        const parentSplit = name.split('|PARENT|')
                        if (parentSplit.length > 1) { parentId = parentSplit[1]; name = parentSplit[0] }
                        
                        const idSplit = name.split('|ID|')
                        if (idSplit.length > 1) { id = idSplit[1]; name = idSplit[0] }
                        
                        return { ...oi, parsedName: name, parsedNote: note, parsedId: id, parsedParentId: parentId }
                      })
                      
                      const rootItems = parsed.filter(i => !i.parsedParentId)
                      const validRootIds = new Set(rootItems.map(r => r.parsedId))
                      
                      const childrenMap: any = {}
                      parsed.filter(i => i.parsedParentId).forEach(i => {
                        if (!validRootIds.has(i.parsedParentId!)) {
                          rootItems.push(i)
                        } else {
                          if (!childrenMap[i.parsedParentId!]) childrenMap[i.parsedParentId!] = []
                          childrenMap[i.parsedParentId!].push(i)
                        }
                      })

                      return rootItems.map((oi) => (
                        <div key={oi.id} className="py-2 relative">
                          {/* Vertical Line */}
                          {(oi.parsedNote || (childrenMap[oi.parsedId] && childrenMap[oi.parsedId].length > 0)) && (
                            <div className="absolute left-[11px] top-6 bottom-4 w-[2px] bg-gray-200" />
                          )}

                          {/* Parent Row */}
                          <div className="flex items-start gap-2 relative z-10">
                            <span className="font-bold text-gray-900 text-sm w-6 shrink-0 text-center bg-white">{oi.quantity}x</span>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold text-gray-800 leading-snug break-words">{oi.parsedName}</span>
                            </div>
                          </div>

                          {/* Parent Note */}
                          {oi.parsedNote && (
                            <div className="relative pl-[1.6rem] mt-1.5 mb-1.5 flex items-start">
                              <div className="absolute left-[11px] top-2.5 w-3 h-[2px] bg-gray-200" />
                              <div className="bg-amber-50/80 border border-amber-100 text-amber-800 text-[11px] px-2 py-1 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1">
                                {oi.parsedNote}
                              </div>
                            </div>
                          )}

                          {/* Children / Extras */}
                          {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                            <div key={child.id} className="relative pl-[1.6rem] py-1 flex items-start gap-2">
                              <div className="absolute left-[11px] top-3 w-3 h-[2px] bg-gray-200" />
                              <span className="font-bold text-gray-600 text-xs w-5 shrink-0 text-right mt-0.5">{child.quantity}x</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-gray-600 leading-snug flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[8px] font-bold uppercase bg-gray-200 text-gray-500 px-1 rounded-sm">Extra</span>
                                  <span className="break-words min-w-0">{child.parsedName}</span>
                                </div>
                                {child.parsedNote && (
                                  <div className="relative mt-1 flex items-start">
                                    <div className="bg-amber-50/80 border border-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1">
                                      {child.parsedNote}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>

                  {/* Notes */}
                  {order.notes && (
                    <div className="mt-3 bg-amber-50 rounded-lg p-2.5 text-xs text-amber-800 font-medium border border-amber-100 break-words whitespace-pre-wrap">
                      <span className="font-bold">Catatan:</span> {order.notes}
                    </div>
                  )}
                </div>
              ))
            )}
            
            {filteredCompletedOrders.length > 15 && (
              <p className="text-center text-xs font-medium text-gray-400 py-2">
                Menampilkan 15 pesanan terakhir (+{filteredCompletedOrders.length - 15} lainnya)
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
