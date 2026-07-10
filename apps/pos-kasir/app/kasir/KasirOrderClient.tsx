'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  RefreshCw, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Banknote, ShoppingBag, Search, Loader2, CornerDownRight, ChefHat, Store, Globe, PlusCircle, BellRing, User, Plus, Info, Printer, MessageSquare, Zap
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { createClient } from '@/lib/supabase/client'
import { db, type LocalOrderRow } from '@/lib/db'
import {
  cacheOrders, readCachedTodayOrders, patchCachedOrder,
  patchLocalOrder, queueStatusMutation, isNetworkError, localOrderRowsToOrders,
} from '@/lib/offline'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import ChannelBadge from '@/components/ChannelBadge'
import StockWidget from '@/components/StockWidget'
import type { OrderWithItems, OrderStatus } from '@/types'
import { postToNative } from '@suka/design-system'
import { useDialogStore } from '@/lib/dialogStore'
import { fetchWithTimeout } from '@/lib/offline-utils'

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
  try {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('outlet_id', outletId)
        .or(`created_at.gte.${today.toISOString()},status.in.(pending,preparing)`)
        .order('created_at', { ascending: false })
        .limit(200)
        .then(res => res)
    )

    if (error) throw new Error(error.message)

    // Simpan ke IndexedDB — sumber data papan order saat offline
    await cacheOrders(outletId, data ?? []).catch(() => {})
    return data ?? []
  } catch (err) {
    console.warn('[KasirOrder] Fetch orders gagal, memakai cache IndexedDB:', err)
    return readCachedTodayOrders(outletId)
  }
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
  const [preparingTab, setPreparingTab] = useState<'antrean' | 'terjadwal'>('antrean')
  const [now, setNow] = useState(() => Date.now())
  const [isDevTesting, setIsDevTesting] = useState(false)

  const createTestOrder = async () => {
    if (!outletId) return;
    setIsDevTesting(true);
    try {
      // 1. Ambil menu test
      const { data: menuData, error: menuErr } = await supabase
        .from('menu_items')
        .select('*')
        .ilike('name', '%test%')
        .eq('is_available', true)
        .limit(1)
        .single();

      if (menuErr || !menuData) {
        showAlert('Menu dengan nama "test" tidak ditemukan di database! Buat menu tersebut di dashboard admin terlebih dahulu.');
        return;
      }

      // 2. Buat ID order_number (random 4 digit)
      const orderNumberStr = String(Math.floor(Math.random() * 9000) + 1000);
      
      const newOrder = {
        outlet_id: outletId,
        order_number: parseInt(orderNumberStr),
        customer_name: 'DEV TESTER',
        status: 'pending',
        payment_method: 'cash',
        total_amount: menuData.price,
        notes: '-- INFO PEMESAN ONLINE --\nPembayaran: cash\n-- CATATAN PELANGGAN --\nIni adalah pesanan otomatis untuk testing development.',
        source: 'online',
        channel: 'DEV',
        external_order_id: `DEV-${Date.now()}`
      };

      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert(newOrder)
        .select()
        .single();

      if (orderErr || !orderData) {
        throw new Error(orderErr?.message || 'Gagal membuat pesanan');
      }

      // 3. Insert item
      const newOrderItem = {
        order_id: orderData.id,
        menu_item_id: menuData.id,
        menu_item_name: menuData.name,
        quantity: 1,
        unit_price: menuData.price,
        subtotal: menuData.price,
        notes: 'Menu test dev'
      };

      const { error: itemErr } = await supabase
        .from('order_items')
        .insert(newOrderItem);

      if (itemErr) {
        throw new Error(itemErr.message);
      }

    } catch (err: any) {
      console.error(err);
      showAlert(`Gagal membuat test order: ${err.message}`);
    } finally {
      setIsDevTesting(false);
    }
  }

  // Audio state
  const [audioPermission, setAudioPermission] = useState(true)

  const knownOrderIds = useRef<Set<string>>(new Set(initialOrders.map(o => o.id)))
  const hasFetchedInitial = useRef<boolean>(true) // Set to true because we already have initial data from SSR

  const supabase = createClient()
  const queryClient = useQueryClient()
  const { outletId: clientOutletId, outletName } = useMyOutlet()
  const outletId = clientOutletId || serverOutletId // Fallback to SSR outletId to prevent flash

  const { data: serverOrders = initialOrders, isLoading: loading, isFetched: ordersFetched } = useQuery({
    queryKey: ['orders', outletId],
    queryFn: () => fetchTodayOrders(outletId as string),
    enabled: !!outletId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: initialOrders,
    retry: false,
  })

  // Pesanan yang dibuat saat offline (belum tersinkron ke server) — live dari
  // IndexedDB sehingga langsung muncul/terupdate di papan tanpa refetch.
  const localOrderRows = useLiveQuery(
    () => (outletId ? db.local_orders.where('outlet_id').equals(outletId).toArray() : Promise.resolve([] as LocalOrderRow[])),
    [outletId]
  )
  const localOrders = localOrderRowsToOrders(localOrderRows ?? [])
  const localOrderIds = new Set(localOrders.map(o => o.id))

  // Gabungkan: order lokal offline tampil paling atas, hindari duplikat id
  const orders = [...localOrders, ...serverOrders.filter(o => !localOrderIds.has(o.id))]

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

  // State and ref for tracking scheduled orders moving to cooking queue
  const prevTerjadwalIds = useRef<Set<string>>(new Set())
  const [scheduledAlerts, setScheduledAlerts] = useState<OrderWithItems[]>([])

  // Tracking pergerakan spesifik dari "Terjadwal" ke "Antrean Masak"
  useEffect(() => {
    // Determine current terjadwal and antreanMasak
    const currentTerjadwal = orders.filter(o => (o.status === 'pending' || o.status === 'preparing') && getEffectiveReleaseTime(o) > now)
    const currentAntreanMasak = orders.filter(o => (o.status === 'pending' || o.status === 'preparing') && getEffectiveReleaseTime(o) <= now)
    
    const currentTerjadwalIds = new Set(currentTerjadwal.map(o => o.id))
    const currentAntreanMasakIds = new Set(currentAntreanMasak.map(o => o.id))

    const justMovedOrders: OrderWithItems[] = []
    
    // Periksa apakah ada pesanan yang sebelumnya di terjadwal, tapi sekarang di antreanMasak
    for (const id of prevTerjadwalIds.current) {
      if (currentAntreanMasakIds.has(id)) {
        const order = currentAntreanMasak.find(o => o.id === id)
        if (order) justMovedOrders.push(order)
      }
    }

    if (justMovedOrders.length > 0) {
      playNotification() // Bunyikan bel
      setScheduledAlerts(prev => [...prev, ...justMovedOrders]) // Tambahkan ke antrean modal peringatan
    }

    prevTerjadwalIds.current = currentTerjadwalIds
  }, [orders, now, playNotification])

  /**
   * Terapkan perubahan status pesanan dengan dukungan offline penuh:
   * - Pesanan lokal (dibuat offline): cukup update IndexedDB, sinkron ikut antrean order.
   * - Pesanan server + online: update Supabase langsung, lalu mirror ke cache.
   * - Pesanan server + offline/jaringan gagal: antrekan mutasi + update cache,
   *   nanti dikirim OfflineSyncManager saat online.
   */
  async function applyStatusChange(id: string, patch: Record<string, any>): Promise<boolean> {
    queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
      prev?.map(o => o.id === id ? { ...o, ...patch } : o)
    )

    if (localOrderIds.has(id)) {
      await patchLocalOrder(id, patch)
      // Kalau statusnya berubah SEBELUM order sempat tersinkron, catat juga
      // sebagai mutasi lokal supaya di-replay setelah order dibuat di server.
      await queueStatusMutation(id, patch, true)
      return true
    }

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('offline')
      const { error } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', id)
      if (error) throw new Error(error.message)
      await patchCachedOrder(id, patch).catch(() => {})
      return true
    } catch (error: any) {
      if (isNetworkError(error)) {
        // Mode offline: simpan perubahan di IndexedDB + antrean sinkron
        await queueStatusMutation(id, patch, false)
        await patchCachedOrder(id, patch).catch(() => {})
        return true
      }
      console.error('Update order failed:', error)
      showAlert(`Gagal mengupdate pesanan: ${error.message}`)
      return false
    }
  }

  // Mark as Preparing
  async function markAsPreparing(id: string) {
    postToNative({ type: 'haptic', style: 'success' })
    await applyStatusChange(id, { status: 'preparing' })
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
  }

  // Mark as Completed
  async function markAsCompleted(id: string) {
    postToNative({ type: 'haptic', style: 'success' })
    await applyStatusChange(id, { status: 'completed' })
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
      await applyStatusChange(id, {
        status: 'cancelled',
        void_reason: voidReason,
        void_at: new Date().toISOString()
      })

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
  
  // Helper untuk menentukan kapan pesanan pindah ke antrean (20 menit sebelum AMBIL)
  const getEffectiveReleaseTime = (o: OrderWithItems) => {
    if (o.release_time) return new Date(o.release_time).getTime()
    
    let timeStr = (o as any).pickup_time
    if (!timeStr && o.notes && o.notes.toUpperCase().includes('AMBIL')) {
      const match = o.notes.match(/AMBIL\s*[:\n]\s*(\d{2}:\d{2})/i)
      if (match) timeStr = match[1]
    }

    if (timeStr && typeof timeStr === 'string') {
      const timeMatch = timeStr.match(/(\d{2}):(\d{2})/)
      if (timeMatch) {
        const [_, h, m] = timeMatch
        const d = new Date()
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0)
        
        // Jika waktu ambil (d) lebih kecil dari waktu pesan (o.created_at), 
        // artinya ini pesanan untuk besok harinya.
        if (d.getTime() < new Date(o.created_at).getTime()) {
          d.setDate(d.getDate() + 1)
        }
        
        return d.getTime() - (20 * 60 * 1000)
      }
    }
    return 0 // Langsung masak
  }

  // Helper untuk menghitung estimasi waktu masak dinamis (7 menit + (Total Qty - 1))
  const getEstimatedCookingTime = (o: OrderWithItems) => {
    if (!o.order_items || o.order_items.length === 0) return 7
    const totalQty = o.order_items.reduce((sum, item) => sum + (item.quantity || 1), 0)
    return 7 + (totalQty > 1 ? totalQty - 1 : 0)
  }

  const antreanMasak = preparingOrders.filter(o => getEffectiveReleaseTime(o) <= now)
  const terjadwalMasak = preparingOrders.filter(o => getEffectiveReleaseTime(o) > now).sort((a, b) => getEffectiveReleaseTime(a) - getEffectiveReleaseTime(b))


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
              <div className="text-[10px] font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                <Clock size={10} /> dipesan {timeAgo(order.created_at, now)}
              </div>
              {localOrderIds.has(order.id) && (
                <span className="mt-1.5 inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full w-max">
                  OFFLINE — belum sinkron
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ring-1 shadow-sm ${badgeBg}`}>
                {isPending ? <Clock size={14} className="animate-pulse" /> : <ChefHat size={14} />}
                {isPending ? 'MENUNGGU' : 'DIPROSES'}
              </div>
              {getEffectiveReleaseTime(order) > now && (
                <div className="px-2 py-1 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  <Clock size={12} />
                  Estimasi Masak: {getEstimatedCookingTime(order)} Menit
                </div>
              )}
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
        <div className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col h-[600px] md:h-full relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 mb-2 shrink-0 relative z-10">
            <div className="flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-blue-600" />
              <h2 className="font-bold text-slate-800 text-xl">Sedang Diproses</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 rounded-xl mb-4 shrink-0 relative z-10">
            <button
              onClick={() => setPreparingTab('antrean')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                preparingTab === 'antrean' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Antrean 
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${preparingTab === 'antrean' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                {antreanMasak.length}
              </span>
            </button>
            <button
              onClick={() => setPreparingTab('terjadwal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                preparingTab === 'terjadwal' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Terjadwal
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${preparingTab === 'terjadwal' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                {terjadwalMasak.length}
              </span>
            </button>
          </div>

          {preparingTab === 'antrean' && antreanMasak.length > 5 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 shrink-0 flex items-start gap-2.5 animate-pulse relative z-10">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-800">Dapur Sibuk!</p>
                <p className="text-[10px] font-semibold text-red-600 leading-tight mt-0.5">Ada {antreanMasak.length} pesanan yang butuh perhatian ekstra.</p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 relative z-10">
            {preparingTab === 'antrean' ? (
              antreanMasak.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-transparent">
                  <ChefHat className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
                  <p className="font-bold text-slate-500/60">Tidak ada antrean masak</p>
                  <p className="text-xs text-slate-500/40 mt-1">Dapur sedang santai, pesanan aktif akan muncul di sini.</p>
                </div>
              ) : (
                antreanMasak.map((order) => renderActiveCard(order))
              )
            ) : (
              terjadwalMasak.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-transparent">
                  <Clock className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
                  <p className="font-bold text-slate-500/60">Tidak ada pesanan terjadwal</p>
                  <p className="text-xs text-slate-500/40 mt-1">Pesanan pre-order akan ditahan di sini sebelum masuk antrean.</p>
                </div>
              ) : (
                terjadwalMasak.map((order) => renderActiveCard(order))
              )
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

      {/* MODAL PESANAN TERJADWAL */}
      {scheduledAlerts.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl shadow-indigo-900/20 border border-white/20 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
              
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md ring-1 ring-white/30 relative">
                <Clock size={32} className="text-white animate-pulse" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-indigo-500"></div>
              </div>
              
              <h2 className="text-2xl font-black tracking-tight mb-1">Siapkan Sekarang!</h2>
              <p className="text-indigo-100 text-sm font-medium">Sisa waktu 20 menit lagi untuk pesanan Terjadwal ini.</p>
            </div>
            
            {/* Body */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase">Order</div>
                <div className="text-3xl font-black text-slate-800 tracking-tighter">
                  #{scheduledAlerts[0].order_number || scheduledAlerts[0].id.slice(0,4).toUpperCase()}
                </div>
              </div>

              {scheduledAlerts[0].notes && (
                <div className="mb-4 bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-orange-800 mb-1 flex items-center gap-1">
                    <User size={12} /> Catatan / Info Pengambilan
                  </div>
                  <div className="text-sm font-semibold text-orange-950 whitespace-pre-wrap leading-tight">
                    {scheduledAlerts[0].notes}
                  </div>
                </div>
              )}

              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Daftar Menu</div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-[160px] overflow-y-auto">
                <div className="flex flex-col gap-3">
                  {(() => {
                    const orderItems = scheduledAlerts[0].order_items || []
                    const parsed = orderItems.map((oi: any) => {
                      let name = oi.menu_item_name || ''
                      let note = ''
                      let id = oi.id
                      let parentId = null
                      
                      const noteSplit = name.split('|NOTE|')
                      if (noteSplit.length > 1) { note = noteSplit[1]; name = noteSplit[0] }
                      
                      const parentSplit = name.split('|PARENT|')
                      if (parentSplit.length > 1) { parentId = parentSplit[1]; name = parentSplit[0] }
                      
                      return { ...oi, parsedName: name, parsedNote: note, parsedId: id, parentId }
                    })

                    const parents = parsed.filter((i: any) => !i.parentId)
                    const childrenMap = parsed.filter((i: any) => i.parentId).reduce((acc: any, cur: any) => {
                      if (!acc[cur.parentId]) acc[cur.parentId] = []
                      acc[cur.parentId].push(cur)
                      return acc
                    }, {})

                    return parents.map((oi: any) => (
                      <div key={oi.parsedId} className="flex flex-col">
                        <div className="flex items-start gap-2">
                          <span className="font-black text-slate-800 w-5 shrink-0 text-right">{oi.quantity}x</span>
                          <span className="font-bold text-slate-700 min-w-0 break-words leading-tight flex-1">{oi.parsedName}</span>
                        </div>
                        {oi.parsedNote && (
                          <div className="ml-7 mt-0.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-max">
                            {oi.parsedNote}
                          </div>
                        )}
                        {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                          <div key={child.parsedId} className="flex items-start gap-2 mt-1 ml-6">
                            <span className="font-bold text-slate-500 text-xs w-4 shrink-0 text-right">{child.quantity}x</span>
                            <span className="font-semibold text-slate-500 text-xs min-w-0 break-words leading-tight flex-1">Extra: {child.parsedName}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  // Hapus pesanan pertama dari queue
                  setScheduledAlerts(prev => prev.slice(1))
                }}
                className="flex-1 bg-indigo-600 text-white font-bold text-base py-3.5 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200"
              >
                OK, Mengerti
              </button>
            </div>
            
            {scheduledAlerts.length > 1 && (
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                1 of {scheduledAlerts.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEV TEST BUTTON */}
      <button
        onClick={createTestOrder}
        disabled={isDevTesting}
        className="fixed bottom-6 right-6 z-[90] bg-slate-800 text-white shadow-xl shadow-slate-900/20 px-4 py-3 rounded-full flex items-center gap-2 font-bold text-sm hover:bg-slate-700 active:scale-95 transition-all"
      >
        {isDevTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-yellow-400" />}
        DEV: Test Order
      </button>
    </div>
  )
}
