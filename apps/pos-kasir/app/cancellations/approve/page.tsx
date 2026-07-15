'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function ApproveContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; newStatus?: string } | null>(null)

  useEffect(() => {
    if (!token) {
      setResult({ success: false, message: 'Token tidak ditemukan.' })
    }
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
            <p className="text-gray-600 mb-8 mt-4">
              Apakah Anda menyetujui permintaan pembatalan pesanan ini? Aksi ini tidak dapat dibatalkan.
            </p>

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
