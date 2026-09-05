'use client'

import { useState, useEffect } from 'react'
import {
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  Moon,
  Sun,
  Radio,
  Sparkles,
  Crown,
} from 'lucide-react'

export function BoardHeader({
  lastOk,
  stale,
  showRupiah,
  onToggleRupiah,
  theme,
  onToggleTheme,
  nowLabel,
  onSimulateShift,
}: {
  lastOk: string | null
  stale: boolean
  showRupiah: boolean
  onToggleRupiah: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  nowLabel: string
  onSimulateShift?: () => void
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [ageSec, setAgeSec] = useState<number | null>(null)

  // Track age in seconds accurately
  useEffect(() => {
    if (!lastOk) {
      setAgeSec(null)
      return
    }

    const calc = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(lastOk).getTime()) / 1000))
      setAgeSec(diff)
    }

    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [lastOk])

  // Fullscreen state listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  return (
    <header className="relative flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 rounded-2xl border border-[var(--border-card)]/80 bg-gradient-to-r from-[var(--card-bg)]/95 via-[var(--card-bg)]/80 to-[var(--card-bg)]/95 backdrop-blur-md px-4 lg:px-6 py-2.5 shadow-[0_4px_25px_rgba(0,0,0,0.4)] transition-all shrink-0 overflow-hidden">
      {/* Stadium ambient gold flare in the center */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-[450px] bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent pointer-events-none blur-xl" />

      {/* Subtle bottom golden hairline laser */}
      <div className="absolute bottom-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />

      {/* SAYAP KIRI: Live Broadcast & Clock Telemetry (1/3 Lebar) */}
      <div className="relative z-10 w-full md:w-1/3 flex items-center justify-start gap-2.5">
        <div className="flex items-center gap-2.5 rounded-xl bg-black/45 border border-white/10 px-3 py-1.5 shadow-inner backdrop-blur-sm">
          {/* Live Broadcast Badge */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 select-none">
              LIVE BROADCAST
            </span>
          </div>

          <div className="h-3.5 w-px bg-white/15" />

          {/* Realtime Clock WIB */}
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-200 tabular font-mono">
            <Radio size={12} className="text-amber-400 animate-pulse" />
            <span>{nowLabel}</span>
          </div>

          {/* Network Latency Status */}
          <span className="hidden xl:inline text-[10px] text-slate-400 font-mono border-l border-white/15 pl-2">
            {stale ? (
              <span className="text-rose-400">Delay</span>
            ) : ageSec === null ? (
              'Sync...'
            ) : (
              `Sync ${ageSec}s`
            )}
          </span>
        </div>
      </div>

      {/* PUSAT PANGGUNG (CENTER): Official Logo & Championship Title (1/3 Lebar) */}
      <div className="relative z-10 w-full md:w-1/3 flex items-center justify-center">
        <div className="flex items-center gap-3">
          {/* Official Suka Shawarma Logo with Golden Ambient Aura */}
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/25 via-amber-600/10 to-amber-700/5 border border-amber-500/50 p-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/40 shrink-0">
            <img
              src="/logo.png"
              alt="Suka Shawarma"
              className="h-full w-full object-contain drop-shadow-sm"
            />
          </div>

          <div className="flex flex-col items-start text-left">
            <div className="flex items-center gap-1.5">
              <Crown size={12} className="text-amber-400 fill-amber-400/40" />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-amber-400">
                SUKA SHAWARMA
              </span>
            </div>
            <h1 className="text-base lg:text-xl font-black uppercase tracking-wider text-[var(--text-primary)] leading-none mt-0.5 drop-shadow-sm">
              SALES PERFORMANCE DASHBOARD
            </h1>
          </div>
        </div>
      </div>

      {/* SAYAP KANAN: Cockpit Action Controls (1/3 Lebar) */}
      <div className="relative z-10 w-full md:w-1/3 flex items-center justify-end gap-2">
        {/* Simulasi Salip Button (Hotkey: S) */}
        {onSimulateShift && (
          <button
            onClick={onSimulateShift}
            title="Simulasikan Pergeseran Peringkat Leaderboard (Shortcut: S)"
            className="group cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-amber-600/10 px-3 py-1.5 text-xs font-black text-amber-300 hover:from-amber-500/30 hover:to-amber-600/20 active:scale-[0.96] transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
          >
            <Sparkles size={13} className="text-amber-400 animate-pulse" />
            <span className="text-[11px] uppercase tracking-wider">Simulasi Salip</span>
            <kbd className="hidden lg:inline-block rounded border border-amber-500/40 bg-amber-500/20 px-1 py-0.2 text-[9px] text-amber-200 font-mono">
              S
            </kbd>
          </button>
        )}

        {/* Action Controls: Rupiah [R], Theme [T], Fullscreen [F] */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/45 p-1 backdrop-blur-sm">
          {/* Rupiah Privacy Toggle */}
          <button
            onClick={onToggleRupiah}
            title="Tampilkan / Sembunyikan Nominal Rupiah (Shortcut: R)"
            className={`group cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold active:scale-[0.96] transition-all ${
              showRupiah
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {showRupiah ? <Eye size={13} /> : <EyeOff size={13} />}
            <span className="hidden xl:inline text-[11px]">
              {showRupiah ? 'Rp Aktif' : 'Rp Sembunyi'}
            </span>
            <kbd className="hidden sm:inline-block rounded border border-white/15 px-1 text-[9px] text-slate-400 font-mono">
              R
            </kbd>
          </button>

          {/* Theme Switcher Toggle */}
          <button
            onClick={onToggleTheme}
            title={`Ubah Tema (Shortcut: T)`}
            className="cursor-pointer inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 active:scale-[0.95] transition-all"
          >
            {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-amber-500" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="Layar Penuh TV (Shortcut: F)"
            className="cursor-pointer inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 active:scale-[0.95] transition-all"
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      </div>
    </header>
  )
}
