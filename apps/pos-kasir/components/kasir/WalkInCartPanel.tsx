'use client'

import { useMemo, useState } from 'react'
import {
  ShoppingBag, Trash2, Minus, Plus, StickyNote, Loader2, CheckCircle2,
  Banknote, QrCode, X,
} from 'lucide-react'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem } from '@/types'

export interface Line {
  item: MenuItem
  quantity: number
  note: string
}

export type Payment = 'cash' | 'qris'

// Nominal cepat yang umum di kasir (di luar "uang pas")
const QUICK_CASH = [20000, 50000, 100000, 150000, 200000]

export function WalkInCartPanel(props: {
  lineList: Line[]
  totalItems: number
  subtotal: number
  totalPrice: number
  globalDiscount: number
  globalPromo: any
  needsMoreForPromo?: boolean
  missingAmount?: number
  customerName: string
  setCustomerName: (v: string) => void
  setQty: (id: string, qty: number) => void
  setNote: (id: string, note: string) => void
  calculateItemPrice: (price: number, id: string) => number
  submitting: boolean
  error: string | null
  onPay: (method: Payment, amountReceived: number | null) => void
  embedded?: boolean
}) {
  const {
    lineList, totalItems, subtotal, totalPrice, globalDiscount, globalPromo,
    needsMoreForPromo, missingAmount, customerName, setCustomerName, setQty, setNote,
    calculateItemPrice, submitting, error, onPay, embedded,
  } = props

  const [payment, setPayment] = useState<Payment>('cash')
  const [cashInput, setCashInput] = useState<string>('')
  const [qrisOpen, setQrisOpen] = useState(false)

  const amountReceived = cashInput ? parseInt(cashInput.replace(/\D/g, ''), 10) || 0 : 0
  const change = amountReceived - totalPrice
  const cashEnough = amountReceived >= totalPrice && totalPrice > 0

  const canPayCash = lineList.length > 0 && cashEnough && !submitting
  const canOpenQris = lineList.length > 0 && !submitting

  const qrData = useMemo(
    () => `shawarma-kasir://pay?amount=${totalPrice}`,
    [totalPrice],
  )
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=1e293b&margin=10`

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
          <div className="space-y-3 max-h-[36vh] overflow-y-auto -mx-2 px-2 scrollbar-thin scrollbar-thumb-gray-200">
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
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPayment('cash')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <Banknote className="w-4 h-4" /> Tunai
              </button>
              <button
                onClick={() => setPayment('qris')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'qris' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <QrCode className="w-4 h-4" /> QRIS
              </button>
            </div>
          </div>

          {/* Input tunai + kembalian */}
          {payment === 'cash' && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Uang Diterima</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">Rp</span>
                <input
                  inputMode="numeric"
                  value={amountReceived ? amountReceived.toLocaleString('id-ID') : ''}
                  onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-right text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setCashInput(String(Math.ceil(totalPrice)))}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200 active:scale-95 transition-all"
                >
                  Uang Pas
                </button>
                {QUICK_CASH.filter((v) => v >= totalPrice).slice(0, 4).map((v) => (
                  <button
                    key={v}
                    onClick={() => setCashInput(String(v))}
                    className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    {formatRupiah(v)}
                  </button>
                ))}
              </div>
              {amountReceived > 0 && (
                <div className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${cashEnough ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <span className={`text-sm font-bold ${cashEnough ? 'text-emerald-700' : 'text-red-600'}`}>
                    {cashEnough ? 'Kembalian' : 'Kurang'}
                  </span>
                  <span className={`text-lg font-black ${cashEnough ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatRupiah(Math.abs(change))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ringkasan total */}
        <div className="flex flex-col gap-1 pt-2">
          {needsMoreForPromo && missingAmount ? (
            <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg font-medium border border-blue-100 flex items-center gap-2 mb-2">
              <span className="shrink-0 bg-blue-500 text-white w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold">i</span>
              <span>Tambah <b>{formatRupiah(missingAmount)}</b> lagi untuk dapat diskon promo!</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">Subtotal</span>
            <span className="text-gray-700 font-bold">{formatRupiah(subtotal)}</span>
          </div>
          {globalDiscount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Diskon {globalPromo?.name ? `(${globalPromo.name})` : ''}</span>
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

        {/* Tombol bayar */}
        {payment === 'cash' ? (
          <button
            onClick={() => onPay('cash', amountReceived)}
            disabled={!canPayCash}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Bayar & Cetak Struk</>
            )}
          </button>
        ) : (
          <button
            onClick={() => setQrisOpen(true)}
            disabled={!canOpenQris}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <QrCode className="w-5 h-5" /> Tampilkan QRIS
          </button>
        )}
        {lineList.length === 0 && (
          <p className="text-xs text-gray-400 text-center -mt-1">Pilih minimal 1 menu</p>
        )}
      </div>

      {/* ── Modal QRIS ── */}
      {qrisOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl animate-[popIn_.2s_ease-out]">
            <div className="h-1 bg-blue-500" />
            <div className="p-6 text-center">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">Pembayaran QRIS</h2>
                <button onClick={() => setQrisOpen(false)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-5 py-2.5 rounded-2xl mb-4">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Total</span>
                <span className="text-lg font-bold text-blue-700">{formatRupiah(totalPrice)}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border-2 border-gray-100 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageUrl} alt="QRIS" width={220} height={220} className="rounded-xl" />
              </div>
              <p className="text-sm text-gray-500 mt-4">Minta pelanggan scan QR di atas, lalu konfirmasi setelah pembayaran masuk.</p>
              <button
                onClick={() => { setQrisOpen(false); onPay('qris', null) }}
                disabled={submitting}
                className="w-full mt-5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
                ) : (
                  <><CheckCircle2 className="w-5 h-5" /> Pembayaran Diterima</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
