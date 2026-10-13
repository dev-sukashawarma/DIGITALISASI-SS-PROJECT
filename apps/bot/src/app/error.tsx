'use client'

import { useEffect } from 'react'
import { ShieldAlert, RefreshCw, Home } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[JARVIS HUD CRASH DETECTED]:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#030712] text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-mono-hud">
      {/* HUD Background Grid Lines */}
      <div className="absolute inset-0 jarvis-grid opacity-25 pointer-events-none" />

      {/* Anomaly Box */}
      <div className="relative z-10 max-w-md w-full p-6 sm:p-8 rounded-2xl bg-zinc-950/80 border border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.25)] text-center backdrop-blur-xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-red-950/60 border border-red-500/60 flex items-center justify-center text-red-400 animate-pulse">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-lg sm:text-xl font-bold font-hud tracking-wider text-red-300 uppercase">
          SYSTEM ANOMALY DETECTED
        </h1>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-mono-hud">
          {error?.message || 'Modul Command Centre mengalami kegagalan transmisi tidak terduga.'}
        </p>

        {error?.digest && (
          <div className="mt-3 px-2 py-1 rounded bg-black/60 border border-zinc-800 text-[10px] text-zinc-500 font-mono-hud truncate">
            DIGEST // {error.digest}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-hud text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REINITIALIZE HUD</span>
          </button>

          <a
            href="/"
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-hud text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            <span>RESET CORE</span>
          </a>
        </div>
      </div>
    </div>
  )
}
