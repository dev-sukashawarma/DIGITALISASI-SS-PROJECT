'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function ApproveContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; newStatus?: string } | null>(null)
  
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setResult({ success: false, message: 'Token tidak ditemukan.' })
      setDetailsLoading(false)
      return
    }

    fetch(`/api/cancellations/details?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setResult({ success: false, message: data.error })
        } else {
          setUserRole(data.role)
          setOrderDetails(data.order)
        }
      })
      .catch(err => {
        setResult({ success: false, message: 'Gagal memuat detail pesanan.' })
      })
      .finally(() => {
        setDetailsLoading(false)
      })
  }, [token])

  async function handleAction(action: 'approve' | 'reject') {
    if (!token) return

    setLoading(true)
    try {
      const res = await fetch('/api/cancellations/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action })
      })
      const data = await res.json()

      if (!res.ok) {
        setResult({ success: false, message: data.error || 'Terjadi kesalahan.' })
        return
      }

      setResult({ 
        success: true, 
        message: action === 'approve' 
          ? 'Pembatalan pesanan berhasil disetujui.' 
          : 'Pembatalan pesanan berhasil ditolak.',
        newStatus: data.newStatus
      })
    } catch (err: any) {
      setResult({ success: false, message: 'Gagal menghubungi server. Silakan coba lagi.' })
    } finally {
      setLoading(false)
    }
  }

  if (detailsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (userRole === 'crew') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="bg-red-100 text-red-600 p-4 rounded-full mb-4 inline-flex">
            <XCircle size={48} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
          <p className="text-gray-600 mb-8">Maaf, Anda masuk sebagai Crew dan tidak memiliki wewenang untuk menyetujui pembatalan pesanan ini.</p>
          <a
            href="/kasir"
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-md shadow-blue-600/20"
          >
            Kembali ke Kasir
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Konfirmasi Pembatalan</h1>
        
        {result ? (
          <div className="mt-6 flex flex-col items-center">
            {result.success ? (
              <div className={`p-4 rounded-full mb-4 ${result.newStatus === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                {result.newStatus === 'approved' ? <CheckCircle2 size={48} /> : <XCircle size={48} />}
              </div>
            ) : (
              <div className="bg-red-100 text-red-600 p-4 rounded-full mb-4">
                <XCircle size={48} />
              </div>
            )}
            <p className="text-lg font-medium text-gray-800">{result.message}</p>
            <p className="text-gray-500 mt-2">Anda bisa menutup halaman ini.</p>
          </div>
        ) : (
          <>
            {orderDetails && (
              <div className="bg-gray-100 p-4 rounded-xl mb-6 mt-4 text-left border border-gray-200">
                <div className="mb-2">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Outlet</span>
                  <p className="text-sm font-medium text-gray-900">{orderDetails.outletName}</p>
                </div>
                <div className="mb-2">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Pelanggan</span>
                  <p className="text-sm font-medium text-gray-900">{orderDetails.customerName}</p>
                </div>
                <div className="mb-2">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Alasan Pembatalan</span>
                  <p className="text-sm font-medium text-red-600">{orderDetails.reason}</p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Total Belanja</span>
                  <p className="text-lg font-bold text-gray-900">Rp {orderDetails.totalAmount?.toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}
            {!orderDetails && (
              <p className="text-gray-600 mb-8 mt-4">
                Apakah Anda menyetujui permintaan pembatalan pesanan ini? Aksi ini tidak dapat dibatalkan.
              </p>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleAction('approve')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Ya, Setujui Pembatalan
              </button>
              
              <button
                onClick={() => handleAction('reject')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-4 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                Tolak Pembatalan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function CancellationApprovePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    }>
      <ApproveContent />
    </Suspense>
  )
}
