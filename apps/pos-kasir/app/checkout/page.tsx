'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, Loader2, AlertCircle, ShoppingBag,
  User, FileText, ChevronRight, Banknote, CreditCard,
  QrCode, CheckCircle2,
} from 'lucide-react'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'
import type { PaymentMethod } from '@/types'

interface PaymentOption {
  id: PaymentMethod
  label: string
  desc: string
  icon: React.ReactNode
  color: string
  activeBg: string
  activeBorder: string
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'cash',
    label: 'Tunai',
    desc: 'Bayar langsung di kasir',
    icon: <Banknote className="w-6 h-6" />,
    color: 'text-emerald-600',
    activeBg: 'bg-emerald-50',
    activeBorder: 'border-emerald-400',
  },
  {
    id: 'qris',
    label: 'QRIS',
    desc: 'Scan QR — semua e-wallet',
    icon: <QrCode className="w-6 h-6" />,
    color: 'text-blue-600',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-400',
  },
  {
    id: 'card',
    label: 'Kartu',
    desc: 'Debit / Kredit',
    icon: <CreditCard className="w-6 h-6" />,
    color: 'text-purple-600',
    activeBg: 'bg-purple-50',
    activeBorder: 'border-purple-400',
  },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { items, totalPrice, clearCart } = useCart()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [loading, setLoading]             = useState(false)
  const [isSuccess, setIsSuccess]         = useState(false)
  const [error, setError]                 = useState('')
  const total = totalPrice()
  const rootItems = items.filter(i => !i.parentId)

  if (items.length === 0 && !isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#FFFBF5] px-4">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center">
          <ShoppingBag className="w-9 h-9 text-amber-200" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-800 text-lg">Keranjang Kosong</p>
          <p className="text-gray-400 text-sm mt-1">Tambahkan menu terlebih dahulu</p>
        </div>
        <Link href="/" className="btn-primary">Kembali ke Menu</Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!paymentMethod) { setError('Pilih metode pembayaran terlebih dahulu'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentMethod,
          items: items.map(({ cartItemId, parentId, item, quantity, note }) => ({ 
            cartItemId, 
            parentId, 
            menu_item_id: item.id, 
            quantity, 
            note: note?.trim() 
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Terjadi kesalahan, coba lagi.'); setLoading(false); return }
      
      setIsSuccess(true)
      // Delay clearCart to prevent UI flicker while router navigates
      setTimeout(() => {
        clearCart()
      }, 1000)

      if (paymentMethod === 'qris') {
        router.push(`/payment/qris?id=${data.order_id}&number=${data.order_number}&total=${data.total_amount}`)
      } else {
        router.push(`/order-success?id=${data.order_id}&number=${data.order_number}&pay=${paymentMethod}`)
      }
    } catch {
      setError('Tidak dapat terhubung ke server. Periksa koneksimu.')
      setLoading(false)
    }
  }

  const selectedOption = PAYMENT_OPTIONS.find((p) => p.id === paymentMethod)

  return (
    <div className="min-h-screen bg-[#FFFBF5]">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 leading-none">Konfirmasi Pesanan</h1>
            <p className="text-gray-400 text-xs mt-0.5">{items.length} item dipilih</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Order Summary */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-amber-100 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <h2 className="font-bold text-gray-900">Ringkasan Pesanan</h2>
            </div>

            <div className="space-y-3">
              {rootItems.map((root) => {
                const children = items.filter(i => i.parentId === root.cartItemId)
                return (
                  <div key={root.cartItemId} className="flex flex-col border-b border-gray-50/50 pb-3 last:border-0 last:pb-0 relative py-1">
                    {/* Vertical Line */}
                    {(root.note || children.length > 0) && (
                      <div className="absolute left-[11px] top-6 bottom-4 w-[2px] bg-gray-200" />
                    )}

                    {/* Root Item Row */}
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-6 h-6 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          {root.quantity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-900 text-[15px] font-bold leading-tight">{root.item.name}</p>
                        </div>
                      </div>
                      <span className="text-gray-900 text-[15px] font-black flex-shrink-0 mt-0.5">
                        {formatRupiah(root.item.price * root.quantity)}
                      </span>
                    </div>

                    {/* Root Note */}
                    {root.note && (
                      <div className="relative pl-[2.25rem] mt-2 mb-1 flex items-start">
                        <div className="absolute left-[11px] top-3 w-3 h-[2px] bg-gray-200" />
                        <div className="inline-flex bg-gray-50/80 border border-gray-100 px-2.5 py-1.5 rounded-lg max-w-full min-w-0">
                          <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap break-words min-w-0 flex-1">
                            <span className="font-semibold text-gray-700">Catatan: </span> {root.note}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Children */}
                    {children.length > 0 && children.map(child => (
                      <div key={child.cartItemId} className="relative flex items-start justify-between gap-3 pl-[2.25rem] py-1 mt-1">
                        {/* Branch indicator */}
                        <div className="absolute left-[11px] top-3 w-3 h-[2px] bg-gray-200" />
                        
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 bg-gray-50 text-gray-500 text-[10px] font-bold rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                            {child.quantity}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-600 text-sm font-semibold leading-tight flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-bold uppercase bg-gray-100 text-gray-500 px-1 rounded-sm">Extra</span>
                              {child.item.name}
                            </p>
                            {child.note && (
                              <p className="text-gray-400 text-[11px] mt-1 italic whitespace-pre-wrap break-words">
                                {child.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-gray-600 text-sm font-bold flex-shrink-0 mt-0.5">
                          {formatRupiah(child.item.price * child.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Subtotal</span>
                <span className="text-gray-700 font-semibold">{formatRupiah(total)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-bold text-gray-900">Total Pembayaran</span>
                <span className="font-bold text-2xl text-amber-600">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-amber-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 leading-none">Metode Pembayaran</h2>
                <p className="text-gray-400 text-xs mt-0.5">Pilih cara pembayaranmu</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const isActive = paymentMethod === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2
                      transition-all duration-150 text-center
                      ${isActive
                        ? `${opt.activeBg} ${opt.activeBorder} shadow-sm`
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                      }`}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-current" />
                      </span>
                    )}
                    <span className={isActive ? opt.color : 'text-gray-300'}>
                      {opt.icon}
                    </span>
                    <div>
                      <p className={`text-sm font-bold leading-none ${isActive ? opt.color : 'text-gray-600'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 leading-tight">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* QRIS preview */}
            {paymentMethod === 'qris' && (
              <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center
                  border border-blue-100 flex-shrink-0 overflow-hidden">
                  <QrCode className="w-12 h-12 text-blue-300" strokeWidth={1} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-700">Scan QR Langsung</p>
                  <p className="text-xs text-blue-500 mt-0.5 leading-relaxed">
                    QR code akan ditampilkan di halaman berikutnya. Gunakan GoPay, OVO, Dana, ShopeePay, atau m-banking manapun.
                  </p>
                </div>
              </div>
            )}

            {/* Cash info */}
            {paymentMethod === 'cash' && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center
                  border border-emerald-100 flex-shrink-0">
                  <Banknote className="w-7 h-7 text-emerald-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-700">Bayar di Kasir</p>
                  <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed">
                    Tunjukkan nomor antrian dan bayar tunai sejumlah{' '}
                    <span className="font-bold">{formatRupiah(total)}</span> ke kasir.
                  </p>
                </div>
              </div>
            )}

            {/* Card info */}
            {paymentMethod === 'card' && (
              <div className="mt-4 p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center
                  border border-purple-100 flex-shrink-0">
                  <CreditCard className="w-7 h-7 text-purple-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-purple-700">Tap / Gesek di Kasir</p>
                  <p className="text-xs text-purple-600 mt-0.5 leading-relaxed">
                    Tunjukkan nomor antrian dan lakukan pembayaran kartu di mesin EDC kasir.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Order Notes Removed */}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100
              rounded-2xl p-4 text-red-700 text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <div className="pt-1 pb-8">
            <button
              type="submit"
              disabled={loading || !paymentMethod}
              className={`btn-primary w-full py-4 text-base rounded-2xl transition-all
                ${!paymentMethod ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses Pesanan...
                </>
              ) : (
                <>
                  {selectedOption
                    ? `Bayar dengan ${selectedOption.label}`
                    : 'Pilih Metode Pembayaran'}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-center text-gray-400 text-xs mt-3">
              Harga sudah termasuk semua biaya
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
