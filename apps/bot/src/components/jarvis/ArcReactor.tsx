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
  const glowClass = status === 'warning' 
    ? 'shadow-[0_0_70px_rgba(239,68,68,0.5)]' 
    : status === 'processing' 
      ? 'shadow-[0_0_70px_rgba(245,158,11,0.5)]' 
      : 'shadow-[0_0_70px_rgba(6,182,212,0.5)]'

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-1 sm:py-2 w-full">
      {/* Target Reticle Container: Greatly enlarged with responsive scaling & viewport height protection */}
      <div className="relative flex items-center justify-center w-[290px] h-[290px] sm:w-[360px] sm:h-[360px] md:w-[410px] md:h-[410px] lg:w-[440px] lg:h-[440px] xl:w-[500px] xl:h-[500px] 2xl:w-[560px] 2xl:h-[560px] max-w-[min(100%,50vh)] max-h-[50vh] aspect-square">
        {/* Corner Reticles with Sci-Fi HUD Coordinates */}
        <div className="absolute top-0 left-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-t-2 border-l-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col justify-start">
          <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/60 font-semibold tracking-wider leading-none">SYS // CORE-00</span>
        </div>
        <div className="absolute top-0 right-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-t-2 border-r-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col items-end justify-start">
          <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/60 font-semibold tracking-wider leading-none">142.8 GHz</span>
        </div>
        <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-b-2 border-l-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col justify-end">
          <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/60 font-semibold tracking-wider leading-none">RADAR // OK</span>
        </div>
        <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-b-2 border-r-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col items-end justify-end">
          <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/60 font-semibold tracking-wider leading-none">MK-VII</span>
        </div>

        {/* Ambient Back Glow - Dynamic aura behind entire core */}
        <div 
          className="absolute inset-[4%] rounded-full blur-3xl opacity-35 transition-all duration-700 pointer-events-none animate-hud-pulse"
          style={{ backgroundColor: warnaAksen }}
        />

        {/* Layer 1: Outermost Tachymeter & Degree Compass (Rotates Clockwise Slow) */}
        <div className="absolute inset-0 sm:inset-1 animate-hud-spin pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 400">
            {/* Fine outer tick ring */}
            <circle
              cx="200"
              cy="200"
              r="192"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1.5"
              strokeDasharray="3 6"
              opacity="0.35"
            />
            {/* Degree scale ring */}
            <circle
              cx="200"
              cy="200"
              r="182"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1"
              strokeDasharray="20 4 2 4"
              opacity="0.35"
            />
            {/* 4 Heavy segmented arc sectors */}
            <circle
              cx="200"
              cy="200"
              r="172"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="2.5"
              strokeDasharray="70 20 15 20"
              opacity="0.65"
            />
            {/* Cardinal Crosshair lines */}
            <path d="M200 4 L200 18 M200 382 L200 396 M4 200 L18 200 M382 200 L396 200" stroke={warnaAksen} strokeWidth="2.5" opacity="0.9" />
            {/* Diagonal Tick markers */}
            <path d="M62 62 L72 72 M338 62 L328 72 M62 338 L72 328 M338 338 L328 328" stroke={warnaAksen} strokeWidth="1.5" opacity="0.6" />
            {/* Degree labels in monospace */}
            <text x="200" y="32" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">000°</text>
            <text x="368" y="203" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">090°</text>
            <text x="200" y="378" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">180°</text>
            <text x="32" y="203" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">270°</text>
          </svg>
        </div>

        {/* Layer 2: Counter-Rotating Tactical Ring with Node Anchors (Rotates Counter-Clockwise) */}
        <div className="absolute inset-[6%] animate-hud-spin-reverse pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 340 340">
            <circle
              cx="170"
              cy="170"
              r="160"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="2.5"
              strokeDasharray="45 15 10 15"
              opacity="0.7"
            />
            <circle
              cx="170"
              cy="170"
              r="148"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.45"
            />
            {/* 4 Orbital Satellite Nodes representing linked agent pods */}
            <circle cx="276" cy="64" r="3.5" fill={warnaAksen} opacity="0.85" />
            <circle cx="276" cy="276" r="3.5" fill={warnaAksen} opacity="0.85" />
            <circle cx="64" cy="276" r="3.5" fill={warnaAksen} opacity="0.85" />
            <circle cx="64" cy="64" r="3.5" fill={warnaAksen} opacity="0.85" />
          </svg>
        </div>

        {/* Layer 3: Middle Turbine / Aperture Segment Ring (Rotates Clockwise) */}
        <div className="absolute inset-[13%] animate-hud-spin pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 280 280">
            <circle
              cx="140"
              cy="140"
              r="128"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="2"
              strokeDasharray="18 10 32 10"
              opacity="0.6"
            />
            <circle
              cx="140"
              cy="140"
              r="116"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1.5"
              strokeDasharray="4 6"
              opacity="0.5"
            />
          </svg>
        </div>

        {/* Layer 4: Core Plasma Containment Arc (Rotates Counter-Clockwise Fast) */}
        <div className="absolute inset-[19%] animate-hud-spin-reverse pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r="98"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="2.5"
              strokeDasharray="60 15 20 15"
              opacity="0.8"
            />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1"
              strokeDasharray="6 3 12 3"
              opacity="0.5"
            />
          </svg>
        </div>

        {/* Central Arc Core Orb (Interactive Button, scaled proportionally to 50% of container) */}
        <button
          onClick={handleKlik}
          onMouseEnter={() => {
            setHovered(true)
            mainkanSuaraHud('chirp')
          }}
          onMouseLeave={() => setHovered(false)}
          className={`group relative z-10 w-[50%] h-[50%] rounded-full flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${glowClass} ${
            hovered ? 'scale-105 ring-2 ring-cyan-300' : 'ring-1 ring-cyan-500/50'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.38) 0%, rgba(8,47,73,0.7) 48%, rgba(3,7,18,0.96) 92%)',
          }}
          aria-label="Aktivasi Hermes Core"
        >
          {/* Subtle Hexagon / Grid Mesh Texture */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:10px_10px]" />

          {/* Micro-ring rotating inside core */}
          <div className="absolute inset-2 sm:inset-3 rounded-full border border-cyan-400/25 border-dashed animate-hud-spin pointer-events-none" />

          {/* Central Logo / Pulse Icon */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              <Cpu className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-15 lg:h-15 xl:w-16 xl:h-16 text-cyan-200 group-hover:text-white group-hover:scale-110 transition-all drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
              <div className="absolute inset-0 blur-md bg-cyan-400/50 rounded-full animate-ping pointer-events-none" />
            </div>

            <span className="mt-1 sm:mt-1.5 font-hud text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl tracking-[0.25em] text-cyan-100 group-hover:text-white font-black uppercase text-glow-cyan">
              HERMES
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono-hud text-[9px] sm:text-[10px] md:text-xs tracking-widest text-cyan-300 font-bold">
                CORE v2.4
              </span>
              <span className="text-cyan-500/60 text-[9px]">•</span>
              <span className="font-mono-hud text-[8px] sm:text-[9px] md:text-[10px] tracking-wider text-cyan-400/80 uppercase">
                AI ENGINE
              </span>
            </div>
          </div>

          {/* Frequency Equalizer Bars (9-Band Waveform) */}
          <div className="relative z-10 flex items-end gap-[3px] sm:gap-1 mt-1 sm:mt-2 h-3.5 sm:h-4 lg:h-5 pointer-events-none">
            <div className="w-[2px] sm:w-[3px] bg-cyan-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-2 sm:h-2.5" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-300 rounded-full animate-[pulse_1.1s_ease-in-out_infinite_0.1s] h-3 sm:h-4" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite_0.3s] h-1.5 sm:h-2" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-200 rounded-full animate-[pulse_1.3s_ease-in-out_infinite_0.15s] h-3.5 sm:h-5" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-400 rounded-full animate-[pulse_0.9s_ease-in-out_infinite_0.4s] h-2 sm:h-3" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-200 rounded-full animate-[pulse_1.2s_ease-in-out_infinite_0.2s] h-3.5 sm:h-5" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-400 rounded-full animate-[pulse_0.85s_ease-in-out_infinite_0.35s] h-1.5 sm:h-2" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-300 rounded-full animate-[pulse_1.05s_ease-in-out_infinite_0.25s] h-3 sm:h-4" />
            <div className="w-[2px] sm:w-[3px] bg-cyan-400 rounded-full animate-[pulse_0.75s_ease-in-out_infinite_0.05s] h-2 sm:h-2.5" />
          </div>
        </button>
      </div>

      {/* Telemetry Readouts Under Core */}
      <div className="mt-3 sm:mt-4 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-full bg-cyan-950/60 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.25)]">
          <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-hud text-[10px] sm:text-xs uppercase tracking-widest text-cyan-200 font-bold">
            {status === 'warning' ? 'ANOMALY DETECTED' : status === 'processing' ? 'PROCESSING STREAM' : 'SYSTEM OPERATIONAL'}
          </span>
          <span className="text-cyan-500/50">|</span>
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          <span className="font-mono-hud text-[10px] sm:text-xs text-cyan-100 font-semibold tracking-wider">
            NODES {agentAktifCount}/{totalMeja || 4} ACTIVE
          </span>
        </div>

        <p className="mt-1.5 font-mono-hud text-[11px] sm:text-xs text-cyan-400/80 tracking-widest uppercase">
          COGNITIVE MATRIX LINKED &bull; 9ROUTER / CLAUDE 3.7
        </p>

        <p className="mt-0.5 font-mono-hud text-[9px] sm:text-[10px] text-cyan-400/40 tracking-wider">
          [ CLICK CORE FOR FULL SYSTEM DIAGNOSTIC ]
        </p>
      </div>
    </div>
  )
}
