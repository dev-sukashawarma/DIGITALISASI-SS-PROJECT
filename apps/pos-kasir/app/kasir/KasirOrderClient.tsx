'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  RefreshCw, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Banknote, ShoppingBag, Search, Loader2, CornerDownRight, ChefHat, Store, Globe, PlusCircle, BellRing, User, Plus, Info, Printer, MessageSquare, Zap, AlertTriangle, Flame
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { createClient } from '@/lib/supabase/client'
import { db, type LocalOrderRow } from '@/lib/db'
import {
  cacheOrders, readCachedTodayOrders, patchCachedOrder,
  patchLocalOrder, queueStatusMutation, isNetworkError, localOrderRowsToOrders,
  deleteLocalOrder, retryLocalOrderSync
} from '@/lib/offline'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import ChannelBadge from '@/components/ChannelBadge'
import StockMarquee from '@/components/StockMarquee'
import { useStockAlerts } from '@/lib/useStockAlerts'
import type { OrderWithItems, OrderStatus } from '@/types'
import { postToNative } from '@suka/design-system'
import { useDialogStore } from '@/lib/dialogStore'
import { triggerGoogleSheetsSyncIfActive } from '@/lib/google-sheets/google-sheets-webhook'
import { fetchWithTimeout } from '@/lib/offline-utils'
import { TimeAgo } from '@/components/kasir/TimeAgo'
import { parseOrderData, ParsedOrder } from '@/lib/order-utils'
import { printReceipt, type ReceiptData, type ReceiptLine } from '@/lib/printReceipt'
import { useBrand } from '@/components/BrandContext'
import { cleanItemName } from '@/lib/order-item-name'
import { usePrinterStore } from '@/lib/printerStore'

const DING_SOUND = '/sound-pesanan.mp3'

const FormattedNotes = ({ notes }: { notes: string }) => {
  if (!notes) return null;

  const hasOnlineInfo = notes.includes('-- INFO PEMESAN ONLINE --');
  const hasCustomerNote = notes.includes('-- CATATAN PELANGGAN --');

  if (hasOnlineInfo || hasCustomerNote) {
    let onlineInfoStr = '';
    let customerNoteStr = '';

    const parts = notes.split('-- CATATAN PELANGGAN --');
    if (parts.length === 2) {
      onlineInfoStr = parts[0].replace('-- INFO PEMESAN ONLINE --', '').trim();
      customerNoteStr = parts[1].trim();
    } else if (hasOnlineInfo) {
      onlineInfoStr = notes.replace('-- INFO PEMESAN ONLINE --', '').trim();
    } else if (hasCustomerNote) {
      customerNoteStr = notes.replace('-- CATATAN PELANGGAN --', '').trim();
    }

    return (
      <div className="flex flex-col gap-3 mt-1">
        {onlineInfoStr && (
          <div className="bg-white/60 rounded border border-orange-200/60 p-2">
            <div className="text-[10px] font-bold text-orange-800/60 uppercase mb-1 tracking-wider">Info Pemesan Online</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
              {onlineInfoStr.split('\n').map((line, i) => {
                if (!line.trim()) return null;
                const splitIndex = line.indexOf(':');
                if (splitIndex !== -1) {
                  const key = line.substring(0, splitIndex).trim();
                  const value = line.substring(splitIndex + 1).trim();
                  return (
                    <React.Fragment key={i}>
                      <div className="text-orange-900/70 font-medium">{key}</div>
                      <div className="text-orange-950 font-bold">{value}</div>
                    </React.Fragment>
                  );
                }
                return <div key={i} className="col-span-2 font-bold text-orange-950">{line.trim()}</div>;
              })}
            </div>
          </div>
        )}
        {customerNoteStr && (
          <div className="bg-white/60 rounded border border-orange-200/60 p-2">
            <div className="text-[10px] font-bold text-orange-800/60 uppercase mb-1 tracking-wider">Catatan Tambahan</div>
            <div className="text-sm font-semibold text-orange-950 whitespace-pre-wrap">{customerNoteStr}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm font-semibold text-orange-950 whitespace-pre-wrap leading-tight mt-1">
      {notes}
    </div>
  );
};

function buildReceiptItems(order: ParsedOrder): ReceiptLine[] {
  if (!order._parsedItems) {
    return order.order_items.map(item => {
      let name = item.menu_item_name || '';
      let note = item.notes || '';
      const noteSplit = name.split('|NOTE|');
      if (noteSplit.length > 1) { 
        note = (note ? note + ' - ' : '') + noteSplit[1].trim(); 
        name = noteSplit[0].trim(); 
      }
      const parentSplit = name.split('|PARENT|');
      if (parentSplit.length > 1) { name = parentSplit[0].trim(); }
      const idSplit = name.split('|ID|');
      if (idSplit.length > 1) { name = idSplit[0].trim(); }
      
      return {
        name: name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        note: note || undefined
      }
    })
  }

  const { rootItems, childrenMap } = order._parsedItems;
  const items: ReceiptLine[] = [];
  rootItems.forEach(root => {
    items.push({
      name: root.parsedName,
      note: root.parsedNote || undefined,
      quantity: root.quantity,
      unit_price: root.unit_price,
      subtotal: root.subtotal
    })
    // Include package sub-items as children in printed receipt
    const pkgItems: any[] = (root.menu_items?.is_package && root.menu_items?.package_items) ? root.menu_items.package_items : [];
    const pkgChoices: Record<string, string> = root.package_choices || {};
    pkgItems.forEach((pi: any) => {
      const chosenId = pkgChoices[pi.id];
      const displayName = chosenId && pi.or_menu_item_id && chosenId === pi.or_menu_item_id
        ? (pi.or_menu_item?.name || pi.menu_item?.name)
        : pi.menu_item?.name;
      if (displayName) {
        items.push({
          name: `  └ ${displayName}`,
          quantity: pi.quantity,
          unit_price: 0,
          subtotal: 0,
          isChild: true
        });
      }
    });
    if (childrenMap[root.parsedId]) {
      childrenMap[root.parsedId].forEach(child => {
        items.push({
          name: child.parsedName,
          note: child.parsedNote || undefined,
          quantity: child.quantity,
          unit_price: child.unit_price,
          subtotal: child.subtotal,
          isChild: true
        })
      })
    }
  })
  return items;
}



async function fetchTodayOrders(outletId: string): Promise<OrderWithItems[]> {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  try {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('orders')
        .select('*, order_items(*, menu_items(image_url, is_package, package_items:menu_packages!package_id(id, quantity, menu_item_id, or_menu_item_id, menu_item:menu_items!menu_item_id(id,name), or_menu_item:menu_items!or_menu_item_id(id,name))))')
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

  const ActiveOrderCard = React.memo(({ order, isLocal, isEstimatedFuture, handlersRef }: any) => {
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

    const { rootItems, childrenMap } = order._parsedItems;
    const { cancelOrder, markAsPreparing, handlePrintCustomerOnly, markAsCompleted, setReprintTargetOrder, deleteLocalOrder, retryLocalOrderSync } = handlersRef.current;

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
                <Clock size={10} /> dipesan <TimeAgo date={order.created_at} />
              </div>
              {isLocal && !order._sync_error && (
                <span className="mt-1.5 inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full w-max">
                  OFFLINE — belum sinkron
                </span>
              )}
              {isLocal && order._sync_error && (
                <span className="mt-1.5 inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full w-max">
                  <AlertTriangle size={10} /> Gagal Sinkron
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ring-1 shadow-sm ${badgeBg}`}>
                {isPending ? <Clock size={14} className="animate-pulse" /> : <ChefHat size={14} />}
                {isPending ? 'MENUNGGU' : 'DIPROSES'}
              </div>
              {isEstimatedFuture && (
                <div className="px-2 py-1 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  <Clock size={12} />
                  Estimasi Masak: {order._estimatedCookingTime} Menit
                </div>
              )}
            </div>
          </div>
          
          <div className="h-px bg-slate-100 w-full my-3"></div>

          {/* Customer / Source */}
          <div className="flex items-center gap-3 mb-4 bg-[#fff8f1] p-3 rounded-2xl">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              <User size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="font-black text-slate-900 text-base leading-tight truncate">
                  {order.customer_name || 'Pelanggan'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {order.source === 'online' ? (
                  <span className="flex items-center gap-1 uppercase font-bold text-[9px] tracking-wider bg-blue-50 px-1.5 py-0.5 rounded text-blue-600">
                    <Globe className="w-2.5 h-2.5" /> Online
                  </span>
                ) : order.channel ? (
                  <ChannelBadge channel={order.channel} />
                ) : (
                  <span className="flex items-center gap-1 uppercase font-bold text-[9px] tracking-wider bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                    <Store className="w-2.5 h-2.5" /> Offline
                  </span>
                )}
                <span className="uppercase font-bold text-[9px] tracking-wider bg-slate-200/80 px-2 py-0.5 rounded text-slate-800">
                  {order.payment_method?.toUpperCase() || 'CASH'}
                </span>
              </div>
            </div>
          </div>

          {/* Items List (Full Details with Tree Pattern) */}
          <div className="flex-1">
            <div className="space-y-1.5">
              {rootItems.map((oi: any) => {
                // Resolve package sub-items from menu_items.package_items
                const pkgItems: any[] = (oi.menu_items?.is_package && oi.menu_items?.package_items) ? oi.menu_items.package_items : [];
                // package_choices contains { [package_item_id]: chosen_menu_item_id }
                const pkgChoices: Record<string, string> = oi.package_choices || {};
                // hasChildren = explicit extra children OR package sub-items OR note
                const hasChildren = oi.parsedNote || (childrenMap[oi.parsedId] && childrenMap[oi.parsedId].length > 0) || pkgItems.length > 0;
                return (
                <div key={oi.id} className="py-1.5 relative border-b border-slate-100/70 last:border-0 last:pb-0">
                  {hasChildren && (
                    <div className={`absolute left-[11px] top-6 bottom-3 w-[2px] ${lineBg}`} />
                  )}

                  <div className="flex items-start gap-2 relative z-10">
                    <span className={`font-bold ${accentColor} text-sm w-6 shrink-0 text-center bg-white pt-1`}>{oi.quantity}x</span>
                    
                    {oi.menu_items?.image_url && (
                      <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-slate-50 border border-slate-100 shadow-sm relative">
                        <img 
                          src={oi.menu_items.image_url} 
                          alt={oi.parsedName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          width={36}
                          height={36}
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 mt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 leading-snug break-words">{oi.parsedName}</span>
                        {pkgItems.length > 0 && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>PAKET</span>
                        )}
                      </div>
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

                  {/* Package sub-items displayed as hierarchy */}
                  {pkgItems.map((pi: any) => {
                    // If user chose an alternative (or_menu_item), show that instead
                    const chosenId = pkgChoices[pi.id];
                    const displayName = chosenId && pi.or_menu_item_id && chosenId === pi.or_menu_item_id
                      ? pi.or_menu_item?.name || pi.menu_item?.name
                      : pi.menu_item?.name;
                    const isAlternative = chosenId && pi.or_menu_item_id && chosenId === pi.or_menu_item_id;
                    return (
                      <div key={pi.id} className="relative pl-[1.6rem] py-1 flex items-center gap-2">
                        <div className={`absolute left-[11px] top-1/2 -translate-y-1/2 w-3 h-[2px] ${lineBg}`} />
                        <span className="font-bold text-slate-400 text-xs w-5 shrink-0 text-right">{pi.quantity}x</span>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded-sm ${
                            isAlternative
                              ? (isPending ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700')
                              : (isPending ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600')
                          }`}>ISI</span>
                          <span className="text-xs font-semibold text-slate-700 break-words min-w-0">{displayName}</span>
                          {pi.or_menu_item_id && !isAlternative && (
                            <span className="text-[9px] text-slate-400 font-medium italic hidden sm:inline">atau {pi.or_menu_item?.name}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

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
                );
              })}
            </div>

            {/* Catatan Keseluruhan */}
            {renderOrderNotes(order.notes)}
          </div>
        </div>
              {/* Actions - BIG and CLEAR */}
        <div className="p-3 pt-0 mt-auto flex flex-col gap-2">
          {isLocal && order._sync_error && (
             <div className="mb-1 p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-[10px] font-bold text-red-800 mb-1">Gagal Mengirim ke Server:</p>
                <p className="text-[10px] font-medium text-red-600 break-words line-clamp-2">{order._sync_error}</p>
             </div>
          )}
          
          <div className="flex gap-2 w-full">
            {isLocal && order._sync_error ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteLocalOrder(order.id) }}
                  className="relative z-50 cursor-pointer w-1/3 flex flex-col items-center justify-center gap-1 bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-xl font-bold transition-all text-[11px]"
                >
                  <XCircle size={16} />
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); retryLocalOrderSync(order.id) }}
                  className="relative z-50 cursor-pointer w-2/3 flex flex-col items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl font-bold shadow-md transition-all text-[11px]"
                >
                  <RefreshCw size={16} />
                  Coba Ulang
                </button>
              </>
            ) : isPending && order.payment_method === 'qris' ? (
              <div className="flex-1 bg-blue-50/70 text-blue-600 font-bold py-3.5 rounded-xl border border-blue-100 flex items-center justify-center gap-2 cursor-wait text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                Tunggu QRIS
              </div>
            ) : (order as any).cancellation_status === 'pending_approval' ? (
              <div className="flex-1 bg-yellow-50 text-yellow-600 font-bold py-3.5 rounded-xl border border-yellow-200 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Menunggu Persetujuan Batal
              </div>
            ) : isPending ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancelOrder(order) }}
                  className="relative z-50 cursor-pointer w-1/3 flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 py-3.5 rounded-xl font-bold transition-all"
                >
                  <XCircle size={18} />
                  Batal
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsPreparing(order) }}
                  className="relative z-50 cursor-pointer w-2/3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
                >
                  <ChefHat size={18} />
                  Mulai Masak
                </button>
              </>
            ) : order.status === 'preparing' ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancelOrder(order) }}
                  className="relative z-50 cursor-pointer w-1/3 flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 py-3.5 rounded-xl font-bold transition-all"
                >
                  <XCircle size={18} />
                  Batal
                </button>
                {!order.kitchen_receipt_printed ? (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsPreparing(order) }}
                    className="relative z-50 cursor-pointer w-2/3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
                  >
                    <ChefHat size={18} />
                    Mulai Masak
                  </button>
                ) : !order.customer_receipt_printed ? (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrintCustomerOnly(order) }}
                    className="relative z-50 cursor-pointer w-2/3 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all"
                  >
                    <Printer size={18} />
                    Cetak Struk
                  </button>
                ) : (
                  <div className="w-2/3 flex gap-2 relative z-50">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsCompleted(order.id) }}
                      className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all"
                    >
                      <CheckCircle2 size={18} />
                      Selesai
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReprintTargetOrder(order) }}
                      className="cursor-pointer px-4 flex items-center justify-center bg-white border-2 border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-500 py-3.5 rounded-xl transition-all shadow-sm active:scale-95"
                      title="Cetak Ulang Struk"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
}, (prev, next) => prev.order === next.order && prev.isLocal === next.isLocal && prev.isEstimatedFuture === next.isEstimatedFuture);

export default function KasirOrderClient({ 
  initialOrders,
  serverOutletId
}: { 
  initialOrders?: OrderWithItems[],
  serverOutletId: string
}) {
  const { showConfirm, showAlert, showPrompt } = useDialogStore()
  const [expandedId, setExpand] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [preparingTab, setPreparingTab] = useState<'antrean' | 'terjadwal'>('antrean')
  const [now, setNow] = useState(() => Date.now())
  const [isDevTesting, setIsDevTesting] = useState(false)
  const [reprintTargetOrder, setReprintTargetOrder] = useState<ParsedOrder | null>(null)

  const createTestOrder = async () => {
    if (!outletId) return;
    setIsDevTesting(true);
    try {
      const response = await fetch('/api/dev/test-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ posOutletId: outletId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat pesanan di Sistem Order');
      }

      // Berhasil! Kasir akan segera menarik pesanan ini secara otomatis lewat OnlineOrderSync.
    } catch (err: any) {
      console.error(err);
      showAlert(`Gagal membuat test order: ${err.message}`);
    } finally {
      setIsDevTesting(false);
    }
  }


  // Audio state
  const [audioPermission, setAudioPermission] = useState(true)

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const knownOrderIds = useRef<Set<string>>(new Set((initialOrders || []).map(o => o.id)))
  const hasFetchedInitial = useRef<boolean>(!!initialOrders) // Set to true because we already have initial data from SSR

  const supabase = createClient()
  const queryClient = useQueryClient()
  const handlersRef = useRef<any>({})
  useEffect(() => {
    handlersRef.current = { cancelOrder, markAsPreparing, handlePrintCustomerOnly, markAsCompleted, setReprintTargetOrder, deleteLocalOrder, retryLocalOrderSync }
  })
  const { outletId: clientOutletId, outletName } = useMyOutlet()
  const { brandLogo } = useBrand()
  const { device, isConnecting } = usePrinterStore()
  const outletId = clientOutletId || serverOutletId // Fallback to SSR outletId to prevent flash

  const { criticalItems } = useStockAlerts(outletId)
  
  const shawarmaRemaining = useMemo(() => {
    if (!criticalItems || criticalItems.length === 0) return null;
    let minPortions = Infinity;
    criticalItems.forEach(item => {
      if (!item.projection_text) return
      const parts = item.projection_text.split(' atau ')
      parts.forEach(part => {
        const match = part.match(/(.*?)\s*\((\d+)\s*porsi\)/)
        if (match) {
          const menuName = match[1].trim()
          const portions = parseInt(match[2], 10)
          if (menuName.toLowerCase().includes('shawarma')) {
            minPortions = Math.min(minPortions, portions)
          }
        }
      })
    })
    return minPortions === Infinity ? null : minPortions;
  }, [criticalItems])

  const { data: serverOrders = (initialOrders || []), isLoading: loading, isFetched: ordersFetched } = useQuery({
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
  const localOrders = useMemo(() => localOrderRowsToOrders(localOrderRows ?? []), [localOrderRows]);
  const localOrderIds = useMemo(() => new Set(localOrders.map(o => o.id)), [localOrders]);

  const orders = useMemo(() => {
    const rawOrders = [...localOrders, ...serverOrders.filter(o => !localOrderIds.has(o.id))];

    return rawOrders.map(o => {
      if ((o as any)._parsedItems) return o as ParsedOrder;
      return parseOrderData(o);
    });
  }, [localOrders, localOrderIds, serverOrders])

  // Web Push Subscription
  useEffect(() => {
    if (!outletId) return;

    async function subscribeToPush() {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          let subscription = await registration.pushManager.getSubscription();
          
          if (!subscription) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              console.warn('Web Push permission denied');
              return;
            }

            const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (applicationServerKey) {
              const urlBase64ToUint8Array = (base64String: string) => {
                const padding = '='.repeat((4 - base64String.length % 4) % 4);
                const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) {
                  outputArray[i] = rawData.charCodeAt(i);
                }
                return outputArray;
              };

              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
              });
            }
          }
          
          if (subscription) {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription, outletId })
            });
          }
        } catch (err) {
          console.error('Failed to subscribe to Web Push:', err);
        }
      }
    }
    subscribeToPush();
  }, [outletId]);

  // Real-time subscription to prevent polling and ensure instant updates
  useEffect(() => {
    if (!outletId) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerInvalidate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
        queryClient.invalidateQueries({ queryKey: ['target_progress', outletId] })
      }, 300);
    };

    const channelName = `kasir-orders-realtime-${outletId}`
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`)
    if (existing) supabase.removeChannel(existing)

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` },
        () => triggerInvalidate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => triggerInvalidate()
      )
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
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

  // Tick setiap 30 detik agar transisi status terjadwal tetap berjalan
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
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

  // State and ref for tracking 10-minute urgent alerts
  const prevUrgentIds = useRef<Set<string>>(new Set())
  const [urgentAlerts, setUrgentAlerts] = useState<OrderWithItems[]>([])

  // Tracking pergerakan spesifik dari "Terjadwal" ke "Antrean Masak"
  useEffect(() => {
    // Determine current terjadwal and antreanMasak
    const currentTerjadwal = orders.filter(o => (o.status === 'pending' || o.status === 'preparing') && o._effectiveReleaseTime > now)
    const currentAntreanMasak = orders.filter(o => (o.status === 'pending' || o.status === 'preparing') && o._effectiveReleaseTime <= now)
    
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

  // Tracking pergerakan spesifik untuk sisa 10 menit (Urgent Escalation)
  useEffect(() => {
    // _effectiveReleaseTime is pickup - 20m. Urgent threshold is pickup - 10m,
    // which is _effectiveReleaseTime + 10m.
    const urgentThreshold = (o: ParsedOrder) => {
      return o._effectiveReleaseTime ? o._effectiveReleaseTime + (10 * 60 * 1000) : 0;
    }
    
    // Yg masih > 10 menit (termasuk yang baru jadi 20 menit)
    const preUrgent = orders.filter(o => o.order_type === 'scheduled' && (o.status === 'pending' || o.status === 'preparing') && urgentThreshold(o) > now)
    
    // Yg <= 10 menit
    const urgent = orders.filter(o => o.order_type === 'scheduled' && (o.status === 'pending' || o.status === 'preparing') && urgentThreshold(o) <= now)
    
    const preUrgentIds = new Set(preUrgent.map(o => o.id))
    const urgentIds = new Set(urgent.map(o => o.id))

    const justMovedUrgent: OrderWithItems[] = []
    
    for (const id of prevUrgentIds.current) {
      if (urgentIds.has(id)) {
        const order = urgent.find(o => o.id === id)
        if (order) justMovedUrgent.push(order)
      }
    }

    if (justMovedUrgent.length > 0) {
      playNotification() // Bunyikan bel
      setUrgentAlerts(prev => [...prev, ...justMovedUrgent]) // Tambahkan ke modal peringatan merah
    }

    prevUrgentIds.current = preUrgentIds
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
      let errMsg = error.message || 'Terjadi kesalahan sistem';
      if (errMsg.includes('Stok tidak cukup')) {
        errMsg = 'Stok bahan baku tidak mencukupi untuk memproses pesanan ini.';
      }
      showAlert(`Gagal mengupdate pesanan: ${errMsg}`)
      return false
    }
  }

  // Mark as Preparing
  async function markAsPreparing(order: ParsedOrder) {
    postToNative({ type: 'haptic', style: 'success' })
    const success = await applyStatusChange(order.id, { status: 'preparing', kitchen_receipt_printed: true })
    if (!success) return
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })

    // Generate and print kitchen receipt
    const receiptData: ReceiptData = {
      outletName: outletName || 'SUKA SHAWARMA',
      orderNumber: order.order_number,
      dateISO: new Date().toISOString(),
      customerName: order.customer_name,
      items: buildReceiptItems(order),
      subtotal: order.total_amount,
      discount: 0,
      total: order.total_amount,
      paymentMethod: order.payment_method === 'qris' ? 'qris' : 'cash',
      logoUrl: brandLogo || undefined,
      receiptType: 'kitchen'
    }
    
    printReceipt(receiptData)
  }

  // Mark as Completed
  async function markAsCompleted(id: string) {
    const targetOrder = orders?.find(o => o.id === id)
    if (targetOrder && !targetOrder.customer_receipt_printed) {
      showAlert('Pesanan belum dapat diselesaikan! Struk Pelanggan WAJIB dicetak terlebih dahulu.')
      return false
    }

    postToNative({ type: 'haptic', style: 'success' })
    const success = await applyStatusChange(id, { status: 'completed' })
    if (!success) return false
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
    queryClient.invalidateQueries({ queryKey: ['target_progress', outletId] })

    // Trigger Google Sheets Real-Time Sync
    if (targetOrder) {
      triggerGoogleSheetsSyncIfActive(
        supabase, 
        targetOrder, 
        targetOrder.order_items || [], 
        outletName || ''
      )
    }

    // Kalau order ini berasal dari website order online, teruskan notifikasi
    // ke order-system supaya WA "pesanan siap diambil" terkirim ke customer.
    fetch('/api/orders/notify-online-done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: id }),
    }).catch((err) => console.error('Gagal mengirim notifikasi online ke order-system:', err))
    return true
  }

  // Handle completion and print receipt
  async function handlePrintCustomerOnly(order: ParsedOrder) {
    // Generate and print receipt
    const receiptData: ReceiptData = {
      outletName: outletName || 'SUKA SHAWARMA',
      orderNumber: order.order_number,
      dateISO: new Date().toISOString(),
      customerName: order.customer_name,
      items: buildReceiptItems(order),
      subtotal: order.total_amount,
      discount: 0,
      total: order.total_amount,
      paymentMethod: order.payment_method === 'qris' ? 'qris' : 'cash',
      amountReceived: order.amount_received,
      changeAmount: order.change_amount,
      logoUrl: brandLogo || undefined,
      receiptType: 'customer'
    }

    try {
      await printReceipt(receiptData)
      const success = await applyStatusChange(order.id, { customer_receipt_printed: true })
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
      }
    } catch (err: any) {
      console.error('Print error:', err)
      const confirmManual = await showConfirm(
        `Printer Terputus: ${err.message || 'Gagal mengirim data ke printer'}. Apakah Anda ingin menandai Struk Pelanggan sudah dicetak secara manual?`
      )
      if (confirmManual) {
        await applyStatusChange(order.id, { customer_receipt_printed: true })
        queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
      }
    }
  }

  async function handleReprintReceipt(order: ParsedOrder, type: 'customer' | 'kitchen') {
    const receiptData: ReceiptData = {
      outletName: outletName || 'SUKA SHAWARMA',
      orderNumber: order.order_number,
      dateISO: new Date().toISOString(),
      customerName: order.customer_name,
      items: buildReceiptItems(order),
      subtotal: order.total_amount,
      discount: 0,
      total: order.total_amount,
      paymentMethod: order.payment_method === 'qris' ? 'qris' : 'cash',
      amountReceived: order.amount_received,
      changeAmount: order.change_amount,
      logoUrl: brandLogo || undefined,
      receiptType: type
    }

    try {
      await printReceipt(receiptData)
    } catch (err: any) {
      console.error('Print error:', err)
      useDialogStore.getState().showAlert(
        `Gagal Mencetak: ${err.message || 'Pastikan bluetooth menyala dan printer terhubung.'}`
      )
    } finally {
      setReprintTargetOrder(null)
    }
  }

  async function handleCompleteAndPrint(order: ParsedOrder) {
    await markAsCompleted(order.id)
    await handleReprintReceipt(order, 'customer')
  }

  // Cancel order
  async function cancelOrder(order: ParsedOrder) {
    if (order.status !== 'pending' && order.status !== 'preparing') {
      showAlert('Hanya pesanan aktif yang dapat dibatalkan.')
      return
    }

    const confirmed = await showConfirm('Batalkan pesanan ini secara permanen?')
    if (!confirmed) return

    const voidReason = await showPrompt('Alasan pembatalan (wajib):')
    if (!voidReason?.trim()) {
      showAlert('Alasan pembatalan wajib diisi!')
      return
    }

    postToNative({ type: 'haptic', style: 'warning' })
    
    // 1. Set cancellation_status ke pending_approval
    const success = await applyStatusChange(order.id, {
      cancellation_reason: voidReason,
      cancellation_status: 'pending_approval'
    })

    if (!success) return

    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })

    // 2. Request Magic Link & WA URL ke Leader
    try {
      const res = await fetch('/api/cancellations/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, reason: voidReason })
      })
      const data = await res.json()
      
      if (!res.ok) {
        showAlert('Pesanan menunggu pembatalan, tapi gagal membuat link WA: ' + (data.error || 'Unknown error'))
        return
      }

      // 3. Arahkan otomatis ke WA Leader
      if (data.waUrl) {
        window.open(data.waUrl, '_blank')
      }
    } catch (err) {
      console.error('Request cancellation error:', err)
      showAlert('Koneksi terputus. Gagal meminta persetujuan pembatalan ke Leader.')
    }
  }

  // Auto cancel orders pending > 5 hours
  useEffect(() => {
    if (!ordersFetched) return;
    
    const checkExpired = () => {
      const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000
      const expired = orders.filter(o => o.status === 'pending' && new Date(o.created_at).getTime() < fiveHoursAgo)
      
      if (expired.length > 0) {
        expired.forEach(async (order) => {
          try {
            const success = await applyStatusChange(order.id, {
              status: 'cancelled',
              void_reason: 'Otomatis batal karena melewati batas waktu 5 jam',
              void_at: new Date().toISOString()
            })
            if (!success) return; // Prevent side-effects if failed
            if (order.source === 'online' && order.external_order_id) {
              fetch('/api/orders/notify-online-cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: order.id }),
              }).catch(() => {})
            }
          } catch (err) {
            console.error('Failed to auto-cancel order', err)
          }
        })
        queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
      }
    }

    const t = setInterval(checkExpired, 60000)
    checkExpired()
    return () => clearInterval(t)
  }, [orders, outletId, queryClient, ordersFetched])

  const filteredOrders = orders.filter(o => {
    if (sourceFilter === 'all') return true
    if (sourceFilter === 'online') return o.source === 'online'
    if (sourceFilter === 'offline') return o.source !== 'online'
    return true
  })

  const pendingOrders = filteredOrders.filter((o) => o.status === 'pending').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const preparingOrders = filteredOrders.filter((o) => o.status === 'preparing').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  
  const antreanMasak = preparingOrders.filter(o => o._effectiveReleaseTime <= now)
  const terjadwalMasak = preparingOrders.filter(o => o._effectiveReleaseTime > now).sort((a, b) => a._effectiveReleaseTime - b._effectiveReleaseTime)

  // Hitung antrean global (tidak terpengaruh tab filter online/offline) untuk indikator Dapur Sibuk
  const globalAntreanMasak = orders.filter(o => o.status === 'preparing' && o._effectiveReleaseTime <= now)


  const completedOrders = filteredOrders.filter((o) => o.status === 'completed')
  const filteredCompletedOrders = completedOrders.filter(o => {
    if (!searchQuery) return true
    return o.order_number.toString().includes(searchQuery)
  })

  const todayRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0)

  // Helper untuk merender card pesanan aktif (Pending & Preparing)

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

      <StockMarquee />

      {/* ── Header & Stats ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-200">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Order</h1>
          {isMounted && outletName && (
            <div className="flex flex-col gap-1.5 mt-1">
              <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5 bg-[#f5ede3] px-3 py-1.5 rounded-lg w-max max-w-full border border-[#d9c2b2]">
                <Store className="w-4 h-4 text-[#f29744] shrink-0" />
                <span className="truncate">Anda berada di cabang: <strong className="text-[#1e1b15]">{outletName}</strong></span>
              </p>
              {shawarmaRemaining !== null && shawarmaRemaining < 7 && (
                <Link href="/kasir/info-porsi" className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg flex items-center w-max transition-colors shadow-sm">
                  <Flame className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                  Sisa Shawarma: {shawarmaRemaining === 0 ? 'HABIS' : `${shawarmaRemaining} Porsi`} <span className="ml-1 text-red-500/70 font-normal">(Klik Detail)</span>
                </Link>
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto shrink-0">
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

      {/* Printer Status Badge (Diletakkan di atas filter tabs sesuai permintaan) */}
      <div className="flex items-center mb-2">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${device ? 'bg-green-100/50 text-green-700 border-green-200/50' : 'bg-gray-100/50 text-gray-500 border-gray-200/50'}`}>
          <Printer className="w-3 h-3" />
          {device ? 'Printer Kasir Terhubung' : isConnecting ? 'Menghubungkan...' : 'Printer Kasir Belum Terhubung'}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 xl:gap-6 items-stretch pb-20">
        
        {/* ── Column 1: MENUNGGU PEMBAYARAN (Pending) ── */}
        <div className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-slate-800" />
              <h2 className="font-bold text-slate-800 text-xl">Menunggu Pembayaran</h2>
            </div>
            <span className="bg-[#701604]/10 text-slate-800 text-xs font-bold px-3 py-1 rounded-full">
              {pendingOrders.length} Pesanan
            </span>
          </div>

          <div className="flex-1 space-y-4">
            {loading ? (
              <div className="h-32 animate-pulse bg-gray-50 rounded-xl" />
            ) : pendingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-transparent">
                <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
                <p className="font-bold text-slate-500/60">Tidak ada pesanan tertunda</p>
                <p className="text-xs text-slate-500/40 mt-1">Pesanan baru akan muncul otomatis di sini.</p>
              </div>
            ) : (
              pendingOrders.map((order) => <ActiveOrderCard key={order.id} order={order} isLocal={localOrderIds.has(order.id)} isEstimatedFuture={order._effectiveReleaseTime > now} handlersRef={handlersRef} />)
            )}
          </div>
        </div>

        {/* ── Column 2: SEDANG DIPROSES (Preparing) ── */}
        <div className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col relative overflow-hidden">
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
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${preparingTab === 'antrean' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
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
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                terjadwalMasak.length > 0 
                  ? 'bg-red-500 text-white' 
                  : preparingTab === 'terjadwal' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
              }`}>
                {terjadwalMasak.length}
              </span>
            </button>
          </div>

          {/* Smart Indicator: Dapur Sibuk */}
          {(() => {
            if (preparingTab !== 'antrean') return null;
            
            // Hitung akumulasi per menu berdasarkan antrean global (tidak terpengaruh tab online/offline)
            const itemCounts: Record<string, number> = {};
            globalAntreanMasak.forEach(order => {
              order.order_items?.forEach(item => {
                const name = cleanItemName(item.menu_item_name);
                itemCounts[name] = (itemCounts[name] || 0) + (item.quantity || 1);
              });
            });

            // Filter menu yang menumpuk lebih dari 7 porsi
            const overflowingItems = Object.entries(itemCounts)
              .filter(([, count]) => count > 7)
              .sort((a, b) => b[1] - a[1]);

            // Jangan tampilkan jika tidak ada menu yang lewat batas
            if (overflowingItems.length === 0) return null;

            return (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 shrink-0 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <div className="flex items-center gap-2 text-red-600 font-bold">
                    <Flame className="w-5 h-5 animate-pulse" />
                    <span className="text-sm">MENU MENUMPUK</span>
                  </div>
                  <span className="text-[10px] text-red-500 font-medium">Tolong kru segera eksekusi massal!</span>
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {overflowingItems.map(([name, count]) => (
                      <span key={name} className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded text-xs font-semibold">
                        {count}x {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex-1 space-y-4 relative z-10">
            {preparingTab === 'antrean' ? (
              antreanMasak.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-transparent">
                  <ChefHat className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
                  <p className="font-bold text-slate-500/60">Tidak ada antrean masak</p>
                  <p className="text-xs text-slate-500/40 mt-1">Dapur sedang santai, pesanan aktif akan muncul di sini.</p>
                </div>
              ) : (
                antreanMasak.map((order) => <ActiveOrderCard key={order.id} order={order} isLocal={localOrderIds.has(order.id)} isEstimatedFuture={order._effectiveReleaseTime > now} handlersRef={handlersRef} />)
              )
            ) : (
              terjadwalMasak.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-transparent">
                  <Clock className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
                  <p className="font-bold text-slate-500/60">Tidak ada pesanan terjadwal</p>
                  <p className="text-xs text-slate-500/40 mt-1">Pesanan pre-order akan ditahan di sini sebelum masuk antrean.</p>
                </div>
              ) : (
                terjadwalMasak.map((order) => <ActiveOrderCard key={order.id} order={order} isLocal={localOrderIds.has(order.id)} isEstimatedFuture={order._effectiveReleaseTime > now} handlersRef={handlersRef} />)
              )
            )}
          </div>
        </div>

        {/* ── Column 3: COMPLETED (Selesai Hari Ini) ── */}
        <div className="bg-slate-50/50 border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col">
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

          <div className="flex-1 space-y-4">
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
                        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-0.5">
                          <p className="font-black text-slate-900 text-base leading-tight truncate">{order.customer_name || 'Pelanggan'}</p>
                          <p className="font-extrabold text-[#0a7d2c] text-sm">{formatRupiah(order.total_amount)}</p>
                        </div>
                        <p className="text-xs text-slate-500/60 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[#0a7d2c]"><TimeAgo date={order.created_at} /></span>
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
                            <span className="font-bold text-slate-800 text-sm w-6 shrink-0 text-center bg-white pt-1">{oi.quantity}x</span>
                            
                            {oi.menu_items?.image_url && (
                              <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-slate-50 border border-slate-100 shadow-sm relative">
                                <img 
                                  src={oi.menu_items.image_url} 
                                  alt={oi.parsedName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  width={36}
                                  height={36}
                                />
                              </div>
                            )}

                            <div className="min-w-0 flex-1 mt-0.5">
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

      {/* MODAL PESANAN TERJADWAL URGENT (10 MENIT) */}
      {urgentAlerts.length > 0 && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-red-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl shadow-red-900/40 border border-white/20 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10 animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-400 opacity-20 rounded-full blur-xl -ml-8 -mb-8"></div>
              
              <div className="flex justify-center mb-3 relative z-10">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm shadow-inner shadow-white/10">
                  <AlertTriangle size={32} className="text-white drop-shadow-md animate-pulse" />
                </div>
              </div>
              <h3 className="text-2xl font-black tracking-tight mb-1 relative z-10 drop-shadow-sm uppercase">Peringatan: 10 Menit!</h3>
              <p className="text-red-100 font-medium text-sm relative z-10">Segera Selesaikan! Pelanggan segera tiba!</p>
            </div>
            
            {/* Body */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-red-200">
                <div className="text-sm font-bold text-slate-500 uppercase">Nomor Antrian</div>
                <div className="text-3xl font-black text-slate-800 tracking-tighter text-red-600">
                  #{urgentAlerts[0].order_number || urgentAlerts[0].id.slice(0,4).toUpperCase()}
                </div>
              </div>

              {urgentAlerts[0].notes && (
                <div className="mb-4 bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-orange-800 mb-1 flex items-center gap-1">
                    <User size={12} /> Catatan / Info Pengambilan
                  </div>
                  <FormattedNotes notes={urgentAlerts[0].notes} />
                </div>
              )}

              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Daftar Menu</div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-[220px] overflow-y-auto">
                <div className="flex flex-col gap-1.5">
                  {(() => {
                    const orderItems = urgentAlerts[0].order_items || []
                    const parsed = orderItems.map((oi: any) => {
                      let name = oi.menu_item_name || ''
                      let note = ''
                      let id = oi.id
                      let parentId = null
                      let isExtra = false
                      let image_url = oi.menu_items?.image_url || null
                      
                      const match = name.match(/\[([^\]]+)\]\s*(.+)/)
                      if (match) {
                        isExtra = true
                        parentId = match[1]
                        name = match[2]
                      }
                      if (name.includes('(') && name.includes(')')) {
                        const noteMatch = name.match(/\(([^)]+)\)/)
                        if (noteMatch) {
                          note = noteMatch[1]
                          name = name.replace(/\([^)]+\)/, '').trim()
                        }
                      }
                      
                      return {
                        id,
                        name: name.trim(),
                        note,
                        quantity: oi.quantity,
                        isExtra,
                        parentId,
                        image_url
                      }
                    })

                    const items: any[] = []
                    parsed.forEach((oi: any) => {
                      if (!oi.isExtra) {
                        items.push({...oi, extras: []})
                      } else {
                        const parent = items.find(p => p.id === oi.parentId)
                        if (parent) {
                          parent.extras.push(oi)
                        } else {
                          items.push({...oi, extras: []})
                        }
                      }
                    })

                    return items.map((oi: any, idx: number) => (
                      <div key={idx} className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-slate-100 bg-white">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-3">
                            <div className="font-black text-slate-800 tabular-nums">
                              {oi.quantity}x
                            </div>
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                              {oi.image_url ? (
                                <img src={oi.image_url} alt={oi.name} className="w-full h-full object-cover" />
                              ) : (
                                <ChefHat size={20} className="text-slate-300" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-sm">{oi.name}</span>
                              {oi.note && (
                                <span className="text-xs text-slate-500 font-medium">({oi.note})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {oi.extras.length > 0 && (
                          <div className="flex mt-1">
                            <div className="w-4 flex-shrink-0 ml-1.5 flex flex-col items-center">
                              <div className="w-0.5 h-full bg-slate-200"></div>
                            </div>
                            <div className="flex-1 space-y-1.5 pl-2 pb-1">
                              {oi.extras.map((ex: any, exIdx: number) => (
                                <div key={exIdx} className="flex justify-between items-start">
                                  <div className="flex items-center gap-2 text-xs">
                                    <div className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">Extra</div>
                                    <span className="font-semibold text-slate-700">{ex.name}</span>
                                    {ex.note && <span className="text-slate-400 italic">({ex.note})</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={async () => {
                  const currentAlert = urgentAlerts[0]
                  if (currentAlert) {
                    const orderToComplete = filteredOrders.find(o => o.id === currentAlert.id)
                    if (orderToComplete) {
                      await handleCompleteAndPrint(orderToComplete)
                    } else {
                      // Fallback
                      await markAsCompleted(currentAlert.id)
                    }
                    setUrgentAlerts(prev => prev.slice(1))
                  }
                }}
                className="flex-1 bg-red-600 text-white font-bold text-base py-3.5 rounded-xl hover:bg-red-700 active:scale-95 transition-all shadow-md shadow-red-200"
              >
                Selesaikan Pesanan
              </button>
            </div>
            
            {urgentAlerts.length > 1 && (
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                1 of {urgentAlerts.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PESANAN TERJADWAL */}
      {scheduledAlerts.length > 0 && urgentAlerts.length === 0 && (
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
                <div className="text-sm font-bold text-slate-500 uppercase">Nomor Antrian</div>
                <div className="text-3xl font-black text-slate-800 tracking-tighter text-indigo-600">
                  #{scheduledAlerts[0].order_number || scheduledAlerts[0].id.slice(0,4).toUpperCase()}
                </div>
              </div>

              {scheduledAlerts[0].notes && (
                <div className="mb-4 bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-orange-800 mb-1 flex items-center gap-1">
                    <User size={12} /> Catatan / Info Pengambilan
                  </div>
                  <FormattedNotes notes={scheduledAlerts[0].notes} />
                </div>
              )}

              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Daftar Menu</div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-[220px] overflow-y-auto">
                <div className="flex flex-col gap-1.5">
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
                      
                      const idSplit = name.split('|ID|')
                      if (idSplit.length > 1) { id = idSplit[1]; name = idSplit[0] }
                      
                      return { ...oi, parsedName: name, parsedNote: note, parsedId: id, parsedParentId: parentId }
                    })

                    const rootItems = parsed.filter((i: any) => !i.parsedParentId)
                    const validRootIds = new Set(rootItems.map((r: any) => r.parsedId))
                    
                    const childrenMap: any = {}
                    parsed.filter((i: any) => i.parsedParentId).forEach((i: any) => {
                      if (!validRootIds.has(i.parsedParentId)) {
                        rootItems.push(i) // treat as root
                      } else {
                        if (!childrenMap[i.parsedParentId]) childrenMap[i.parsedParentId] = []
                        childrenMap[i.parsedParentId].push(i)
                      }
                    })

                    return rootItems.map((oi: any) => (
                      <div key={oi.id} className="py-1.5 relative border-b border-slate-100/70 last:border-0 last:pb-0">
                        {(oi.parsedNote || (childrenMap[oi.parsedId] && childrenMap[oi.parsedId].length > 0)) && (
                          <div className="absolute left-[11px] top-6 bottom-3 w-[2px] bg-indigo-200" />
                        )}

                        <div className="flex items-start gap-2 relative z-10">
                          <span className="font-bold text-indigo-600 text-sm w-6 shrink-0 text-center bg-slate-50">{oi.quantity}x</span>
                          
                          <div className="w-8 h-8 shrink-0 bg-white rounded-md overflow-hidden border border-slate-200 flex items-center justify-center shadow-sm">
                            {oi.menu_items?.image_url ? (
                              <img src={oi.menu_items.image_url} alt={oi.parsedName} className="w-full h-full object-cover" />
                            ) : (
                              <ChefHat className="text-slate-300 w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 mt-0.5">
                            <span className="text-sm font-semibold text-slate-800 leading-snug break-words">{oi.parsedName}</span>
                          </div>
                        </div>

                        {oi.parsedNote && (
                          <div className="relative pl-[1.6rem] mt-2 mb-1.5 flex items-start">
                            <div className="absolute left-[11px] top-2.5 w-3 h-[2px] bg-indigo-200" />
                            <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 text-[11px] px-2.5 py-1.5 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap min-w-0 flex-1">
                              {oi.parsedNote}
                            </div>
                          </div>
                        )}

                        {childrenMap[oi.parsedId] && childrenMap[oi.parsedId].map((child: any) => (
                          <div key={child.id} className="relative pl-[1.6rem] py-1.5 flex items-start gap-2">
                            <div className="absolute left-[11px] top-3.5 w-3 h-[2px] bg-indigo-200" />
                            <span className="font-bold text-slate-500 text-xs w-5 shrink-0 text-right mt-0.5">{child.quantity}x</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-slate-600 leading-snug flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1 rounded-sm">Extra</span>
                                <span className="break-words min-w-0 text-slate-700 font-semibold">{child.parsedName}</span>
                              </div>
                              {child.parsedNote && (
                                <div className="mt-1.5 bg-indigo-50 border border-indigo-100 text-indigo-900 text-[11px] px-2.5 py-1.5 rounded-md font-semibold leading-snug break-words whitespace-pre-wrap">
                                  {child.parsedNote}
                                </div>
                              )}
                            </div>
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

      {/* Modal Cetak Ulang Struk */}
      {reprintTargetOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setReprintTargetOrder(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Printer className="w-5 h-5 text-slate-500" />
                Cetak Ulang Struk
              </h3>
              <button 
                onClick={() => setReprintTargetOrder(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors"
              >
                <XCircle size={18} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-3">
              <p className="text-sm text-slate-600 font-medium mb-1 text-center">
                Pilih jenis struk yang ingin dicetak untuk pesanan <strong className="text-slate-800">#{reprintTargetOrder.order_number}</strong>:
              </p>
              
              <button
                onClick={() => handleReprintReceipt(reprintTargetOrder, 'customer')}
                className="flex items-center gap-3 w-full p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors text-left group"
              >
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border border-emerald-100 group-hover:scale-105 transition-transform">
                  <User className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-800 text-base">Struk Pelanggan</h4>
                  <p className="text-xs text-emerald-600/80 font-medium">Cetak struk untuk diberikan ke pelanggan</p>
                </div>
              </button>

              <button
                onClick={() => handleReprintReceipt(reprintTargetOrder, 'kitchen')}
                className="flex items-center gap-3 w-full p-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors text-left group"
              >
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border border-orange-100 group-hover:scale-105 transition-transform">
                  <ChefHat className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-bold text-orange-800 text-base">Struk Dapur</h4>
                  <p className="text-xs text-orange-600/80 font-medium">Cetak ulang struk pesanan untuk dapur</p>
                </div>
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setReprintTargetOrder(null)}
                className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 active:scale-95 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
