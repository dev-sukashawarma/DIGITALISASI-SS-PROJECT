'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingBag, Loader2,
  CheckCircle2, X, StickyNote, Banknote, QrCode, Sandwich, Store, Globe, Printer,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import { CHANNELS, getChannel } from '@/lib/channels'
import { usePromos } from '@/lib/usePromos'
import type { MenuItem, Category } from '@/types'
import { postToNative } from '@suka/design-system'
import { WalkInCartPanel, type Payment as WalkInPayment } from '@/components/kasir/WalkInCartPanel'
import { printReceipt, type ReceiptData } from '@/lib/printReceipt'

type Mode = 'walkin' | 'online'

interface Line {
  item: MenuItem
  quantity: number
  note: string
}

type Payment = 'cash' | 'qris'

export default function OrderManualPage() {
  const supabase = createClient()
  const { outletId, outletName, loaded } = useMyOutlet()
  const { calculateItemPrice, calculateGlobalDiscount, globalPromo } = usePromos(outletId || undefined)

  // Mode halaman: "walkin" (pelanggan datang langsung ke kasir) atau
  // "online" (input pesanan dari channel eksternal). Default walk-in.
  const [mode, setMode] = useState<Mode>('walkin')

  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')

  // Keranjang lokal (terisolasi dari cart kiosk pelanggan)
  const [lines, setLines] = useState<Record<string, Line>>({})
  const [channel, setChannel] = useState<string | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [customerName, setCustomerName] = useState('')

  const [cartOpen, setCartOpen] = useState(false) // bottom sheet di mobile
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<number | null>(null)

  // ── State khusus jalur walk-in (kasir langsung) ───────────────────────────
  const [walkInSubmitting, setWalkInSubmitting] = useState(false)
  const [walkInError, setWalkInError] = useState<string | null>(null)
  const [walkInSuccess, setWalkInSuccess] = useState<
    { orderNumber: number; method: WalkInPayment; change: number | null; receipt: ReceiptData } | null
  >(null)
  // Bumped setelah transaksi sukses untuk me-remount panel (reset input tunai).
  const [walkInPanelKey, setWalkInPanelKey] = useState(0)

  // ── Ambil menu sesuai outlet ──────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    if (!outletId) { setLoading(false); return }

    async function fetchMenu() {
      setLoading(true)
      const [{ data: m }, { data: c }, { data: unav }] = await Promise.all([
        supabase.from('menu_items')
          .select('*, categories(id,name,sort_order)')
          .or(`outlet_id.is.null,outlet_id.eq.${outletId}`)
          .order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('kiosk_settings').select('value')
          .eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle(),
      ])
      setItems(m ?? [])
      setCategories(c ?? [])
      try {
        setUnavailableIds(new Set(unav?.value ? JSON.parse(unav.value) : []))
      } catch { setUnavailableIds(new Set()) }
      setLoading(false)
    }
    fetchMenu()
  }, [supabase, outletId, loaded])

  // ── Menu terfilter (tersedia + kategori + pencarian) ──────────────────────
  const visibleItems = useMemo(() => {
    return items.filter((it) => {
      if (it.is_available === false) return false
      if (unavailableIds.has(it.id)) return false
      if (activeCat !== 'all' && it.category_id !== activeCat) return false
      if (search.trim() && !it.name.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [items, unavailableIds, activeCat, search])

  // ── Helper keranjang ──────────────────────────────────────────────────────
  const addItem = useCallback((item: MenuItem) => {
    setLines((prev) => {
      const ex = prev[item.id]
      const quantity = Math.min((ex?.quantity ?? 0) + 1, 10)
      return { ...prev, [item.id]: { item, quantity, note: ex?.note ?? '' } }
    })
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      if (!prev[id]) return prev
      return { ...prev, [id]: { ...prev[id], quantity: Math.min(qty, 10) } }
    })
  }, [])

  const setNote = useCallback((id: string, note: string) => {
    setLines((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], note } } : prev)
  }, [])

  const lineList = Object.values(lines)
  const totalItems = lineList.reduce((s, l) => s + l.quantity, 0)
  
  const baseSubtotal = lineList.reduce((s, l) => s + l.item.price * l.quantity, 0)
  const wrappedCalculateItemPrice = (price: number, id: string) => calculateItemPrice(price, id, baseSubtotal)

  const subtotalAmount = lineList.reduce((s, l) => s + wrappedCalculateItemPrice(l.item.price, l.item.id) * l.quantity, 0)
  const globalDiscount = calculateGlobalDiscount(subtotalAmount)
  const totalPrice = subtotalAmount - globalDiscount

  const isGlobalPromoActive = globalPromo && globalPromo.is_active && (!globalPromo.end_date || new Date(globalPromo.end_date).getTime() > Date.now());
  const needsMoreForPromo = isGlobalPromoActive && globalPromo.min_purchase && subtotalAmount > 0 && subtotalAmount < globalPromo.min_purchase;
  const missingAmount = needsMoreForPromo ? (globalPromo.min_purchase || 0) - subtotalAmount : 0;

  const canSubmit = lineList.length > 0 && !!channel && !!payment && !submitting

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          payment_method: payment,
          customer_name: customerName,
          items: lineList.map((l) => ({
            menu_item_id: l.item.id,
            quantity: l.quantity,
            note: l.note,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        postToNative({ type: 'haptic', style: 'error' })
        setError(data.error ?? 'Gagal membuat pesanan')
        setSubmitting(false)
        return
      }
      postToNative({ type: 'haptic', style: 'success' })
      setSuccess(data.order_number)
      // reset untuk order berikutnya
      setLines({})
      setChannel(null)
      setPayment(null)
      setCustomerName('')
      setCartOpen(false)
    } catch {
      postToNative({ type: 'haptic', style: 'error' })
      setError('Tidak dapat terhubung ke server')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit walk-in (kasir langsung) ───────────────────────────────────────
  async function handleWalkInPay(method: WalkInPayment, amountReceived: number | null) {
    if (lineList.length === 0 || walkInSubmitting) return
    setWalkInSubmitting(true)
    setWalkInError(null)

    // Snapshot rincian untuk struk SEBELUM keranjang direset
    const receiptItems = lineList.map((l) => {
      const unit = wrappedCalculateItemPrice(l.item.price, l.item.id)
      return {
        name: l.item.name,
        note: l.note?.trim() || undefined,
        quantity: l.quantity,
        unit_price: unit,
        subtotal: unit * l.quantity,
      }
    })
    const snapCustomer = customerName.trim() || null
    const snapSubtotal = subtotalAmount
    const snapDiscount = globalDiscount

    try {
      const res = await fetch('/api/orders/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: method,
          customer_name: customerName,
          amount_received: method === 'cash' ? amountReceived : undefined,
          items: lineList.map((l) => ({
            menu_item_id: l.item.id,
            quantity: l.quantity,
            note: l.note,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        postToNative({ type: 'haptic', style: 'error' })
        setWalkInError(data.error ?? 'Gagal membuat pesanan')
        setWalkInSubmitting(false)
        return
      }

      postToNative({ type: 'haptic', style: 'success' })

      const receipt: ReceiptData = {
        outletName: outletName || 'SUKA SHAWARMA',
        orderNumber: data.order_number,
        dateISO: new Date().toISOString(),
        customerName: snapCustomer,
        items: receiptItems,
        subtotal: snapSubtotal,
        discount: snapDiscount,
        total: data.total_amount,
        paymentMethod: method,
        amountReceived: data.amount_received ?? null,
        changeAmount: data.change_amount ?? null,
      }

      // Cetak struk otomatis
      printReceipt(receipt)

      setWalkInSuccess({
        orderNumber: data.order_number,
        method,
        change: data.change_amount ?? null,
        receipt,
      })

      // Reset keranjang untuk transaksi berikutnya
      setLines({})
      setCustomerName('')
      setCartOpen(false)
      setWalkInPanelKey((k) => k + 1)
    } catch {
      postToNative({ type: 'haptic', style: 'error' })
      setWalkInError('Tidak dapat terhubung ke server')
    } finally {
      setWalkInSubmitting(false)
    }
  }

  // ── Render: state khusus ──────────────────────────────────────────────────
  if (loaded && !outletId) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 font-medium">Akun Anda belum terhubung ke cabang manapun.</p>
        <Link href="/kasir" className="text-amber-600 font-bold mt-3 inline-block">← Kembali</Link>
      </div>
    )
  }

  return (
    <div className="pb-28 lg:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/kasir" className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">
            {mode === 'walkin' ? 'Kasir — Pesanan Baru' : 'Input Channel Online'}
          </h1>
          <p className="text-sm text-gray-500 leading-tight">
            {mode === 'walkin' ? 'Catat pesanan pelanggan di kasir' : 'Input pesanan dari channel eksternal'}
          </p>
        </div>
      </div>

      {/* Tab switch: Kasir Langsung / Channel Online */}
      <div className="inline-flex bg-gray-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => setMode('walkin')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'walkin' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Store className="w-4 h-4" /> Kasir Langsung
        </button>
        <button
          onClick={() => setMode('online')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'online' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Globe className="w-4 h-4" /> Channel Online
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-4 md:gap-5 xl:gap-6 items-start min-w-0">
        {/* ══ KIRI: pilih channel + menu ══ */}
        <div className="space-y-4 xl:space-y-5 min-w-0">
          {/* Channel selector (hanya mode online) */}
          {mode === 'online' && (
          <div className="bg-white rounded-xl xl:rounded-2xl border border-gray-200 p-3.5 xl:p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">1. Pilih Channel</p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
              {CHANNELS.map((c) => {
                const selected = channel === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    className={`relative flex items-center gap-2 px-2.5 py-2 xl:py-2.5 rounded-lg xl:rounded-xl border font-bold text-xs xl:text-sm transition-all duration-200 active:scale-95 hover:shadow-sm ${
                      selected ? 'shadow-md ring-2 ring-offset-1' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                    style={selected ? { backgroundColor: c.bg, color: c.fg, borderColor: c.bg } : undefined}
                  >
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold flex-shrink-0"
                      style={selected ? { backgroundColor: 'rgba(255,255,255,0.3)', color: c.fg } : { backgroundColor: c.bg, color: c.fg }}
                    >
                      {c.logoPath ? (
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                          <path d={c.logoPath} />
                        </svg>
                      ) : (
                        c.mark
                      )}
                    </span>
                    <span className="truncate">{c.label}</span>
                    {selected && <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {/* Search + kategori */}
          <div className="bg-white rounded-xl xl:rounded-2xl border border-gray-200 p-3.5 xl:p-4 shadow-sm space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mode === 'online' ? '2. Pilih Menu' : '1. Pilih Menu'}</p>
            <div className="flex flex-col gap-3 min-w-0">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari menu..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-sm"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide -mx-3.5 px-3.5 xl:mx-0 xl:px-0">
                <button
                  onClick={() => setActiveCat('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs xl:text-sm font-bold whitespace-nowrap transition-all ${activeCat === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Semua
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs xl:text-sm font-bold whitespace-nowrap transition-all ${activeCat === c.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid menu */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Sandwich className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Tidak ada menu yang cocok</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {visibleItems.map((it) => {
                const qty = lines[it.id]?.quantity ?? 0
                return (
                  <div key={it.id} className={`group bg-white rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${qty > 0 ? 'border-amber-400 shadow-sm ring-1 ring-amber-400' : 'border-gray-200 hover:border-amber-300'}`}>
                    <div className="h-24 bg-gray-50 relative overflow-hidden cursor-pointer" onClick={() => qty === 0 && addItem(it)}>
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_url} alt={it.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Sandwich className="w-8 h-8" />
                        </div>
                      )}
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                          {qty}
                        </span>
                      )}
                      {qty === 0 && (
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col justify-between">
                      <p className="font-bold text-gray-800 text-xs leading-snug line-clamp-2 min-h-[2rem] cursor-pointer" onClick={() => qty === 0 && addItem(it)}>{it.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col">
                          {wrappedCalculateItemPrice(it.price, it.id) < it.price ? (
                            <>
                              <span className="text-[10px] text-gray-400 line-through decoration-red-500">{formatRupiah(it.price)}</span>
                              <span className="font-bold text-amber-600 text-xs xl:text-sm">{formatRupiah(wrappedCalculateItemPrice(it.price, it.id))}</span>
                            </>
                          ) : (
                            <span className="font-bold text-amber-600 text-xs xl:text-sm">{formatRupiah(it.price)}</span>
                          )}
                        </div>
                        {qty === 0 ? (
                          <button
                            onClick={() => addItem(it)}
                            className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white flex items-center justify-center transition-all active:scale-95"
                            aria-label={`Tambah ${it.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                            <button onClick={() => setQty(it.id, qty - 1)} className="w-6 h-6 rounded-md bg-white shadow-sm text-gray-700 flex items-center justify-center transition-colors hover:bg-gray-100 active:scale-95">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-gray-900 text-xs w-3 text-center">{qty}</span>
                            <button onClick={() => setQty(it.id, qty + 1)} className="w-6 h-6 rounded-md bg-amber-500 shadow-sm text-white flex items-center justify-center transition-colors hover:bg-amber-600 active:scale-95">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ══ KANAN: keranjang (desktop sticky) ══ */}
        <div className="hidden md:block sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto scrollbar-hide">
          {mode === 'walkin' ? (
            <WalkInCartPanel
              key={walkInPanelKey}
              lineList={lineList}
              totalItems={totalItems}
              subtotal={subtotalAmount}
              totalPrice={totalPrice}
              globalDiscount={globalDiscount}
              globalPromo={globalPromo}
              needsMoreForPromo={!!needsMoreForPromo}
              missingAmount={missingAmount}
              customerName={customerName}
              setCustomerName={setCustomerName}
              setQty={setQty}
              setNote={setNote}
              calculateItemPrice={wrappedCalculateItemPrice}
              submitting={walkInSubmitting}
              error={walkInError}
              onPay={handleWalkInPay}
            />
          ) : (
            <CartPanel
              lineList={lineList}
              totalItems={totalItems}
              totalPrice={totalPrice}
              channel={channel}
              payment={payment}
              setPayment={setPayment}
              customerName={customerName}
              setCustomerName={setCustomerName}
              setQty={setQty}
              setNote={setNote}
              canSubmit={canSubmit}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
              calculateItemPrice={wrappedCalculateItemPrice}
              globalDiscount={globalDiscount}
              globalPromo={globalPromo}
              needsMoreForPromo={!!needsMoreForPromo}
              missingAmount={missingAmount}
            />
          )}
        </div>
      </div>

      {/* ══ Mobile: bottom bar + sheet ══ */}
      {totalItems > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-300/40 px-5 py-4 flex items-center justify-between font-bold active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2">
            <span className="bg-white/25 rounded-lg px-2 py-0.5 text-sm">{totalItems}</span>
            Lihat Keranjang
          </span>
          <span>{formatRupiah(totalPrice)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-gray-50 rounded-t-3xl max-h-[88vh] overflow-y-auto p-4 animate-[slideUp_.2s_ease-out]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 text-lg">Keranjang</h2>
              <button onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            {mode === 'walkin' ? (
              <WalkInCartPanel
                key={walkInPanelKey}
                lineList={lineList}
                totalItems={totalItems}
                subtotal={subtotalAmount}
                totalPrice={totalPrice}
                globalDiscount={globalDiscount}
                globalPromo={globalPromo}
                needsMoreForPromo={!!needsMoreForPromo}
                missingAmount={missingAmount}
                customerName={customerName}
                setCustomerName={setCustomerName}
                setQty={setQty}
                setNote={setNote}
                calculateItemPrice={wrappedCalculateItemPrice}
                submitting={walkInSubmitting}
                error={walkInError}
                onPay={handleWalkInPay}
                embedded
              />
            ) : (
              <CartPanel
                lineList={lineList}
                totalItems={totalItems}
                totalPrice={totalPrice}
                channel={channel}
                payment={payment}
                setPayment={setPayment}
                customerName={customerName}
                setCustomerName={setCustomerName}
                setQty={setQty}
                setNote={setNote}
                canSubmit={canSubmit}
                submitting={submitting}
                error={error}
                onSubmit={handleSubmit}
                calculateItemPrice={wrappedCalculateItemPrice}
                globalDiscount={globalDiscount}
                globalPromo={globalPromo}
                needsMoreForPromo={!!needsMoreForPromo}
                missingAmount={missingAmount}
                embedded
              />
            )}
          </div>
        </div>
      )}

      {/* ══ Success overlay ══ */}
      {success !== null && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-[popIn_.2s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Pesanan Dibuat!</h2>
            <p className="text-gray-500 mt-1">Order masuk ke papan <b>Sedang Diproses</b>.</p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl py-4 my-5">
              <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider">Nomor Antrian</p>
              <p className="text-4xl font-bold text-amber-600 leading-tight mt-1">#{success}</p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setSuccess(null)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-colors active:scale-95">
                Buat Order Lagi
              </button>
              <Link href="/kasir" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center">
                Ke Papan Order
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══ Success overlay walk-in (kasir langsung) ══ */}
      {walkInSuccess !== null && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-[popIn_.2s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Pembayaran Berhasil!</h2>
            <p className="text-gray-500 mt-1">Order masuk ke papan <b>Sedang Diproses</b>.</p>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl py-4 my-4">
              <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider">Nomor Antrian</p>
              <p className="text-4xl font-bold text-amber-600 leading-tight mt-1">#{walkInSuccess.orderNumber}</p>
            </div>

            {walkInSuccess.method === 'cash' && walkInSuccess.change !== null && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl py-3 mb-4 flex items-center justify-between px-5">
                <span className="text-sm font-bold text-emerald-700">Kembalian</span>
                <span className="text-2xl font-black text-emerald-700">{formatRupiah(walkInSuccess.change)}</span>
              </div>
            )}

            <button
              onClick={() => printReceipt(walkInSuccess.receipt)}
              className="w-full mb-2.5 bg-white border-2 border-gray-200 hover:border-amber-300 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95"
            >
              <Printer className="w-5 h-5" /> Cetak Ulang Struk
            </button>

            <div className="flex gap-2.5">
              <button onClick={() => setWalkInSuccess(null)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-colors active:scale-95">
                Transaksi Baru
              </button>
              <Link href="/kasir" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center">
                Ke Papan Order
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes popIn { from { transform: scale(.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  )
}

// ── Panel keranjang (dipakai desktop & mobile sheet) ─────────────────────────
function CartPanel(props: {
  lineList: Line[]
  totalItems: number
  totalPrice: number
  channel: string | null
  payment: Payment | null
  setPayment: (p: Payment) => void
  customerName: string
  setCustomerName: (v: string) => void
  setQty: (id: string, qty: number) => void
  setNote: (id: string, note: string) => void
  canSubmit: boolean
  submitting: boolean
  error: string | null
  onSubmit: () => void
  calculateItemPrice: (price: number, id: string) => number
  globalDiscount: number
  globalPromo: any
  needsMoreForPromo?: boolean
  missingAmount?: number
  embedded?: boolean
}) {
  const {
    lineList, totalItems, totalPrice, channel, payment, setPayment,
    customerName, setCustomerName, setQty, setNote, canSubmit, submitting, error, onSubmit,
    calculateItemPrice, globalDiscount, globalPromo, needsMoreForPromo, missingAmount, embedded,
  } = props

  const ch = getChannel(channel)

  return (
    <div className={embedded ? '' : 'bg-white rounded-2xl border border-gray-200 overflow-hidden'}>
      <div className={`${embedded ? '' : 'p-4'} space-y-4`}>
        {!embedded && (
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-gray-900">Keranjang</h2>
            {totalItems > 0 && (
              <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{totalItems} item</span>
            )}
          </div>
        )}

        {/* Items */}
        {lineList.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">Belum ada menu dipilih</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[40vh] lg:max-h-[38vh] overflow-y-auto -mx-2 px-2 scrollbar-thin scrollbar-thumb-gray-200">
            {lineList.map((l) => {
              const discountedPrice = calculateItemPrice(l.item.price, l.item.id)
              return (
                <div key={l.item.id} className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm transition-all hover:border-amber-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm leading-snug">{l.item.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {discountedPrice < l.item.price && (
                          <span className="text-[10px] text-gray-400 line-through decoration-red-500">{formatRupiah(l.item.price * l.quantity)}</span>
                        )}
                        <p className="text-amber-600 font-bold text-sm">{formatRupiah(discountedPrice * l.quantity)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100 flex-shrink-0">
                      <button onClick={() => setQty(l.item.id, l.quantity - 1)} className="w-7 h-7 rounded-md bg-white shadow-sm text-gray-600 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all">
                        {l.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <span className="font-bold text-sm w-5 text-center text-gray-800">{l.quantity}</span>
                      <button onClick={() => setQty(l.item.id, l.quantity + 1)} className="w-7 h-7 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-sm hover:bg-amber-600 active:scale-95 transition-all">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative mt-2.5">
                    <StickyNote className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={l.note}
                      onChange={(e) => setNote(l.item.id, e.target.value)}
                      placeholder="Catatan opsional..."
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="bg-gray-50 -mx-4 p-4 border-t border-gray-200 space-y-4">
          {/* Nama customer */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Nama Customer (opsional)</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Misal: Budi"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors text-sm"
            />
          </div>

          {/* Metode bayar */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">3. Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPayment('qris')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'qris' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <QrCode className="w-4 h-4" /> QRIS
              </button>
              <button
                onClick={() => setPayment('cash')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <Banknote className="w-4 h-4" /> Tunai
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 pt-2">
          {needsMoreForPromo && missingAmount ? (
            <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg font-medium border border-blue-100 flex items-center gap-2 mb-2">
              <span className="shrink-0 bg-blue-500 text-white w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold">i</span>
              <span>Tambah <b>{formatRupiah(missingAmount)}</b> lagi untuk dapat diskon promo!</span>
            </div>
          ) : null}
          {globalDiscount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">
                Diskon {globalPromo?.name ? `(${globalPromo.name})` : ''}
              </span>
              <span className="text-red-500 font-bold">-{formatRupiah(globalDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-gray-500 font-bold">Total Pembayaran</span>
            <span className="text-2xl font-black text-gray-900">{formatRupiah(totalPrice)}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Konfirmasi */}
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl shadow-sm shadow-amber-200 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
          ) : (
            <><CheckCircle2 className="w-5 h-5" /> Konfirmasi (Diproses)</>
          )}
        </button>
        {!canSubmit && !submitting && (
          <p className="text-xs text-gray-400 text-center -mt-1">
            {lineList.length === 0 ? 'Pilih minimal 1 menu' : !channel ? 'Pilih channel dulu' : !payment ? 'Pilih metode pembayaran' : ''}
          </p>
        )}
        {ch && lineList.length > 0 && (
          <p className="text-xs text-center text-gray-400 -mt-1">
            Channel: <b style={{ color: ch.bg }}>{ch.label}</b>
          </p>
        )}
      </div>
    </div>
  )
}
