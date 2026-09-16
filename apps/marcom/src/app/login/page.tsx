'use client'

import { useEffect, useState } from 'react'
import { Flame, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [portalUrl, setPortalUrl] = useState('https://app.sukashawarma.com')

  useEffect(() => {
    const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    const targetUrl = isLocal
      ? 'http://localhost:3010'
      : (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
    
    setPortalUrl(targetUrl)

    // Pengalihan otomatis ke portal login Suka Shawarma
    window.location.replace(targetUrl)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-200 selection:text-amber-950">
      <div className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-[#EFE8DE] text-center">
        {/* Brand Header */}
        <div className="space-y-3">
          <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E8590C] via-[#D9480F] to-[#9C3106] text-white shadow-lg shadow-orange-950/20 ring-4 ring-[#FFF4ED]">
            <Flame className="w-7 h-7 text-amber-100 fill-amber-200 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFF4ED] text-[#D9480F] text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3 h-3" />
              <span>Single Sign-On Portal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1715] tracking-tight">
              Suka Shawarma
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-stone-500 font-medium">
              Sistem Digitalisasi Marcom & Tracking Influencer
            </p>
          </div>
        </div>

        {/* Redirecting State */}
        <div className="py-6 space-y-4">
          <div className="flex items-center justify-center space-x-2 text-[#D9480F]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold">Mengalihkan ke Portal Login Utama...</span>
          </div>
          <p className="text-xs text-stone-400">
            Seluruh autentikasi staf & manajemen terpusat di portal <code className="text-stone-600 font-mono bg-stone-100 px-1 py-0.5 rounded">{portalUrl}</code>
          </p>
        </div>

        {/* Manual Fallback Action */}
        <div>
          <a
            href={portalUrl}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 text-sm font-bold rounded-xl text-white bg-[#D9480F] hover:bg-[#B83808] transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <span>Buka Portal Login Suka Shawarma</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="pt-2">
          <span className="text-[11px] text-stone-400">
            Akses otomatis tersambung jika Anda sudah login di app.sukashawarma.com.
          </span>
        </div>
      </div>
    </div>
  )
}

