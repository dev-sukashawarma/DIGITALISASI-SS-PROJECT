'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScanFace, Loader2, CheckCircle2, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/components/BrandContext'

export default function AttendanceWaitPage() {
  const router = useRouter()
  const { brandName, brandLogo } = useBrand()
  const [status, setStatus] = useState<'waiting' | 'authenticating' | 'success'>('waiting')
  const [errorMsg, setErrorMsg] = useState('')
  const [cashierInfo, setCashierInfo] = useState<{name: string, branch: string} | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('attendance_events')

    channel.on('broadcast', { event: 'attendance_login' }, async (payload) => {
      console.log('Received attendance payload:', payload)
      setStatus('authenticating')
      
      const { email, password, cashier_name, branch_name } = payload.payload

      // Store information to be picked up by the Kasir Dashboard
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('attendance_cashier_name', cashier_name || '')
        sessionStorage.setItem('attendance_branch_name', branch_name || '')
      }
      setCashierInfo({ name: cashier_name, branch: branch_name })

      // Smart Detection: Pseudo-Email
      let loginEmail = email?.trim() || ''
      if (loginEmail && !loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@outlet.local`
      }

      // Authenticate
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
      })

      if (authError) {
        console.error('Auto-login failed:', authError)
        setErrorMsg('Gagal login otomatis: ' + authError.message)
        setStatus('waiting')
        return
      }

      setStatus('success')
      
      // Delay slightly for UX before redirecting
      setTimeout(() => {
        router.push('/kasir')
        router.refresh()
      }, 1500)
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Listening for attendance events...')
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] relative overflow-hidden selection:bg-amber-100 p-4">
      {/* Background Decorations */}
      <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-amber-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[480px] bg-white rounded-[2rem] shadow-2xl shadow-amber-900/5 border border-amber-100/50 p-8 sm:p-12 relative z-10 text-center flex flex-col items-center">
        
        {/* Animated Icon Area */}
        <div className="relative mb-8">
          {status === 'waiting' && (
            <div className="relative">
              <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-50" />
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center relative z-10 border-4 border-white shadow-lg">
                <ScanFace className="w-12 h-12 text-blue-500" strokeWidth={1.5} />
              </div>
            </div>
          )}
          {status === 'authenticating' && (
            <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin" strokeWidth={1.5} />
            </div>
          )}
          {status === 'success' && (
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg animate-bounce">
              <CheckCircle2 className="w-12 h-12 text-green-500" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Status Text */}
        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-3">
          {status === 'waiting' && 'Menunggu Absensi...'}
          {status === 'authenticating' && 'Memproses Auto-Login...'}
          {status === 'success' && 'Absensi Berhasil!'}
        </h2>
        
        <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-[300px]">
          {status === 'waiting' && 'Silakan lakukan scan wajah di mesin absensi. Sistem POS ini akan terbuka otomatis setelah berhasil.'}
          {status === 'authenticating' && 'Sedang mencocokkan kredensial kasir dari sistem absensi.'}
          {status === 'success' && `Selamat bekerja, ${cashierInfo?.name || 'Kasir'}! Mengarahkan ke dashboard...`}
        </p>

        {errorMsg && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 w-full">
            {errorMsg}
          </div>
        )}

        {/* Decorative Brand footer */}
        <div className="mt-12 pt-6 border-t border-gray-100 w-full flex flex-col items-center gap-3">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-10 h-10 object-cover rounded-xl grayscale opacity-50" />
          ) : (
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{brandName} POS SYSTEM</div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <UserCheck className="w-4 h-4" />
            Terintegrasi dengan Face Recognition
          </div>
        </div>

      </div>
    </div>
  )
}
