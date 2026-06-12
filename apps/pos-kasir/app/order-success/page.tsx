'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ReceiptText, Banknote, CreditCard, QrCode, Ticket, ArrowRight, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cleanItemName } from '@/lib/order-item-name'
import { formatRupiah } from '@/lib/validations'
import type { OrderWithItems, PaymentMethod } from '@/types'

const PAYMENT_LABELS: Record<PaymentMethod, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  cash: { label: 'Tunai',  icon: <Banknote  className="w-4 h-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
  qris: { label: 'QRIS',  icon: <QrCode    className="w-4 h-4" />, color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100'       },
  card: { label: 'Kartu', icon: <CreditCard className="w-4 h-4" />, color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-100'   },
}

function OrderSuccessContent() {
  const router = useRouter()
  const params = useSearchParams()
  const orderId = params.get('id')
  const orderNumber = params.get('number')
  const payParam = params.get('pay') as PaymentMethod | null
  const payInfo = payParam ? PAYMENT_LABELS[payParam] : null
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState(15) // 15 seconds countdown

  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    const supabase = createClient()
    supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single()
      .then(({ data }) => { setOrder(data); setLoading(false) })
  }, [orderId])

  // Auto-redirect back to home
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [router])

  if (!orderId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFBF5]">
        <p className="text-gray-500 font-medium">Halaman tidak ditemukan</p>
        <Link href="/" className="btn-primary px-8">Kembali ke Menu</Link>
      </div>
    )
  }

  const isQris = payParam === 'qris'

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-start justify-center pt-8 pb-16 px-4 selection:bg-amber-100">
      <div className="w-full max-w-md space-y-6 animate-fade-up">

        {/* ── Ticket Container ── */}
        <div className="relative bg-white rounded-2xl shadow-card overflow-hidden border border-gray-100">

          {/* Top Section */}
          <div className="p-8 pb-6 text-center bg-amber-50/40 relative">
            <div className="relative">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200 mb-5 animate-bounce-in">
                <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2} />
              </div>

              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                {isQris ? 'Pesanan Berhasil!' : 'Selesaikan Pembayaran!'}
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed max-w-[280px] mx-auto">
                {isQris 
                  ? 'Pembayaran Anda telah kami terima. Silakan duduk manis, pesanan Anda akan segera disiapkan.'
                  : 'Harap foto atau ingat nomor antrian ini dan segera menuju meja kasir untuk membayar.'}
              </p>

              {/* Status Badge */}
              {payInfo && (
                <div className={`mt-5 mx-auto w-fit inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-700`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${payInfo.bg} ${payInfo.color}`}>
                    {payInfo.icon}
                  </div>
                  Metode: {payInfo.label}
                  {isQris && <span className="ml-1 text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">Lunas</span>}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Divider (Dashed with cutouts) */}
          <div className="relative flex items-center justify-center h-8 bg-white overflow-hidden">
            <div className="absolute -left-4 w-8 h-8 bg-[#FFFBF5] rounded-full border border-amber-100/50 shadow-inner" />
            <div className="absolute -right-4 w-8 h-8 bg-[#FFFBF5] rounded-full border border-amber-100/50 shadow-inner" />
            <div className="w-full mx-6 border-t-2 border-dashed border-gray-200" />
          </div>

          {/* Bottom Section (Queue Number) */}
          <div className="p-8 pt-4 text-center bg-white relative">
            <div className="absolute bottom-0 right-0 opacity-[0.03] pointer-events-none transform translate-x-1/4 translate-y-1/4">
              <Ticket className="w-48 h-48" />
            </div>

            <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em] mb-1">
              Nomor Antrian
            </p>
            <div className="inline-block relative">
              <p className="text-[5.5rem] font-bold text-amber-600 leading-none tabular-nums">
                #{orderNumber}
              </p>
            </div>
          </div>

        </div>

        {/* ── Order Detail Collapsible ── */}
        {!loading && order && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <ReceiptText className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="font-bold text-gray-900 text-lg">Rincian Pesanan</h2>
            </div>

            <div className="space-y-3 relative">
              {/* Left dashed line for receipt look */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px border-l-2 border-dashed border-gray-100" />

              {order.order_items.map((oi) => (
                <div key={oi.id} className="flex items-start justify-between gap-3 relative pl-8">
                  {/* Dot on the dashed line */}
                  <div className="absolute left-[8px] top-1.5 w-2 h-2 bg-amber-400 rounded-full ring-4 ring-white" />
                  
                  <div className="min-w-0">
                    <p className="text-gray-800 font-semibold text-sm truncate">{cleanItemName(oi.menu_item_name)}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{oi.quantity}x @ {formatRupiah(oi.unit_price)}</p>
                  </div>
                  <span className="text-gray-900 text-sm font-bold flex-shrink-0">
                    {formatRupiah(oi.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-5 border-t border-dashed border-gray-200">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Tagihan</p>
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="font-bold text-2xl text-gray-900">
                  {formatRupiah(order.total_amount)}
                </span>
              </div>
            </div>

            {order.notes && (
              <div className="mt-4 bg-amber-50 rounded-xl p-4 text-sm text-amber-800 border border-amber-100/50">
                <span className="font-bold">Catatan: </span>
                {order.notes}
              </div>
            )}
          </div>
        )}

        {/* ── Auto redirect progress ── */}
        <div className="px-2 pt-2 pb-4">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-3 uppercase tracking-wider">
            <span>Kembali ke menu</span>
            <span>{timeLeft} detik</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / 15) * 150}%` }}
            />
          </div>
          
          <button 
            onClick={() => router.push('/')} 
            className="w-full mt-6 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group shadow-sm active:scale-95"
          >
            Kembali ke Menu Sekarang
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="w-8 h-8 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  )
}
