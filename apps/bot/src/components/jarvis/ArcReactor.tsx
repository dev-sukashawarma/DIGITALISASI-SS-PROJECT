'use client'

import { useState } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
import { Cpu, ShieldCheck } from 'lucide-react'

interface ArcReactorProps {
  status: 'optimal' | 'processing' | 'warning'
  agentAktifCount: number
  totalMeja: number
  onClickCore?: () => void
}

export default function ArcReactor({
  status = 'optimal',
  agentAktifCount,
  totalMeja,
  onClickCore,
}: ArcReactorProps) {
  const [hovered, setHovered] = useState(false)

  const handleKlik = () => {
    mainkanSuaraHud('engage')
    onClickCore?.()
  }

  // Warna aksen berdasarkan status
  const warnaAksen = status === 'warning' ? '#ef4444' : status === 'processing' ? '#f59e0b' : '#06b6d4'
  const glowClass = status === 'warning' ? 'shadow-[0_0_50px_rgba(239,68,68,0.4)]' : status === 'processing' ? 'shadow-[0_0_50px_rgba(245,158,11,0.4)]' : 'shadow-[0_0_50px_rgba(6,182,212,0.4)]'

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-2">
      {/* Target Reticle Corners */}
      <div className="relative flex items-center justify-center w-52 h-52 sm:w-60 sm:h-60 lg:w-64 lg:h-64">
        {/* Corner Reticles */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-500/40 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none" />

        {/* Ambient Back Glow */}
        <div 
          className="absolute inset-4 rounded-full blur-2xl opacity-40 transition-all duration-700 pointer-events-none"
          style={{ backgroundColor: warnaAksen }}
        />

        {/* Outer Ring Tachymeter (Rotates Clockwise) */}
        <div className="absolute inset-2 animate-hud-spin pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 200 200">
            {/* Ticks and degree markers */}
            <circle
              cx="100"
              cy="100"
              r="94"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1.5"
              strokeDasharray="4 8 1 8"
              opacity="0.5"
            />
            <circle
              cx="100"
              cy="100"
              r="86"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1"
              strokeDasharray="18 4 2 4"
              opacity="0.35"
            />
            <path d="M100 2 L100 8 M100 192 L100 198 M2 100 L8 100 M192 100 L198 100" stroke={warnaAksen} strokeWidth="2" opacity="0.8" />
          </svg>
        </div>

        {/* Inner Segmented Ring (Rotates Counter-Clockwise) */}
        <div className="absolute inset-8 animate-hud-spin-reverse pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r="72"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="2.5"
              strokeDasharray="30 15 10 15"
              opacity="0.65"
            />
            <circle
              cx="80"
              cy="80"
              r="64"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.4"
            />
          </svg>
        </div>

        {/* Inner Third Ring */}
        <div className="absolute inset-14 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1.5"
              strokeDasharray="6 3 12 3"
              opacity="0.55"
            />
          </svg>
        </div>

        {/* Central Arc Core Orb (Interactive Button) */}
        <button
          onClick={handleKlik}
          onMouseEnter={() => {
            setHovered(true)
            mainkanSuaraHud('chirp')
          }}
          onMouseLeave={() => setHovered(false)}
          className={`group relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${glowClass} ${
            hovered ? 'scale-105 ring-2 ring-cyan-300' : 'ring-1 ring-cyan-500/50'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.3) 0%, rgba(3,7,18,0.92) 80%)',
          }}
          aria-label="Aktivasi Hermes Core"
        >
          {/* Subtle Hexagon / Grid Mesh Texture */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:8px_8px]" />

          {/* Central Logo / Pulse Icon */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              <Cpu className="w-8 h-8 sm:w-9 sm:h-9 text-cyan-300 animate-pulse group-hover:scale-110 transition-transform" />
              <div className="absolute inset-0 blur-sm bg-cyan-400/40 rounded-full animate-ping pointer-events-none" />
            </div>

            <span className="mt-1 font-hud text-[10px] sm:text-xs tracking-widest text-cyan-200 font-bold uppercase text-glow-cyan">
              HERMES
            </span>
            <span className="font-mono-hud text-[9px] tracking-wider text-cyan-400/80">
              CORE v2.4
            </span>
          </div>

          {/* Frequency Equalizer Bars (Mini Waveform) */}
          <div className="relative z-10 flex items-end gap-[3px] mt-1 h-3 pointer-events-none">
            <div className="w-[2px] bg-cyan-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2" />
            <div className="w-[2px] bg-cyan-300 rounded-full animate-[pulse_1.2s_ease-in-out_infinite_0.2s] h-3" />
            <div className="w-[2px] bg-cyan-400 rounded-full animate-[pulse_0.9s_ease-in-out_infinite_0.4s] h-1.5" />
            <div className="w-[2px] bg-cyan-300 rounded-full animate-[pulse_1.1s_ease-in-out_infinite_0.1s] h-2.5" />
            <div className="w-[2px] bg-cyan-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.3s] h-2" />
          </div>
        </button>
      </div>

      {/* Telemetry Readouts Under Core */}
      <div className="mt-3 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-hud text-[10px] uppercase tracking-widest text-cyan-300 font-semibold">
            {status === 'warning' ? 'ANOMALY DETECTED' : status === 'processing' ? 'PROCESSING STREAM' : 'SYSTEM OPERATIONAL'}
          </span>
          <span className="text-cyan-500/40">|</span>
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono-hud text-[10px] text-cyan-200/90 tracking-wider">
            NODES {agentAktifCount}/{totalMeja || 4} ACTIVE
          </span>
        </div>

        <p className="mt-1.5 font-mono-hud text-[11px] text-cyan-400/60 tracking-wider">
          COGNITIVE MATRIX LINKED &bull; 9ROUTER / CLAUDE 3.7
        </p>
      </div>
    </div>
  )
}
