'use client'

import { useState } from 'react'
import {
  RefreshCw, ClipboardList, ChevronDown, ChevronUp,
  Clock, CheckCircle2, ChefHat, Banknote, XCircle, Store,
  QrCode, CreditCard, Activity
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'
import { cacheOrders, readCachedOrders, localOrderRowsToOrders } from '@/lib/offline'
import { useMyOutlet } from '@/lib/useMyOutlet'
import OrderSourceBadge from '@/components/OrderSourceBadge'
import { CHANNELS } from '@/lib/channels'
import { applyChannelFilter, matchesChannelFilter } from '@/lib/channel-filter'
import { formatRupiah } from '@/lib/validations'
import { Skeleton } from '@/components/Skeleton'
import type { OrderWithItems, OrderStatus } from '@/types'
import { useDialogStore } from '@/lib/dialogStore'
import { fetchWithTimeout } from '@/lib/offline-utils'
import CustomDatePicker from '@/components/CustomDatePicker'
import CustomSelect from '@/components/CustomSelect'

import BonusTab from './BonusTab'

const STATUS_CONF: Partial<Record<OrderStatus, {
  label: string; color: string; badge: string; icon: any
}>> = {
  pending:   { label: 'Menunggu',     color: 'text-yellow-600',  badge: 'badge-yellow', icon: Clock },
  completed: { label: 'Selesai',      color: 'text-gray-400',    badge: 'badge-gray',   icon: CheckCircle2 },
  cancelled: { label: 'Dibatalkan',   color: 'text-red-500',     badge: 'badge-red',    icon: XCircle },
}

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:   'completed',
}

const STATUS_NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending:   'Tandai Selesai',
}

async function fetchHistoriOrders(
  outletId: string, 
  filter: OrderStatus | 'all',
  dateFilter: string,
  customStart: string,
  customEnd: string,
  paymentFilter: string,
  channelFilter: string
): Promise<OrderWithItems[]> {
  const supabase = createClient()
  
  let startIso: string | null = null
  let endIso: string | null = null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (dateFilter === 'today') {
    startIso = today.toISOString()
  } else if (dateFilter === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayEnd = new Date(today)
    startIso = yesterday.toISOString()
    endIso = yesterdayEnd.toISOString()
  } else if (dateFilter === '7d') {
    const d7 = new Date(today)
    d7.setDate(d7.getDate() - 7)
    startIso = d7.toISOString()
  } else if (dateFilter === '30d') {
    const d30 = new Date(today)
    d30.setDate(d30.getDate() - 30)
    startIso = d30.toISOString()
  } else if (dateFilter === 'custom' && customStart && customEnd) {
    const start = new Date(customStart)
    start.setHours(0,0,0,0)
    const end = new Date(customEnd)
    end.setHours(23,59,59,999)
    startIso = start.toISOString()
    endIso = end.toISOString()
  }

  try {
    let q = supabase.from('orders').select('*, order_items(id, menu_item_name, quantity, subtotal)')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false })
      
    if (filter !== 'all') {
      if (filter === 'cancelled') {
        q = q.or('status.eq.cancelled,cancellation_status.eq.pending_approval')
      } else {
        q = q.eq('status', filter)
      }
    }
    
    if (paymentFilter !== 'all') q = q.eq('payment_method', paymentFilter)
    q = applyChannelFilter(q, channelFilter)

    if (startIso) q = q.gte('created_at', startIso)
    if (endIso) q = q.lte('created_at', endIso)
    
    if (dateFilter === 'all') {
       q = q.limit(100)
    }

    const { data, error } = await fetchWithTimeout(q.then(res => res))
    if (error) throw new Error(error.message)
    if (filter === 'all' && dateFilter === 'today') {
      await cacheOrders(outletId, data ?? []).catch(() => {})
    }
    return data ?? []
  } catch (err) {
    console.warn('[Histori] Fetch gagal, memakai cache IndexedDB:', err)
    const [cached, localRows] = await Promise.all([
      readCachedOrders(outletId),
      db.local_orders.where('outlet_id').equals(outletId).toArray(),
    ])
    const localList = localOrderRowsToOrders(localRows)
    const localIds = new Set(localList.map(o => o.id))
    const merged = [...localList, ...cached.filter(o => !localIds.has(o.id))]
    let result = filter === 'all' 
      ? merged 
      : (filter === 'cancelled' 
          ? merged.filter(o => o.status === 'cancelled' || (o as any).cancellation_status === 'pending_approval')
          : merged.filter(o => o.status === filter))
    
    if (startIso) result = result.filter(o => o.created_at >= startIso!)
    if (endIso) result = result.filter(o => o.created_at <= endIso!)
    
    if (paymentFilter !== 'all') result = result.filter(o => o.payment_method === paymentFilter)
    result = result.filter(o => matchesChannelFilter(o as any, channelFilter))

    return result
  }
}

export default function AdminOrdersPage() {
  const { showConfirm } = useDialogStore()
  const [activeTab, setActiveTab] = useState<'histori' | 'bonus'>('histori')
  const [filter, setFilter]     = useState<OrderStatus | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<string>('today')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [expandedId, setExpand] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const { outletId, outletName } = useMyOutlet()
  const queryClient = useQueryClient()
  const [visibleCount, setVisibleCount] = useState(20)

  const { data: orders = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['histori', outletId, filter, dateFilter, customStart, customEnd, paymentFilter, channelFilter],
    queryFn: () => fetchHistoriOrders(outletId as string, filter, dateFilter, customStart, customEnd, paymentFilter, channelFilter),
    enabled: !!outletId && activeTab === 'histori',
    refetchInterval: dateFilter === 'today' ? 15000 : false,
    staleTime: 15000,
    retry: false,
  })

  async function updateStatus(id: string, status: OrderStatus) {
    const supabase = createClient()
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['histori', outletId] })
  }

  const filteredOrders = orders.filter((order) => {
    if (paymentFilter !== 'all' && order.payment_method !== paymentFilter) return false;
    return matchesChannelFilter(order as any, channelFilter);
  });

  const getGrossAmount = (o: any) =>
    (Number(o.total_amount) || 0) + (Number(o.discount_amount) || 0) + (Number(o.promo_subsidy) || 0)

  const totalRevenue = filteredOrders
    .filter((o) => o.status !== 'cancelled' && (o as any).cancellation_status !== 'pending_approval')
    .reduce((s, o) => s + getGrossAmount(o), 0)

  const revenueCash = filteredOrders
    .filter((o) => o.status !== 'cancelled' && (o as any).cancellation_status !== 'pending_approval' && o.payment_method === 'cash')
    .reduce((s, o) => s + getGrossAmount(o), 0)

  const revenueQris = filteredOrders
    .filter((o) => o.status !== 'cancelled' && (o as any).cancellation_status !== 'pending_approval' && o.payment_method === 'qris')
    .reduce((s, o) => s + getGrossAmount(o), 0)

  const revenueDebit = filteredOrders
    .filter((o) => o.status !== 'cancelled' && (o as any).cancellation_status !== 'pending_approval' && o.payment_method === 'card')
    .reduce((s, o) => s + getGrossAmount(o), 0)

  return (
    <div className="space-y-6" suppressHydrationWarning>

      {/* ── Page title & Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Histori & Bonus</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {outletName && (
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                <Store className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-bold text-gray-700">{outletName}</span>
              </p>
            )}
            {activeTab === 'histori' && <p className="text-gray-400 text-xs">Auto-refresh setiap 15 detik</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('histori')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'histori' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Histori Pesanan
          </button>
          <button
            onClick={() => setActiveTab('bonus')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'bonus' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Lihat Bonus
          </button>
        </div>
      </div>

      {activeTab === 'bonus' ? (
        <BonusTab />
      ) : (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => refetch()}
              className="btn-secondary py-2 px-4 text-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 bg-white text-gray-900 border border-gray-100">
          <div className="w-9 h-9 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3">
            <Banknote className="w-4.5 h-4.5 text-emerald-600" strokeWidth={1.5} />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Tunai / Cash</p>
          <p className="text-xl font-bold mt-0.5 leading-tight text-emerald-600">{formatRupiah(revenueCash)}</p>
        </div>

        <div className="card p-5 bg-white text-gray-900 border border-gray-100">
          <div className="w-9 h-9 bg-blue-100 rounded-2xl flex items-center justify-center mb-3">
            <QrCode className="w-4.5 h-4.5 text-blue-600" strokeWidth={1.5} />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">QRIS</p>
          <p className="text-xl font-bold mt-0.5 leading-tight text-blue-600">{formatRupiah(revenueQris)}</p>
        </div>

        <div className="card p-5 bg-white text-gray-900 border border-gray-100">
          <div className="w-9 h-9 bg-purple-100 rounded-2xl flex items-center justify-center mb-3">
            <CreditCard className="w-4.5 h-4.5 text-purple-600" strokeWidth={1.5} />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Debit / Card</p>
          <p className="text-xl font-bold mt-0.5 leading-tight text-purple-600">{formatRupiah(revenueDebit)}</p>
        </div>

        {/* Revenue card */}
        <div className="card p-5 bg-amber-500 text-white">
          <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            <Activity className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
          </div>
          <p className="text-xs font-semibold text-amber-100/80 uppercase tracking-widest">Omzet Kotor</p>
          <p className="text-xl font-bold mt-0.5 leading-tight">{formatRupiah(totalRevenue)}</p>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="flex gap-2 flex-wrap items-center">
            {(['all', ...Object.keys(STATUS_CONF)] as (OrderStatus | 'all')[]).map((s) => (
              <button
                key={s}
                onClick={() => { setFilter(s); setVisibleCount(20); }}
                className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all
                  ${filter === s
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'}`}
              >
                {s === 'all' ? 'Semua Pesanan' : STATUS_CONF[s as keyof typeof STATUS_CONF]?.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
            <CustomSelect
              className="flex-1 sm:flex-none"
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val)
                setVisibleCount(20)
                if (val !== 'custom') {
                  setCustomStart('')
                  setCustomEnd('')
                }
              }}
              options={[
                { value: 'today', label: 'Hari Ini' },
                { value: 'yesterday', label: 'Kemarin' },
                { value: '7d', label: '7 Hari Terakhir' },
                { value: '30d', label: '30 Hari Terakhir' },
                { value: 'all', label: 'Semua Waktu' },
                { value: 'custom', label: 'Custom Tanggal' },
              ]}
            />

            <CustomSelect
              className="flex-1 sm:flex-none"
              value={channelFilter}
              onChange={setChannelFilter}
              options={[
                { value: 'all', label: 'Semua Channel' },
                { value: 'offline', label: 'Offline / Dine-in' },
                ...CHANNELS.map(c => ({ value: c.id, label: c.label }))
              ]}
            />

            <CustomSelect
              className="flex-1 sm:flex-none"
              value={paymentFilter}
              onChange={setPaymentFilter}
              options={[
                { value: 'all', label: 'Semua Pembayaran' },
                { value: 'cash', label: 'Tunai (Cash)' },
                { value: 'qris', label: 'QRIS' },
                { value: 'card', label: 'Debit Card/Kartu Debit' },
              ]}
            />
          </div>
        </div>
        
        {dateFilter === 'custom' && (
          <div className="flex gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200 xl:self-end">
            <CustomDatePicker label="Mulai Tanggal" value={customStart} onChange={setCustomStart} />
            <span className="text-gray-400 mt-5">-</span>
            <CustomDatePicker label="Sampai Tanggal" value={customEnd} onChange={setCustomEnd} />
          </div>
        )}
      </div>

      {/* ── Order list ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
               <div className="flex items-center gap-4">
                 <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
                 <div className="flex-1 space-y-2">
                   <Skeleton className="h-4 w-1/4 rounded-full" />
                   <Skeleton className="h-3 w-1/3 rounded-full" />
                 </div>
                 <Skeleton className="h-8 w-24 rounded-full" />
               </div>
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card p-14 flex flex-col items-center text-center text-gray-400">
          <ClipboardList className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1} />
          <p className="font-semibold text-gray-500">Belum ada pesanan</p>
          <p className="text-sm mt-1">
            {filter !== 'all' ? 'Tidak ada pesanan dengan status ini' : 'Pesanan akan muncul di sini'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.slice(0, visibleCount).map((order) => {
            const conf = STATUS_CONF[order.status as OrderStatus] || { label: order.status, color: 'text-gray-500', badge: 'badge-gray', icon: Clock }
            const Icon = conf.icon
            const expanded = expandedId === order.id
            return (
              <div key={order.id} className="card overflow-hidden transition-shadow hover:shadow-card-hover">

                {/* Row header */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
                  onClick={() => setExpand(expanded ? null : order.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                    {/* Order number */}
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-amber-600 text-sm leading-none">
                        #{order.order_number}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${conf.badge} flex items-center gap-1`}>
                          <Icon className="w-3 h-3" />
                          {conf.label}
                        </span>
                        <OrderSourceBadge
                          channel={order.channel}
                          salesSource={(order as any).sales_source}
                          isEndorse={(order as any).is_endorse}
                          size="sm"
                        />
                        {order.customer_name && (
                          <span className="text-sm font-semibold text-gray-700">{order.customer_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center flex-wrap gap-1">
                        <span>
                          {new Date(order.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', 
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        <span>{'·'}</span>
                        <span>{order.order_items.filter(oi => !oi.menu_item_name.includes('|PARENT|')).length} pesanan</span>
                        {(order as any).cashier_name && (
                          <>
                            <span>{'·'}</span>
                            <span className="font-medium text-gray-600">Kasir: {(order as any).cashier_name}</span>
                          </>
                        )}
                      </p>
                      
                      {/* Removed cancellation_user_name render */}
                      {order.status !== 'cancelled' && (order as any).cancellation_status === 'pending_approval' && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">
                            Menunggu Persetujuan Batal
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto flex-shrink-0">
                    <div className="text-right flex-1 sm:flex-none">
                      <p className="font-bold text-gray-900 flex items-center justify-start sm:justify-end gap-2">
                        {formatRupiah(order.total_amount)}
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase">
                          {order.payment_method}
                        </span>
                      </p>
                    </div>
                    <div className="w-7 h-7 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                      {expanded
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4 animate-fade-in">

                    {/* Items */}
                    <div className="grid gap-1.5">
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
                              <div className="absolute left-[9px] top-6 bottom-4 w-[2px] bg-gray-200" />
                            )}

                            {/* Parent Row */}
                            <div className="flex justify-between text-sm items-start gap-2">
                              <div className="text-gray-600 flex items-start gap-2.5 min-w-0 flex-1">
                                <span className="w-5 h-5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md flex items-center justify-center flex-shrink-0 relative z-10 mt-0.5">
                                  {oi.quantity}
                                </span>
                                <span className="font-medium text-gray-800 break-words min-w-0 flex-1 leading-snug">{oi.parsedName}</span>
                              </div>
                              <span className="font-semibold text-gray-900 flex-shrink-0">{formatRupiah(oi.subtotal)}</span>
                            </div>

                            {/* Parent Note */}
                            {oi.parsedNote && (
                              <div className="relative pl-[1.6rem] mt-1.5 mb-1.5 flex items-start">
                                <div className="absolute left-[9px] top-2.5 w-3 h-[2px] bg-gray-200" />
                                <div className="text-[11px] text-amber-600 italic bg-amber-50 border border-amber-100/50 px-2 py-1 rounded-md block break-words whitespace-pre-wrap min-w-0 flex-1 font-medium leading-snug">
                                  "{oi.parsedNote}"
                                </div>
                              </div>
                            )}

                            {/* Children / Extras */}
                            {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                              <div key={child.id} className="relative pl-[1.6rem] py-1 flex justify-between text-sm items-start gap-2">
                                {/* Branch indicator */}
                                <div className="absolute left-[9px] top-3 w-3 h-[2px] bg-gray-200" />
                                <div className="text-gray-600 flex items-start gap-2 min-w-0 flex-1">
                                  <span className="w-4 text-[10px] font-bold text-center mt-0.5 shrink-0">{child.quantity}x</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="leading-snug font-medium flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1 rounded-sm">Extra</span>
                                      <span className="break-words min-w-0">{child.parsedName}</span>
                                    </div>
                                    {child.parsedNote && (
                                      <div className="relative mt-1 flex items-start">
                                        <div className="text-[10px] text-amber-600 italic bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded-md block break-words whitespace-pre-wrap min-w-0 flex-1 font-medium leading-snug">
                                          "{child.parsedNote}"
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

                    {(() => {
                      const itemsSubtotal = order.order_items.reduce((sum, item) => sum + item.subtotal, 0);
                      const discountAmount = Math.max(0, itemsSubtotal - order.total_amount);
                      
                      if (discountAmount > 0) {
                        return (
                          <div className="mt-3 py-2 flex justify-between text-sm items-center gap-2 border-t border-red-100 bg-red-50/50 rounded-lg px-3">
                            <span className="font-semibold text-red-600">Diskon / Promo</span>
                            <span className="font-bold text-red-600 flex-shrink-0">
                              - {formatRupiah(discountAmount)}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {order.notes && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-amber-800 break-words whitespace-pre-wrap">
                        <span className="font-semibold">Catatan: </span>{order.notes}
                      </div>
                    )}

                    {order.status === 'cancelled' && ((order as any).cancellation_reason || (order as any).void_reason) && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-800 break-words whitespace-pre-wrap">
                        <span className="font-semibold">Alasan Batal: </span>{(order as any).cancellation_reason || (order as any).void_reason}
                      </div>
                    )}

                    {order.status !== 'cancelled' && (order as any).cancellation_status === 'pending_approval' && (
                      <div className="bg-yellow-50 border border-yellow-100 rounded-2xl px-4 py-3 text-sm text-yellow-800 break-words whitespace-pre-wrap">
                        <div className="font-semibold mb-1">Permintaan Batal (Menunggu Persetujuan)</div>
                        {((order as any).cancellation_reason || (order as any).void_reason) && (
                          <div><span className="font-medium">Alasan: </span>{(order as any).cancellation_reason || (order as any).void_reason}</div>
                        )}
                      </div>
                    )}

                    {order.payment_method === 'qris' && order.payment_proof_url && (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-700">
                          <QrCode className="w-4 h-4" />
                          <span className="font-semibold">Bukti Transfer QRIS</span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setPreviewImage(order.payment_proof_url ?? null); }}
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-xs shadow-sm transition-colors"
                        >
                          Lihat Foto
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {STATUS_NEXT[order.status as OrderStatus] && (
                        <button
                          onClick={() => updateStatus(order.id, STATUS_NEXT[order.status as OrderStatus]!)}
                          className="btn-primary py-2 px-5 text-sm"
                        >
                          {STATUS_NEXT_LABEL[order.status as OrderStatus]}
                        </button>
                      )}

                    </div>
                  </div>
                )}
              </div>
            )
          })}
          
          {visibleCount < filteredOrders.length && (
            <div className="pt-4 flex justify-center pb-8">
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-semibold py-2.5 px-6 rounded-xl shadow-sm transition-all"
              >
                Tampilkan Lebih Banyak ({filteredOrders.length - visibleCount} tersisa)
              </button>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 md:-right-12 text-white hover:text-gray-300 p-2"
            >
              <XCircle className="w-8 h-8" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage} alt="Bukti Pembayaran" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
