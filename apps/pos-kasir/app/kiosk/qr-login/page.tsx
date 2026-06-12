'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

function QRLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function doLogin() {
      const u = searchParams.get('u')
      const p = searchParams.get('p')

      if (!u || !p) {
        setStatus('error')
        setErrorMsg('Tautan QR Code tidak valid atau rusak.')
        return
      }

      // SECURITY: Segera hapus username dan password dari URL bar dan riwayat (history)
      // agar tidak bisa dilihat oleh pelanggan jika mereka membongkar browser Kiosk.
      window.history.replaceState(null, '', '/kiosk/qr-login')

      const supabase = createClient()
      
      // Auto login using the provided credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${u}@outlet.local`,
        password: p
      })

      if (error || !data.user) {
        console.error('QR Login error:', error)
        setStatus('error')
        setErrorMsg('Gagal masuk. Kode QR mungkin sudah kedaluwarsa, silakan buat QR baru dari Kasir.')
        return
      }

      setStatus('success')
      
      // Beri sedikit jeda agar user melihat animasi sukses
      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 1500)
    }

    doLogin()
  }, [router, searchParams])

  return (
    <div className="flex flex-col items-center text-center max-w-sm w-full mx-auto animate-fade-up">
      {status === 'loading' && (
        <>
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Memproses Login...</h1>
          <p className="text-gray-500 font-medium">Mohon tunggu sebentar, sedang menghubungkan ke cabang Anda.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-inner animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Berhasil Terhubung!</h1>
          <p className="text-emerald-600 font-bold">Mengarahkan ke menu Kiosk...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Login Gagal</h1>
          <p className="text-red-600 font-medium mb-8">{errorMsg}</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-gray-900 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-gray-800 transition-colors w-full"
          >
            Kembali ke Login Manual
          </button>
        </>
      )}
    </div>
  )
}

export default function QRLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] relative overflow-hidden selection:bg-amber-100 p-4">
      {/* Subtle Background Decorations */}
      <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-amber-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[420px] bg-white rounded-[2rem] shadow-2xl shadow-amber-900/5 border border-amber-100/50 p-8 sm:p-10 relative z-10">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
        }>
          <QRLoginContent />
        </Suspense>
      </div>
    </div>
  )
}
