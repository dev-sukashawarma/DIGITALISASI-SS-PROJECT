'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  RefreshCw, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Banknote, ShoppingBag, Search, Loader2, CornerDownRight, ChefHat, Store, Globe, PlusCircle, BellRing
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import ChannelBadge from '@/components/ChannelBadge'
import StockWidget from '@/components/StockWidget'
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

async function fetchTodayOrders(outletId: string): Promise<OrderWithItems[]> {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  return data ?? []
}

export default function CashierOrdersPage() {
  const [expandedId, setExpand] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [now, setNow] = useState(() => Date.now())

  // Audio state
  const [audioPermission, setAudioPermission] = useState(true)

  // Ref untuk mendeteksi order baru secara akurat (berdasarkan ID, bukan cuma jumlah)
  const knownOrderIds = useRef<Set<string>>(new Set())
  const hasFetchedInitial = useRef<boolean>(false)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const { outletId, outletName } = useMyOutlet()

  const { data: orders = [], isLoading: loading, isFetched: ordersFetched } = useQuery({
    queryKey: ['orders', outletId],
    queryFn: () => fetchTodayOrders(outletId as string),
    enabled: !!outletId,
    refetchInterval: 3000,
    staleTime: 3000,
    retry: false,
  })

  // Unlock audio otomatis
  useEffect(() => {
    const unlock = () => {
      const a = document.getElementById('ding-sound') as HTMLAudioElement
      if (a) {
        a.play().then(() => {
          a.pause()
          a.currentTime = 0
          setAudioPermission(true)
          window.removeEventListener('click', unlock, true)
        }).catch(() => {
          setAudioPermission(false)
        })
      }
    }
    // Gunakan click dengan capture phase agar dieksekusi lebih awal dan konsisten di semua browser
    window.addEventListener('click', unlock, true)
    return () => {
      window.removeEventListener('click', unlock, true)
    }
  }, [])

  // Tick setiap detik agar label waktu relatif selalu sinkron
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const playNotification = useCallback(async () => {
    try {
      const a = document.getElementById('ding-sound') as HTMLAudioElement
      if (a) {
        a.currentTime = 0
        await a.play()
        setAudioPermission(true)
      }
    } catch (err) {
      console.warn('Audio blocked', err)
      setAudioPermission(false)
    }
  }, [])

  // Deteksi order baru dari data query terbaru (dipanggil tiap kali `orders` berubah,
  // baik dari polling 3s maupun dari invalidate realtime di bawah).
  useEffect(() => {
    if (!ordersFetched) return // belum pernah fetch sungguhan (outletId masih null / query disabled)

    if (!hasFetchedInitial.current) {
      // Fetch pertama yang sungguhan terjadi: catat semua ID tanpa membunyikan notifikasi
      orders.forEach(o => knownOrderIds.current.add(o.id))
      hasFetchedInitial.current = true
      return
    }

    let hasNewPendingOrder = false
    orders.filter(o => o.status === 'pending' || o.status === 'preparing').forEach(o => {
      if (!knownOrderIds.current.has(o.id)) {
        hasNewPendingOrder = true
        knownOrderIds.current.add(o.id)
      }
    })

    if (hasNewPendingOrder) playNotification()
  }, [orders, ordersFetched, playNotification])

  // Realtime: invalidate cache instan saat ada perubahan order, jangan tunggu polling 3s
  useEffect(() => {
    if (!outletId) return
    const channel = supabase
      .channel('orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, outletId])

  // Mark as Preparing
  async function markAsPreparing(id: string) {
    queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
      prev?.map(o => o.id === id ? { ...o, status: 'preparing' } : o)
    )
    await supabase.from('orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
  }

  // Mark as Completed
  async function markAsCompleted(id: string) {
    queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
      prev?.map(o => o.id === id ? { ...o, status: 'completed' } : o)
    )
    await supabase.from('orders').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })

    // Kalau order ini berasal dari website order online, teruskan notifikasi
    // ke order-system supaya WA "pesanan siap diambil" terkirim ke customer.
    fetch('/api/orders/notify-online-done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: id }),
    }).catch((err) => console.error('Gagal mengirim notifikasi online ke order-system:', err))
  }

  // Cancel order
  async function cancelOrder(id: string) {
    if (confirm('Batalkan pesanan ini secara permanen?')) {
      queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
        prev?.map(o => o.id === id ? { ...o, status: 'cancelled' } : o)
      )
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id)
      queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
    }
  }

  const filteredOrders = orders.filter(o => {
    if (sourceFilter === 'all') return true
    if (sourceFilter === 'online') return o.source === 'online'
    if (sourceFilter === 'offline') return o.source !== 'online'
    return true
  })

  const pendingOrders = filteredOrders.filter((o) => o.status === 'pending').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const preparingOrders = filteredOrders.filter((o) => o.status === 'preparing').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  
  const completedOrders = filteredOrders.filter((o) => o.status === 'completed')
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
      <div key={order.id} className={`bg-white overflow-hidden border border-[#d9c2b2] suka-shadow rounded-2xl animate-fade-in transition-all duration-200 hover:shadow-md ${isPreparing ? 'hover:border-[#f29744]' : 'hover:border-[#701604]'}`}>
        {/* Header Row */}
        <div 
          className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${isPreparing ? 'hover:bg-[#f29744]/5' : 'hover:bg-[#701604]/5'}`}
          onClick={() => setExpand(expanded ? null : order.id)}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-md flex-shrink-0 ${isPreparing ? 'bg-[#f29744] shadow-[#f29744]/20' : 'bg-[#701604] shadow-[#701604]/20'}`}>
              <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider leading-none mb-0.5">Antrian</span>
              <span className="font-bold text-white text-xl leading-none">#{order.order_number}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {order.source === 'online' ? (
                  <span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1"><Globe className="w-3 h-3" /> Online</span>
                ) : order.channel ? (
                  <ChannelBadge channel={order.channel} />
                ) : (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1"><Store className="w-3 h-3" /> Offline</span>
                )}
                <span className="text-[10px] font-bold text-[#701604]/80 bg-[#701604]/5 px-2 py-0.5 rounded-md uppercase">
                  {order.payment_method}
                </span>
              </div>
              <p className="font-bold text-[#701604] flex items-center gap-2">
                {formatRupiah(order.total_amount)}
              </p>
              <p className="text-xs text-[#544437] mt-1 flex items-center gap-1.5 flex-wrap">
                <span className={`font-semibold ${isPreparing ? 'text-[#f29744]' : 'text-[#701604]'}`}>{timeAgo(order.created_at, now)}</span>
                <span className="w-1 h-1 bg-[#d9c2b2] rounded-full" />
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
              className="flex-1 bg-[#f29744] hover:bg-[#e08632] text-white font-bold py-3.5 rounded-xl shadow-sm shadow-[#f29744]/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              Terima & Proses
            </button>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); markAsCompleted(order.id) }}
              className="flex-1 bg-[#0a7d2c] hover:bg-[#086624] text-white font-bold py-3.5 rounded-xl shadow-sm shadow-[#0a7d2c]/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              Tandai Selesai
            </button>
          )}
        </div>

        {/* Expanded Detail */}
        {expanded && (
          <div className={`border-t px-5 py-4 space-y-3 ${isPreparing ? 'border-[#f29744]/10 bg-[#f29744]/5' : 'border-[#701604]/10 bg-[#701604]/5'}`}>
            <div className="space-y-1.5">
              {(() => {
                const { rootItems, childrenMap } = getGroupedItems(order.order_items)
                return rootItems.map((oi) => (
                  <div key={oi.id} className="py-2 relative">
                    {/* Vertical line connecting to children/notes */}
                    {(oi.parsedNote || (childrenMap[oi.parsedId] && childrenMap[oi.parsedId].length > 0)) && (
                      <div className="absolute left-[9px] top-6 bottom-4 w-[2px] bg-[#701604]/10" />
                    )}

                    {/* Parent Row */}
                    <div className="flex justify-between text-sm items-start gap-2">
                      <div className="text-gray-700 flex items-start gap-2.5 min-w-0 flex-1">
                        <span className={`w-5 h-5 text-[10px] font-bold rounded-md flex items-center justify-center flex-shrink-0 relative z-10 ${isPreparing ? 'bg-[#f29744]/10 text-[#f29744]' : 'bg-[#701604]/10 text-[#701604]'}`}>
                          {oi.quantity}
                        </span>
                        <span className="leading-snug font-semibold text-[#701604] break-words min-w-0 flex-1">{oi.parsedName}</span>
                      </div>
                      <span className="font-semibold text-[#701604] flex-shrink-0">{formatRupiah(oi.subtotal)}</span>
                    </div>

                    {/* Parent Note */}
                    {oi.parsedNote && (
                      <div className="relative pl-[1.6rem] mt-1.5 mb-1.5 flex items-start">
                        <div className="absolute left-[9px] top-2.5 w-3 h-[2px] bg-[#701604]/10" />
                        <div className={`text-[11px] px-2 py-1 rounded-md font-semibold leading-snug border break-words whitespace-pre-wrap min-w-0 flex-1 bg-white border-[#701604]/10 text-[#701604]/80`}>
                          {oi.parsedNote}
                        </div>
                      </div>
                    )}

                    {/* Children / Extras */}
                    {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                      <div key={child.id} className="relative pl-[1.6rem] py-1 flex justify-between text-sm items-start gap-2">
                        <div className="absolute left-[9px] top-3 w-3 h-[2px] bg-[#701604]/10" />
                        <div className="text-gray-600 flex items-start gap-2 min-w-0 flex-1">
                          <span className="w-4 text-[10px] font-bold text-center mt-0.5 shrink-0">{child.quantity}x</span>
                          <div className="min-w-0 flex-1">
                            <div className="leading-snug font-medium flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-bold uppercase px-1 rounded-sm ${isPreparing ? 'bg-[#f29744]/10 text-[#f29744]' : 'bg-[#701604]/10 text-[#701604]'}`}>Extra</span>
                              <span className="break-words min-w-0 text-[#701604]/80">{child.parsedName}</span>
                            </div>
                            {child.parsedNote && (
                              <div className="mt-1 flex items-start">
                                <div className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold leading-snug border break-words whitespace-pre-wrap min-w-0 flex-1 relative bg-white border-[#701604]/10 text-[#701604]/80`}>
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
              <div className={`rounded-xl p-3 text-sm border break-words whitespace-pre-wrap bg-white border-[#701604]/10 text-[#701604]/80`}>
                <span className="font-bold text-[#701604]">Catatan Pesanan: </span>{order.notes}
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
      <audio id="ding-sound" src={DING_SOUND} preload="auto" />
      
      {!audioPermission && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const a = document.getElementById('ding-sound') as HTMLAudioElement
            if (a) {
              a.volume = 1.0;
              a.play().then(() => {
                a.pause();
                a.currentTime = 0;
                setAudioPermission(true);
              }).catch((err) => {
                console.error('Audio manual play failed:', err);
                setAudioPermission(true);
              })
            } else {
              setAudioPermission(true);
            }
          }}
          className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white font-bold p-3.5 text-sm sm:text-base text-center shadow-lg animate-pulse flex items-center justify-center gap-2 cursor-pointer"
        >
          <BellRing className="w-5 h-5" />
          Browser memblokir suara notifikasi. Klik kotak merah ini untuk MENGAKTIFKAN SUARA!
        </button>
      )}

      {/* ── Header & Stats ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 flex-wrap pb-4 border-b border-[#d9c2b2]">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#701604] tracking-tight">Order</h1>
          {outletName && (
            <p className="text-sm font-medium text-[#544437] mt-1 flex items-center gap-1.5 bg-[#f5ede3] px-3 py-1.5 rounded-lg w-max max-w-full border border-[#d9c2b2]">
              <Store className="w-4 h-4 text-[#f29744] shrink-0" />
              <span className="truncate">Anda berada di cabang: <strong className="text-[#1e1b15]">{outletName}</strong></span>
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <Link
            href="/kasir/order-manual"
            className="bg-[#f29744] hover:bg-[#e08632] text-white font-bold px-4 py-3 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-sm shadow-[#f29744]/20 flex-shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Input Manual</span>
          </Link>
          <div className="bg-white border border-[#d9c2b2] px-5 py-3 rounded-2xl flex-1 sm:flex-none flex items-center gap-4 suka-shadow">
            <div className="w-10 h-10 bg-[#f29744] rounded-xl flex items-center justify-center shadow-md shadow-[#f29744]/20">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#544437] uppercase tracking-widest leading-none">Pendapatan Lunas</p>
              <p className="text-xl font-bold text-[#701604] mt-1 leading-none">{formatRupiah(todayRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Source Tabs Filter + Widget Stok */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        {(() => {
          const activeOnlineCount = orders.filter(o => o.source === 'online' && (o.status === 'pending' || o.status === 'preparing')).length;
          return (
            <div className="flex bg-[#f5ede3] p-1 rounded-xl border border-[#d9c2b2] w-full sm:w-max">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${sourceFilter === 'all' ? 'bg-white text-[#701604] shadow-sm' : 'text-[#544437] hover:text-[#1e1b15]'}`}
              >
                Semua
              </button>
              <button
                onClick={() => setSourceFilter('online')}
                className={`relative px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${sourceFilter === 'online' ? 'bg-[#f29744] text-white shadow-sm shadow-[#f29744]/20' : 'text-[#544437] hover:text-[#1e1b15]'}`}
              >
                <Globe className="w-4 h-4" /> Online
                {activeOnlineCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border-2 border-white animate-pulse">
                    {activeOnlineCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSourceFilter('offline')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${sourceFilter === 'offline' ? 'bg-[#701604] text-white shadow-sm shadow-[#701604]/20' : 'text-[#544437] hover:text-[#1e1b15]'}`}
              >
                <Store className="w-4 h-4" /> Offline
              </button>
            </div>
          );
        })()}
        <StockWidget />
      </div>

      {/* Bento Grid columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[calc(100vh-220px)] items-stretch pb-20">
        
        {/* ── Column 1: MENUNGGU PEMBAYARAN (Pending) ── */}
        <div className="bg-white border border-[#d9c2b2] suka-shadow rounded-2xl p-5 flex flex-col h-[600px] lg:h-full">
          <div className="flex items-center justify-between pb-4 border-b border-[#d9c2b2] mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#701604]" />
              <h2 className="font-bold text-[#701604] text-lg">Menunggu Pembayaran</h2>
            </div>
            <span className="bg-[#701604]/10 text-[#701604] text-xs font-bold px-3 py-1 rounded-full">
              {pendingOrders.length} Pesanan
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {loading ? (
              <div className="h-32 animate-pulse bg-gray-50 rounded-xl" />
            ) : pendingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[#d9c2b2] rounded-xl bg-transparent">
                <ShoppingBag className="w-12 h-12 text-[#877365]/20 mb-3" strokeWidth={1.5} />
                <p className="font-bold text-[#544437]/60">Tidak ada pesanan tertunda</p>
                <p className="text-xs text-[#544437]/40 mt-1">Pesanan baru akan muncul otomatis di sini.</p>
              </div>
            ) : (
              pendingOrders.map((order) => renderActiveCard(order, 'pending'))
            )}
          </div>
        </div>

        {/* ── Column 2: SEDANG DIPROSES (Preparing) ── */}
        <div className="bg-white border border-[#d9c2b2] suka-shadow rounded-2xl p-5 flex flex-col h-[600px] lg:h-full">
          <div className="flex items-center justify-between pb-4 border-b border-[#d9c2b2] mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#f29744]" />
              <h2 className="font-bold text-[#701604] text-lg">Sedang Diproses</h2>
            </div>
            <span className="bg-[#f29744]/10 text-[#f29744] text-xs font-bold px-3 py-1 rounded-full">
              {preparingOrders.length} Pesanan
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {preparingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[#d9c2b2] rounded-xl bg-transparent">
                <ChefHat className="w-12 h-12 text-[#877365]/20 mb-3" strokeWidth={1.5} />
                <p className="font-bold text-[#544437]/60">Tidak ada pesanan diproses</p>
                <p className="text-xs text-[#544437]/40 mt-1">Terima pesanan di kolom pembayaran untuk diproses.</p>
              </div>
            ) : (
              preparingOrders.map((order) => renderActiveCard(order, 'preparing'))
            )}
          </div>
        </div>

        {/* ── Column 3: COMPLETED (Selesai Hari Ini) ── */}
        <div className="bg-white border border-[#d9c2b2] suka-shadow rounded-2xl p-5 flex flex-col h-[600px] lg:h-full">
          <div className="flex flex-col gap-3 pb-4 border-b border-[#d9c2b2] mb-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#0a7d2c]" />
                <h2 className="font-bold text-[#701604] text-lg">Selesai / Lunas</h2>
              </div>
              <span className="bg-[#0a7d2c]/10 text-[#0a7d2c] text-xs font-bold px-3 py-1 rounded-full">
                {filteredCompletedOrders.length} Pesanan
              </span>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-[#877365]" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-3 py-2 border border-[#d9c2b2] rounded-xl leading-5 bg-[#fff8f1] placeholder-[#877365] focus:outline-none focus:ring-2 focus:ring-[#f29744] focus:border-[#f29744] focus:bg-white transition-all text-sm text-[#1e1b15]"
                placeholder="Cari antrian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {completedOrders.length === 0 ? (
              <p className="text-center text-sm text-[#544437]/40 py-8">Belum ada pesanan selesai hari ini</p>
            ) : filteredCompletedOrders.length === 0 ? (
              <p className="text-center text-sm text-[#544437]/40 py-8">Nomor antrian tidak ditemukan</p>
            ) : (
              filteredCompletedOrders.slice(0, 15).map((order) => (
                <div key={order.id} className="bg-white border border-[#d9c2b2] suka-shadow rounded-2xl p-4 hover:shadow-md transition-shadow animate-fade-in">
                  
                  {/* Header Row */}
                  <div className="flex items-start justify-between border-b border-dashed border-[#d9c2b2] pb-3 mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-[#0a7d2c]/5 rounded-2xl flex flex-col items-center justify-center border border-[#0a7d2c]/10 shadow-sm flex-shrink-0">
                        <span className="text-[10px] text-[#0a7d2c] font-bold uppercase tracking-wider leading-none mb-0.5">Antrian</span>
                        <span className="font-bold text-[#0a7d2c] text-xl leading-none">#{order.order_number}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#701604]">{formatRupiah(order.total_amount)}</p>
                        <p className="text-xs text-[#544437]/60 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[#0a7d2c]">{timeAgo(order.created_at, now)}</span>
                          <span className="w-1 h-1 bg-[#d9c2b2] rounded-full" />
                          {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          <span className="w-1 h-1 bg-[#d9c2b2] rounded-full" />
                          {order.source === 'online' ? (
                            <span className="flex items-center gap-1 uppercase font-bold text-[9px] tracking-wider bg-blue-50 px-1.5 py-0.5 rounded text-blue-600">
                              <Globe className="w-2.5 h-2.5" /> Online
                            </span>
                          ) : order.channel ? (
                            <ChannelBadge channel={order.channel} />
                          ) : (
                            <span className="flex items-center gap-1 uppercase font-bold text-[9px] tracking-wider bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                              <Store className="w-2.5 h-2.5" /> Offline
                            </span>
                          )}
                          <span className="uppercase font-bold text-[9px] tracking-wider bg-[#701604]/5 px-1.5 py-0.5 rounded text-[#701604]/80">
                            {order.payment_method}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="bg-[#0a7d2c]/10 text-[#0a7d2c] p-1.5 rounded-lg flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Order Items */}
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
                        <div key={oi.id} className="py-1.5 relative">
                          {(oi.parsedNote || (childrenMap[oi.parsedId] && childrenMap[oi.parsedId].length > 0)) && (
                            <div className="absolute left-[11px] top-6 bottom-3 w-[2px] bg-[#701604]/10" />
                          )}

                          <div className="flex items-start gap-2 relative z-10">
                            <span className="font-bold text-[#701604] text-sm w-6 shrink-0 text-center bg-white">{oi.quantity}x</span>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold text-[#701604]/80 leading-snug break-words">{oi.parsedName}</span>
                            </div>
                          </div>

                          {oi.parsedNote && (
                            <div className="relative pl-[1.6rem] mt-1.5 mb-1.5 flex items-start">
                              <div className="absolute left-[11px] top-2.5 w-3 h-[2px] bg-[#701604]/10" />
                              <div className="bg-[#fff8f1] border border-[#701604]/10 text-[#701604] text-[11px] px-2 py-1 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1">
                                {oi.parsedNote}
                              </div>
                            </div>
                          )}

                          {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                            <div key={child.id} className="relative pl-[1.6rem] py-1 flex items-start gap-2">
                              <div className="absolute left-[11px] top-3 w-3 h-[2px] bg-[#701604]/10" />
                              <span className="font-bold text-[#701604]/60 text-xs w-5 shrink-0 text-right mt-0.5">{child.quantity}x</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-[#701604]/60 leading-snug flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[8px] font-bold uppercase bg-[#701604]/5 text-[#701604]/80 px-1 rounded-sm">Extra</span>
                                  <span className="break-words min-w-0">{child.parsedName}</span>
                                </div>
                                {child.parsedNote && (
                                  <div className="relative mt-1 flex items-start">
                                    <div className="bg-[#fff8f1] border border-[#701604]/10 text-[#701604] text-[10px] px-1.5 py-0.5 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1">
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

                  {order.notes && (
                    <div className="mt-3 bg-[#fff8f1] rounded-lg p-2.5 text-xs text-[#701604]/80 font-medium border border-[#701604]/10 break-words whitespace-pre-wrap">
                      <span className="font-bold">Catatan Pesanan:</span> {order.notes}
                    </div>
                  )}
                </div>
              ))
            )}
            
            {filteredCompletedOrders.length > 15 && (
              <p className="text-center text-xs font-medium text-[#544437]/40 py-2">
                Menampilkan 15 pesanan terakhir (+{filteredCompletedOrders.length - 15} lainnya)
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
