'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-sm max-w-md w-full p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1A1715]">
            Terjadi Kesalahan Server
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {error.message || 'Aplikasi mengalami kendala sementara saat memuat data.'}
          </p>
          {error.digest && (
            <p className="text-[10px] text-stone-400 font-mono mt-2 bg-stone-50 py-1 px-2 rounded-lg border border-[#EFE8DE] inline-block">
              Digest: {error.digest}
            </p>
          )}
        </div>
        <div className="pt-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D9480F] hover:bg-[#B83808] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Muat Ulang Halaman</span>
          </button>
        </div>
      </div>
    </div>
  )
}
