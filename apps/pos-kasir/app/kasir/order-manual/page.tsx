'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingBag, Loader2,
  CheckCircle2, X, StickyNote, Banknote, QrCode, Sandwich,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import { CHANNELS, getChannel } from '@/lib/channels'
import type { MenuItem, Category } from '@/types'

interface Line {
  item: MenuItem
  quantity: number
  note: string
}

type Payment = 'cash' | 'qris'

export default function OrderManualPage() {
  const supabase = createClient()
  const { outletId, loaded } = useMyOutlet()

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
  const totalPrice = lineList.reduce((s, l) => s + l.item.price * l.quantity, 0)

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
        setError(data.error ?? 'Gagal membuat pesanan')
        setSubmitting(false)
        return
      }
      setSuccess(data.order_number)
      // reset untuk order berikutnya
      setLines({})
      setChannel(null)
      setPayment(null)
      setCustomerName('')
      setCartOpen(false)
    } catch {
      setError('Tidak dapat terhubung ke server')
    } finally {
      setSubmitting(false)
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
      <div className="flex items-center gap-3 mb-5">
        <Link href="/kasir" className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Order Manual</h1>
          <p className="text-sm text-gray-500 leading-tight">Input pesanan dari channel eksternal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* ══ KIRI: pilih channel + menu ══ */}
        <div className="space-y-5">
          {/* Channel selector */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">1. Pilih Channel</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CHANNELS.map((c) => {
                const selected = channel === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    className={`relative flex items-center gap-2 px-3 py-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${
                      selected ? 'shadow-md' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                    style={selected ? { backgroundColor: c.bg, color: c.fg, borderColor: c.bg } : undefined}
                  >
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold flex-shrink-0"
                      style={selected ? { backgroundColor: 'rgba(255,255,255,0.25)', color: c.fg } : { backgroundColor: c.bg, color: c.fg }}
                    >
                      {c.mark}
                    </span>
                    <span className="truncate">{c.label}</span>
                    {selected && <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search + kategori */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">2. Pilih Menu</p>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari menu..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setActiveCat('all')}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeCat === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeCat === c.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {c.name}
                </button>
              ))}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleItems.map((it) => {
                const qty = lines[it.id]?.quantity ?? 0
                return (
                  <div key={it.id} className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${qty > 0 ? 'border-amber-400 shadow-sm' : 'border-gray-100'}`}>
                    <div className="aspect-square bg-gray-100 relative">
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Sandwich className="w-10 h-10" />
                        </div>
                      )}
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                          {qty}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{it.name}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-bold text-amber-600 text-sm">{formatRupiah(it.price)}</span>
                        {qty === 0 ? (
                          <button
                            onClick={() => addItem(it)}
                            className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors active:scale-95"
                            aria-label={`Tambah ${it.name}`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setQty(it.id, qty - 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors active:scale-95">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-bold text-gray-900 text-sm w-4 text-center">{qty}</span>
                            <button onClick={() => setQty(it.id, qty + 1)} className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors active:scale-95">
                              <Plus className="w-3.5 h-3.5" />
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
        <div className="hidden lg:block sticky top-6">
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
          />
        </div>
      </div>

      {/* ══ Mobile: bottom bar + sheet ══ */}
      {totalItems > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-300/40 px-5 py-4 flex items-center justify-between font-bold active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2">
            <span className="bg-white/25 rounded-lg px-2 py-0.5 text-sm">{totalItems}</span>
            Lihat Keranjang
          </span>
          <span>{formatRupiah(totalPrice)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-gray-50 rounded-t-3xl max-h-[88vh] overflow-y-auto p-4 animate-[slideUp_.2s_ease-out]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 text-lg">Keranjang</h2>
              <button onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
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
              embedded
            />
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

      <style jsx>{`
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
  embedded?: boolean
}) {
  const {
    lineList, totalItems, totalPrice, channel, payment, setPayment,
    customerName, setCustomerName, setQty, setNote, canSubmit, submitting, error, onSubmit, embedded,
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
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">Belum ada menu dipilih</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[40vh] lg:max-h-[34vh] overflow-y-auto -mx-1 px-1">
            {lineList.map((l) => (
              <div key={l.item.id} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm leading-snug">{l.item.name}</p>
                    <p className="text-amber-600 font-bold text-xs mt-0.5">{formatRupiah(l.item.price * l.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setQty(l.item.id, l.quantity - 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-700 flex items-center justify-center active:scale-95">
                      {l.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="font-bold text-sm w-4 text-center">{l.quantity}</span>
                    <button onClick={() => setQty(l.item.id, l.quantity + 1)} className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center active:scale-95">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="relative mt-2">
                  <StickyNote className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={l.note}
                    onChange={(e) => setNote(l.item.id, e.target.value)}
                    placeholder="Catatan (mis. tanpa bawang)"
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nama customer */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nama Customer (opsional)</label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="mis. Budi"
            className="mt-1.5 w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm"
          />
        </div>

        {/* Metode bayar */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">3. Metode Pembayaran</label>
          <div className="grid grid-cols-2 gap-2.5 mt-1.5">
            <button
              onClick={() => setPayment('qris')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'qris' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <QrCode className="w-4 h-4" /> QRIS
            </button>
            <button
              onClick={() => setPayment('cash')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <Banknote className="w-4 h-4" /> Tunai
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-gray-500 font-medium">Total</span>
          <span className="text-xl font-bold text-gray-900">{formatRupiah(totalPrice)}</span>
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
