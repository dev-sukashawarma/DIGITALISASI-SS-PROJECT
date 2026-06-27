'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, LogIn, Store } from 'lucide-react'

// Login staff (admin/kasir) kini lewat Portal (gerbang SSO tunggal). 
// Device kiosk diaktivasi kasir via `/kiosk/qr-login`.
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export default function LoginPage() {
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  const handleStaffLogin = () => {
    setIsRedirecting(true)
    window.location.replace(PORTAL_URL)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] relative overflow-hidden selection:bg-amber-100 p-4">
      {/* Subtle Background Decorations */}
      <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-amber-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[420px] bg-white rounded-[2rem] shadow-2xl shadow-amber-900/5 border border-amber-100/50 p-8 sm:p-10 relative z-10 text-center animate-fade-up">
        
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Store className="w-10 h-10 text-amber-500" />
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Suka Shawarma</h1>
        <p className="text-gray-500 font-medium mb-8">Pilih metode masuk untuk perangkat ini</p>
        
        <div className="flex flex-col gap-4">
          <button
            onClick={() => router.push('/kiosk/qr-login')}
            className="flex items-center justify-center gap-3 bg-amber-500 text-white font-bold py-4 px-6 rounded-xl hover:bg-amber-600 transition-colors w-full shadow-lg shadow-amber-500/30"
          >
            <QrCode className="w-5 h-5" />
            Buka Scanner Kiosk
          </button>
          
          <button
            onClick={handleStaffLogin}
            disabled={isRedirecting}
            className="flex items-center justify-center gap-3 bg-gray-100 text-gray-700 font-bold py-4 px-6 rounded-xl hover:bg-gray-200 transition-colors w-full"
          >
            {isRedirecting ? (
              <span className="animate-pulse">Mengalihkan...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Login Kasir / Admin
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
