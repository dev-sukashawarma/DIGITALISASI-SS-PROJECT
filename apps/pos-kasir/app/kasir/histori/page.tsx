'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, ClipboardList, ChevronDown, ChevronUp,
  Clock, CheckCircle2, ChefHat, Banknote, XCircle, Store
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import type { OrderWithItems, OrderStatus } from '@/types'

const STATUS_CONF: Partial<Record<OrderStatus, {
  label: string; color: string; badge: string; icon: React.ElementType
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

export default function AdminOrdersPage() {
  const [orders, setOrders]     = useState<OrderWithItems[]>([])
  const [filter, setFilter]     = useState<OrderStatus | 'all'>('all')
  const [loading, setLoading]   = useState(true)
  const [expandedId, setExpand] = useState<string | null>(null)
  const { outletId, outletName, loaded: outletLoaded } = useMyOutlet()

  const fetchOrders = useCallback(async () => {
    if (!outletId) return // hanya pesanan cabang kasir ini
    const supabase = createClient()
    const q = supabase.from('orders').select('*, order_items(*)')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false }).limit(100)
    if (filter !== 'all') q.eq('status', filter)
    const { data } = await q
    setOrders(data ?? [])
    setLoading(false)
  }, [filter, outletId])

  useEffect(() => {
    fetchOrders()
    const iv = setInterval(fetchOrders, 15000)
    return () => clearInterval(iv)
  }, [fetchOrders])

  // Jangan biarkan loading menggantung bila kasir tak terhubung outlet
  useEffect(() => {
    if (outletLoaded && !outletId) setLoading(false)
  }, [outletLoaded, outletId])

  async function updateStatus(id: string, status: OrderStatus) {
    const supabase = createClient()
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    fetchOrders()
  }

  const todayRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.total_amount, 0)

  const statCards = [
    { status: 'pending' as OrderStatus,   label: 'Menunggu',   icon: Clock },
    { status: 'completed' as OrderStatus, label: 'Selesai',    icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-6">

      {/* ── Page title ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Pesanan</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {outletName && (
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                <Store className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-bold text-gray-700">{outletName}</span>
              </p>
            )}
            <p className="text-gray-400 text-xs">Auto-refresh setiap 15 detik</p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="btn-secondary py-2 px-4 text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ status, label, icon: Icon }) => {
          const count = orders.filter((o) => o.status === status).length
          const active = filter === status
          const conf = STATUS_CONF[status]!
          return (
            <button
              key={status}
              onClick={() => setFilter(active ? 'all' : status)}
              className={`card p-5 text-left transition-all hover:shadow-card-hover hover:-translate-y-0.5
                ${active ? 'ring-2 ring-amber-400' : ''}`}
            >
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center mb-3
                ${active ? 'bg-amber-500' : 'bg-gray-100'}`}>
                <Icon className={`w-4.5 h-4.5 ${active ? 'text-white' : 'text-gray-400'}`} strokeWidth={1.5} />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
              <p className={`text-3xl font-bold mt-0.5 ${conf.color}`}>{count}</p>
            </button>
          )
        })}

        {/* Revenue card */}
        <div className="card p-5 bg-amber-500 text-white col-span-2 md:col-span-1">
          <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            <Banknote className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
          </div>
          <p className="text-xs font-semibold text-amber-100/80 uppercase tracking-widest">Revenue Hari Ini</p>
          <p className="text-xl font-bold mt-0.5 leading-tight">{formatRupiah(todayRevenue)}</p>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['all', ...Object.keys(STATUS_CONF)] as (OrderStatus | 'all')[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all
              ${filter === s
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'}`}
          >
            {s === 'all' ? 'Semua Pesanan' : STATUS_CONF[s as keyof typeof STATUS_CONF]?.label}
          </button>
        ))}
      </div>

      {/* ── Order list ── */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-14 flex flex-col items-center text-center text-gray-400">
          <ClipboardList className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1} />
          <p className="font-semibold text-gray-500">Belum ada pesanan</p>
          <p className="text-sm mt-1">
            {filter !== 'all' ? 'Tidak ada pesanan dengan status ini' : 'Pesanan akan muncul di sini'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => {
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
                        {order.customer_name && (
                          <span className="text-sm font-semibold text-gray-700">{order.customer_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.created_at).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                        {' · '}{order.order_items.filter(oi => !oi.menu_item_name.includes('|PARENT|')).length} pesanan utama
                      </p>
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

                    {order.notes && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-amber-800 break-words whitespace-pre-wrap">
                        <span className="font-semibold">Catatan: </span>{order.notes}
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
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => { if (confirm('Batalkan pesanan ini?')) updateStatus(order.id, 'cancelled') }}
                          className="btn-danger py-2 px-4 text-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
