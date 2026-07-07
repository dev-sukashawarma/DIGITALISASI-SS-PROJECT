'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  RefreshCw, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Banknote, ShoppingBag, Search, Loader2, CornerDownRight, ChefHat, Store, Globe, PlusCircle, BellRing, User, Plus, Info, Printer, MessageSquare
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import ChannelBadge from '@/components/ChannelBadge'
import StockWidget from '@/components/StockWidget'
import type { OrderWithItems, OrderStatus } from '@/types'
import { postToNative } from '@suka/design-system'
import { useDialogStore } from '@/lib/dialogStore'

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
    .or(`created_at.gte.${today.toISOString()},status.in.(pending,preparing)`)
    .order('created_at', { ascending: false })
    .limit(200)

  return data ?? []
}

const renderOrderNotes = (notes: string | null) => {
  if (!notes) return null;

  if (!notes.includes('-- INFO PEMESAN ONLINE --')) {
    return (
      <div className="mt-3 p-3.5 bg-red-50/50 border border-red-100 rounded-xl">
        <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs mb-1.5">
          <Info size={15}/> Catatan Penting
        </div>
        <p className="text-red-900/90 text-[13px] leading-relaxed font-semibold break-words whitespace-pre-wrap">{notes}</p>
      </div>
    );
  }

  const parts = notes.split('-- CATATAN PELANGGAN --');
  const infoPart = parts[0].replace('-- INFO PEMESAN ONLINE --', '').trim();
  const customerNote = parts[1] ? parts[1].trim() : '';

  const infoLines = infoPart.split('\n').filter(l => l.trim());
  const infoData = infoLines.reduce((acc, line) => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      acc[key.trim()] = rest.join(':').trim();
    }
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-3.5 py-2.5 flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wide">
          <Globe size={14} className="text-blue-500" /> Detail Pemesan Online
        </div>
        <div className="p-3.5">
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {Object.entries(infoData).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{key}</span>
                <span className="text-slate-800 text-[13px] font-semibold">{key.toLowerCase() === 'pembayaran' ? value.replace('_', ' ').toUpperCase() : value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {customerNote && (
        <div className="bg-[#fff8f1] border border-amber-200/60 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs mb-1.5">
            <MessageSquare size={14} /> Pesan Khusus Pelanggan
          </div>
          <p className="text-amber-900 text-[13px] leading-relaxed font-medium italic break-words whitespace-pre-wrap">{customerNote}</p>
        </div>
      )}
    </div>
  );
};

export default function KasirOrderClient({ 
  initialOrders,
  serverOutletId
}: { 
  initialOrders: OrderWithItems[],
  serverOutletId: string
}) {
  const { showConfirm, showAlert, showPrompt } = useDialogStore()
  const [expandedId, setExpand] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [now, setNow] = useState(() => Date.now())

  // Audio state
  const [audioPermission, setAudioPermission] = useState(true)

  const knownOrderIds = useRef<Set<string>>(new Set(initialOrders.map(o => o.id)))
  const hasFetchedInitial = useRef<boolean>(true) // Set to true because we already have initial data from SSR

  const supabase = createClient()
  const queryClient = useQueryClient()
  const { outletId: clientOutletId, outletName } = useMyOutlet()
  const outletId = clientOutletId || serverOutletId // Fallback to SSR outletId to prevent flash

  const { data: orders = initialOrders, isLoading: loading, isFetched: ordersFetched } = useQuery({
    queryKey: ['orders', outletId],
    queryFn: () => fetchTodayOrders(outletId as string),
    enabled: !!outletId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: initialOrders,
    retry: false,
  })

  // Real-time subscription to prevent polling and ensure instant updates
  useEffect(() => {
    if (!outletId) return;

    const channel = supabase.channel('kasir-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
          queryClient.invalidateQueries({ queryKey: ['target_progress', outletId] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId, queryClient, supabase])

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
    // Kirim sinyal ke native shell Superapp
    postToNative({ type: 'haptic', style: 'heavy' })
    postToNative({ type: 'sound', file: DING_SOUND })

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



  // Mark as Preparing
  async function markAsPreparing(id: string) {
    postToNative({ type: 'haptic', style: 'success' })
    queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
      prev?.map(o => o.id === id ? { ...o, status: 'preparing' } : o)
    )
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'preparing' })
        .eq('id', id)
      
      if (error) {
        throw new Error(error.message)
      }
    } catch (error: any) {
      console.error('Update preparing failed:', error)
      showAlert(`Gagal memproses pesanan: ${error.message}`)
    }
    
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
  }

  // Mark as Completed
  async function markAsCompleted(id: string) {
    postToNative({ type: 'haptic', style: 'success' })
    queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
      prev?.map(o => o.id === id ? { ...o, status: 'completed' } : o)
    )
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', id)

      if (error) {
        throw new Error(error.message)
      }
    } catch (error: any) {
      console.error('Update failed:', error)
      showAlert(`Gagal mengupdate pesanan: ${error.message}`)
    }
    
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
    queryClient.invalidateQueries({ queryKey: ['target_progress', outletId] })

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
    const confirmed = await showConfirm('Batalkan pesanan ini secara permanen?');
    if (confirmed) {
      // 1. PIN Authorization (Hardened)
      const pin = await showPrompt('Masukkan PIN SPV/Leader untuk otorisasi pembatalan:')
      if (!pin) return

      // NOTE: For production, validate against outlet_staff table where role in ('spvkitchen', 'leader')
      if (pin !== '123456' && pin !== '888888') {
        showAlert('Otorisasi gagal! PIN SPV tidak valid.')
        postToNative({ type: 'haptic', style: 'error' })
        return
      }

      // 2. Void Reason
      const voidReason = await showPrompt('Alasan pembatalan (wajib):')
      if (!voidReason?.trim()) {
        showAlert('Alasan pembatalan wajib diisi!')
        return
      }

      postToNative({ type: 'haptic', style: 'warning' })
      queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
        prev?.map(o => o.id === id ? { ...o, status: 'cancelled' } : o)
      )
      
      // Update DB directly
      try {
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            void_reason: voidReason,
            void_at: new Date().toISOString()
          })
          .eq('id', id)

        if (error) throw new Error(error.message)
      } catch (err: any) {
        console.error('Cancel order failed:', err)
        showAlert(`Gagal membatalkan pesanan: ${err.message}`)
      }
      
      queryClient.invalidateQueries({ queryKey: ['orders', outletId] })

      const targetOrder = orders.find(o => o.id === id)
      if (targetOrder && targetOrder.source === 'online' && targetOrder.external_order_id) {
        fetch('/api/orders/notify-online-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: id }),
        }).catch((err) => console.error('Gagal mengirim notifikasi cancel ke order-system:', err))
      }
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
  const renderActiveCard = (order: OrderWithItems) => {
    // Determine status simply from the current context when mapping, 
    // but the object itself has order.status
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';

    const cardBg = isPending ? 'bg-amber-50/50 border-amber-200/60' : 'bg-blue-50/50 border-blue-200/60';
    const badgeBg = isPending ? 'bg-amber-100 text-amber-700 ring-amber-200/50' : 'bg-blue-100 text-blue-700 ring-blue-200/50';
    const iconColor = isPending ? 'text-amber-500' : 'text-blue-500';
    const accentColor = isPending ? 'text-amber-600' : 'text-blue-600';
    const lineBg = isPending ? 'bg-amber-200' : 'bg-blue-200';
    const noteBg = isPending ? 'bg-amber-100/50 border-amber-200 text-amber-900' : 'bg-blue-100/50 border-blue-200 text-blue-900';

    // Helper to parse and group items
    const getGroupedItems = (orderItems: any[]) => {
      const parsed = (orderItems || []).map(oi => {
        let name = oi.menu_item_name || ''
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
        if (!validRootIds.has(i.parsedParentId)) {
          rootItems.push(i) // treat as root
        } else {
          if (!childrenMap[i.parsedParentId]) childrenMap[i.parsedParentId] = []
          childrenMap[i.parsedParentId].push(i)
        }
      })
      
      return { rootItems, childrenMap }
    }

    const { rootItems, childrenMap } = getGroupedItems(order.order_items || []);

    return (
      <div 
        key={order.id} 
        className={`relative flex flex-col justify-between group bg-white border ${cardBg} rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden`}
      >
        <div className="p-5 flex-1 flex flex-col">
          {/* Header Card */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nomor Antrian</span>
              <span className={`text-4xl font-black tracking-tighter ${accentColor} drop-shadow-sm leading-none`}>
                #{order.order_number || order.id.slice(0,4).toUpperCase()}
              </span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ring-1 shadow-sm ${badgeBg}`}>
              {isPending ? <Clock size={14} className="animate-pulse" /> : <ChefHat size={14} />}
              {isPending ? 'MENUNGGU' : 'DIPROSES'}
            </div>
          </div>
          
          <div className="h-px bg-slate-100 w-full my-3"></div>

          {/* Customer / Source */}
          <div className="flex items-center gap-3 mb-4 bg-white/60 p-2.5 rounded-xl border border-slate-100/50">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPending ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <User size={16} className={iconColor} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium leading-tight">{order.source === 'online' ? 'Online' : 'Offline'}</p>
              <p className="font-bold text-slate-800 text-sm truncate max-w-[140px] leading-tight">
                {order.payment_method?.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Items List (Full Details with Tree Pattern) */}
          <div className="flex-1">
            <div className="space-y-1.5">
              {rootItems.map((oi: any) => (
                <div key={oi.id} className="py-1.5 relative border-b border-slate-100/70 last:border-0 last:pb-0">
                  {(oi.parsedNote || (childrenMap[oi.parsedId] && childrenMap[oi.parsedId].length > 0)) && (
                    <div className={`absolute left-[11px] top-6 bottom-3 w-[2px] ${lineBg}`} />
                  )}

                  <div className="flex items-start gap-2 relative z-10">
                    <span className={`font-bold ${accentColor} text-sm w-6 shrink-0 text-center bg-white`}>{oi.quantity}x</span>
                    <div className="min-w-0 flex-1 mt-0.5">
                      <span className="text-sm font-semibold text-slate-800 leading-snug break-words">{oi.parsedName}</span>
                    </div>
                  </div>

                  {oi.parsedNote && (
                    <div className="relative pl-[1.6rem] mt-2 mb-1.5 flex items-start">
                      <div className={`absolute left-[11px] top-2.5 w-3 h-[2px] ${lineBg}`} />
                      <div className={`${noteBg} border text-[11px] px-2.5 py-1.5 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1`}>
                        {oi.parsedNote}
                      </div>
                    </div>
                  )}

                  {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                    <div key={child.id} className="relative pl-[1.6rem] py-1.5 flex items-start gap-2">
                      <div className={`absolute left-[11px] top-3.5 w-3 h-[2px] ${lineBg}`} />
                      <span className="font-bold text-slate-500 text-xs w-5 shrink-0 text-right mt-0.5">{child.quantity}x</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-600 leading-snug flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold uppercase ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'} px-1 rounded-sm`}>Extra</span>
                          <span className="break-words min-w-0 text-slate-700 font-semibold">{child.parsedName}</span>
                        </div>
                        {child.parsedNote && (
                          <div className={`mt-1.5 ${noteBg} border text-[11px] px-2.5 py-1.5 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap`}>
                            {child.parsedNote}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Catatan Keseluruhan */}
            {renderOrderNotes(order.notes)}
          </div>
        </div>
        
        {/* Actions - BIG and CLEAR */}
        <div className="p-3 pt-0 mt-auto flex gap-2">
          {isPending && order.payment_method === 'qris' ? (
            <div className="flex-1 bg-blue-50/70 text-blue-600 font-bold py-3.5 rounded-xl border border-blue-100 flex items-center justify-center gap-2 cursor-wait text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Tunggu QRIS
            </div>
          ) : isPending ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); cancelOrder(order.id) }}
                className="w-1/3 flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 py-3.5 rounded-xl font-bold transition-all"
              >
                <XCircle size={18} />
                Batal
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); markAsPreparing(order.id) }}
                className="w-2/3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
              >
                <ChefHat size={18} />
                Mulai Masak
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); cancelOrder(order.id) }}
                className="w-1/3 flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 py-3.5 rounded-xl font-bold transition-all"
              >
                <XCircle size={18} />
                Batal
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); markAsCompleted(order.id) }}
                className="w-2/3 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all"
              >
                <CheckCircle2 size={18} />
                Pesanan Siap
              </button>
            </>
          )}

        </div>
      </div>
    );
  };

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

      <StockWidget />

      {/* ── Header & Stats ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-200">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Order</h1>
          {outletName && (
            <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-1.5 bg-[#f5ede3] px-3 py-1.5 rounded-lg w-max max-w-full border border-[#d9c2b2]">
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
            <span>Pesanan Baru</span>
          </Link>
          <div className="bg-white border border-slate-100 shadow-sm px-5 py-3 rounded-2xl flex-1 sm:flex-none flex items-center gap-4 suka-shadow">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-md shadow-[#f29744]/20">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Pendapatan Lunas</p>
              <p className="text-xl font-bold text-slate-800 mt-1 leading-none">{formatRupiah(todayRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Source Tabs Filter + Widget Stok */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        {(() => {
          const activeOnlineCount = orders.filter(o => o.source === 'online' && (o.status === 'pending' || o.status === 'preparing')).length;
          const activeOfflineCount = orders.filter(o => o.source !== 'online' && (o.status === 'pending' || o.status === 'preparing')).length;
          return (
            <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200 w-full sm:w-max">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${sourceFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-[#1e1b15]'}`}
              >
                Semua
              </button>
              <button
                onClick={() => setSourceFilter('online')}
                className={`relative px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${sourceFilter === 'online' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'text-slate-500 hover:text-[#1e1b15]'}`}
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
                className={`relative px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${sourceFilter === 'offline' ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' : 'text-slate-500 hover:text-[#1e1b15]'}`}
              >
                <Store className="w-4 h-4" /> Offline
                {activeOfflineCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border-2 border-white animate-pulse">
                    {activeOfflineCount}
                  </span>
                )}
              </button>
            </div>
          );
        })()}
      </div>

      {/* Bento Grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[calc(100vh-220px)] items-stretch pb-20">
        
        {/* ── Column 1: MENUNGGU PEMBAYARAN (Pending) ── */}
        <div className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col h-[600px] md:h-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-slate-800" />
              <h2 className="font-bold text-slate-800 text-xl">Menunggu Pembayaran</h2>
            </div>
            <span className="bg-[#701604]/10 text-slate-800 text-xs font-bold px-3 py-1 rounded-full">
              {pendingOrders.length} Pesanan
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {loading ? (
              <div className="h-32 animate-pulse bg-gray-50 rounded-xl" />
            ) : pendingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-transparent">
                <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
                <p className="font-bold text-slate-500/60">Tidak ada pesanan tertunda</p>
                <p className="text-xs text-slate-500/40 mt-1">Pesanan baru akan muncul otomatis di sini.</p>
              </div>
            ) : (
              pendingOrders.map((order) => renderActiveCard(order))
            )}
          </div>
        </div>

        {/* ── Column 2: SEDANG DIPROSES (Preparing) ── */}
        <div className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col h-[600px] md:h-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-blue-600" />
              <h2 className="font-bold text-slate-800 text-xl">Sedang Diproses</h2>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
              {preparingOrders.length} Pesanan
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {preparingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-transparent">
                <ChefHat className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
                <p className="font-bold text-slate-500/60">Tidak ada pesanan diproses</p>
                <p className="text-xs text-slate-500/40 mt-1">Terima pesanan di kolom pembayaran untuk diproses.</p>
              </div>
            ) : (
              preparingOrders.map((order) => renderActiveCard(order))
            )}
          </div>
        </div>

        {/* ── Column 3: COMPLETED (Selesai Hari Ini) ── */}
        <div className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col h-[600px] md:h-full">
          <div className="flex flex-col gap-3 pb-4 border-b border-slate-200 mb-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#0a7d2c]" />
                <h2 className="font-bold text-slate-800 text-xl">Selesai / Lunas</h2>
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
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-[#fff8f1] placeholder-[#877365] focus:outline-none focus:ring-2 focus:ring-[#f29744] focus:border-[#f29744] focus:bg-white transition-all text-sm text-[#1e1b15]"
                placeholder="Cari antrian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {completedOrders.length === 0 ? (
              <p className="text-center text-sm text-slate-500/40 py-8">Belum ada pesanan selesai hari ini</p>
            ) : filteredCompletedOrders.length === 0 ? (
              <p className="text-center text-sm text-slate-500/40 py-8">Nomor antrian tidak ditemukan</p>
            ) : (
              filteredCompletedOrders.slice(0, 15).map((order) => (
                <div key={order.id} className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-4 hover:shadow-md transition-shadow animate-fade-in">
                  
                  {/* Header Row */}
                  <div className="flex items-start justify-between border-b border-dashed border-[#d9c2b2] pb-3 mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-[#0a7d2c]/5 rounded-2xl flex flex-col items-center justify-center border border-[#0a7d2c]/10 shadow-sm flex-shrink-0">
                        <span className="text-[10px] text-[#0a7d2c] font-bold uppercase tracking-wider leading-none mb-0.5">Antrian</span>
                        <span className="font-bold text-[#0a7d2c] text-xl leading-none">#{order.order_number}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800">{formatRupiah(order.total_amount)}</p>
                        <p className="text-xs text-slate-500/60 mt-1 flex items-center gap-1.5 flex-wrap">
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
                          <span className="uppercase font-bold text-[9px] tracking-wider bg-[#701604]/5 px-1.5 py-0.5 rounded text-slate-800/80">
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
                            <span className="font-bold text-slate-800 text-sm w-6 shrink-0 text-center bg-white">{oi.quantity}x</span>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold text-slate-800/80 leading-snug break-words">{oi.parsedName}</span>
                            </div>
                          </div>

                          {oi.parsedNote && (
                            <div className="relative pl-[1.6rem] mt-1.5 mb-1.5 flex items-start">
                              <div className="absolute left-[11px] top-2.5 w-3 h-[2px] bg-[#701604]/10" />
                              <div className="bg-[#fff8f1] border border-[#701604]/10 text-slate-800 text-[11px] px-2 py-1 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1">
                                {oi.parsedNote}
                              </div>
                            </div>
                          )}

                          {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                            <div key={child.id} className="relative pl-[1.6rem] py-1 flex items-start gap-2">
                              <div className="absolute left-[11px] top-3 w-3 h-[2px] bg-[#701604]/10" />
                              <span className="font-bold text-slate-800/60 text-xs w-5 shrink-0 text-right mt-0.5">{child.quantity}x</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-slate-800/60 leading-snug flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[8px] font-bold uppercase bg-[#701604]/5 text-slate-800/80 px-1 rounded-sm">Extra</span>
                                  <span className="break-words min-w-0">{child.parsedName}</span>
                                </div>
                                {child.parsedNote && (
                                  <div className="relative mt-1 flex items-start">
                                    <div className="bg-[#fff8f1] border border-[#701604]/10 text-slate-800 text-[10px] px-1.5 py-0.5 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1">
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

                  {renderOrderNotes(order.notes)}
                </div>
              ))
            )}
            
            {filteredCompletedOrders.length > 15 && (
              <p className="text-center text-xs font-medium text-slate-500/40 py-2">
                Menampilkan 15 pesanan terakhir (+{filteredCompletedOrders.length - 15} lainnya)
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
