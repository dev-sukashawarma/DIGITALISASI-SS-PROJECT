'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  QrCode, CheckCircle2, Clock, Shield, Smartphone,
  Loader2, Sparkles, ArrowLeft
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/validations'

function QRISPaymentContent() {
  const router = useRouter()
  const params = useSearchParams()
  const orderId = params.get('id')
  const orderNumber = params.get('number')
  const totalStr = params.get('total')
  const total = totalStr ? parseInt(totalStr) : 0

  const [status, setStatus] = useState<'waiting' | 'processing' | 'success'>('waiting')
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes
  const [pulseAnim, setPulseAnim] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (status !== 'waiting') return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [status])

  // Pulse animation loop
  useEffect(() => {
    if (status !== 'waiting') return
    const interval = setInterval(() => {
      setPulseAnim(true)
      setTimeout(() => setPulseAnim(false), 1500)
    }, 3000)
    return () => clearInterval(interval)
  }, [status])

  // (Auto-simulate removed as requested)


  // Simulate payment
  async function handleSimulatePayment() {
    if (!orderId) return
    setStatus('processing')

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Update order to preparing (straight to kitchen)
    await fetch('/api/qris-simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    })

    setStatus('success')

    // Redirect to success after a moment
    setTimeout(() => {
      router.push(`/order-success?id=${orderId}&number=${orderNumber}&pay=qris`)
    }, 1000)
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  // Generate a QR code URL using a free API
  const qrData = `shawarma-kiosk://pay?order=${orderNumber}&amount=${total}&id=${orderId}`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=1e293b&margin=12`

  if (!orderId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFBF5]">
        <p className="text-gray-500">Halaman tidak ditemukan</p>
        <Link href="/" className="btn-primary">Kembali ke Menu</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-[#f0f7ff] to-white flex items-start justify-center pt-6 pb-16 px-4">
      <div className="w-full max-w-md space-y-4 animate-fade-up">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-1">
          <Link
            href="/"
            className="w-9 h-9 bg-white/80 hover:bg-white border border-blue-100 rounded-xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 leading-none">Pembayaran QRIS</h1>
            <p className="text-blue-500 text-xs mt-0.5 font-medium">Scan QR untuk membayar</p>
          </div>
        </div>

        {/* ── QR Card ── */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden relative">

          {/* Top accent bar */}
          <div className="h-1 bg-blue-500" />

          <div className="p-6 pb-5 text-center">

            {/* Amount badge */}
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-5 py-2.5 rounded-2xl mb-5">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Total Pembayaran</span>
              <span className="text-lg font-bold text-blue-700">{formatRupiah(total)}</span>
            </div>

            {/* QR Code Container */}
            <div className={`relative inline-block transition-transform duration-300 ${pulseAnim ? 'scale-[1.02]' : 'scale-100'}`}>
              {/* Decorative corners */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-[3px] border-l-[3px] border-blue-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-[3px] border-r-[3px] border-blue-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-[3px] border-l-[3px] border-blue-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-[3px] border-r-[3px] border-blue-500 rounded-br-lg" />

              {/* Scanning line animation */}
              {status === 'waiting' && (
                <div className="absolute inset-4 overflow-hidden rounded-xl z-10 pointer-events-none">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-line" />
                </div>
              )}

              {/* QR Image */}
              <div className={`bg-white p-3 rounded-2xl border-2 border-gray-100 relative ${status === 'success' ? 'opacity-30' : ''}`}>
                <img
                  src={qrImageUrl}
                  alt="QR Code Pembayaran QRIS"
                  width={260}
                  height={260}
                  className="rounded-xl"
                />
              </div>

              {/* Success overlay */}
              {status === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200 animate-bounce-in">
                    <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              )}

              {/* Processing overlay */}
              {status === 'processing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/60 backdrop-blur-sm rounded-2xl">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-2" />
                  <p className="text-sm font-bold text-blue-600">Memverifikasi...</p>
                </div>
              )}
            </div>

            {/* Timer */}
            {status === 'waiting' && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 font-medium">Berlaku</span>
                <span className={`font-bold tabular-nums ${timeLeft <= 60 ? 'text-red-500' : 'text-gray-800'}`}>
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Success message */}
            {status === 'success' && (
              <div className="mt-5">
                <p className="text-lg font-bold text-emerald-600">Pembayaran Berhasil! 🎉</p>
                <p className="text-sm text-gray-400 mt-1">Mengalihkan ke halaman pesanan...</p>
              </div>
            )}
          </div>

          {/* Payment methods strip */}
          <div className="bg-gray-50/70 border-t border-gray-100 px-6 py-3 flex items-center justify-center gap-3">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Didukung oleh</span>
            <div className="flex items-center gap-2.5">
              {['GoPay', 'OVO', 'Dana', 'ShopeePay', 'LinkAja'].map(w => (
                <span key={w} className="text-[10px] font-bold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-100">
                  {w}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── How to pay ── */}
        <div className="bg-white rounded-2xl border border-blue-100/50 p-5">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-500" />
            Cara Pembayaran
          </p>
          <div className="space-y-2.5">
            {[
              'Buka aplikasi e-wallet atau m-banking kamu',
              'Pilih menu Scan QR / Bayar',
              'Arahkan kamera ke kode QR di atas',
              'Konfirmasi pembayaran di aplikasi',
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm text-gray-600 leading-snug">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Simulate Button ── */}
        {status === 'waiting' && (
          <div className="pt-2">
            <button
              onClick={handleSimulatePayment}
              className="w-full relative overflow-hidden group bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 hover:from-emerald-400 hover:via-emerald-400 hover:to-teal-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

              <Sparkles className="w-5 h-5 relative" />
              <span className="relative">Simulasi Pembayaran Berhasil</span>
            </button>

            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Tombol ini hanya untuk demo — di produksi akan otomatis terverifikasi</span>
            </div>
          </div>
        )}

        {/* ── Order info ── */}
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400 pt-2">
          <span>Pesanan #{orderNumber}</span>
          <span>•</span>
          <span>{formatRupiah(total)}</span>
        </div>

      </div>

      {/* ── Custom CSS for scan animation ── */}
      <style jsx>{`
        @keyframes scan-line {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(260px); opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2.5s ease-in-out infinite;
        }
        @keyframes bounce-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default function QRISPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 via-[#f0f7ff] to-white">
        <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
      </div>
    }>
      <QRISPaymentContent />
    </Suspense>
  )
}
