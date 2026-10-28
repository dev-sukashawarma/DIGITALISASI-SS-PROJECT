'use client'

import { useState } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
import { Cpu, Mic, Volume2 } from 'lucide-react'

export type StatusArcReactor = 'optimal' | 'listening' | 'processing' | 'speaking' | 'warning'

export interface AnomaliItem {
  id: string
  level: 'critical' | 'warning' | 'optimal'
  divisi: string
  judul: string
  perintahTindakLanjut?: string
}

interface ArcReactorProps {
  status: StatusArcReactor
  compact?: boolean
  stageMode?: 'center-hero' | 'standalone'
  voiceLoopAktif?: boolean
  spektrumSuara?: number[]
  transkripLive?: string
  anomaliItems?: AnomaliItem[]
  onClickCore?: () => void
  onPilihAnomali?: (item: AnomaliItem) => void
  onBukaDailyBriefing?: () => void
  onBukaChatLengkap?: () => void
  tampilkanTombolBawah?: boolean
  sizeMode?: 'compact' | 'normal' | 'large' | 'muka-doang'
  isMukaDoang?: boolean
  onToggleMukaDoang?: () => void
}

const DEFAULT_SPEKTRUM = [0.2, 0.35, 0.22, 0.45, 0.3, 0.45, 0.22, 0.35, 0.2]

export default function ArcReactor({
  status = 'optimal',
  compact = false,
  stageMode: _stageMode = 'standalone',
  voiceLoopAktif = false,
  spektrumSuara = DEFAULT_SPEKTRUM,
  transkripLive = '',
  anomaliItems: _anomaliItems,
  onClickCore,
  onPilihAnomali: _onPilihAnomali,
  onBukaDailyBriefing: _onBukaDailyBriefing,
  tampilkanTombolBawah: _tampilkanTombolBawah = false,
  sizeMode,
  isMukaDoang = false,
  onToggleMukaDoang,
}: ArcReactorProps) {
  const [hovered, setHovered] = useState(false)

  const handleKlik = () => {
    mainkanSuaraHud('engage')
    onClickCore?.()
  }

  // Warna status aksen luar (Amber saat warning/anomali, Emerald saat listening, Cyan saat normal/bicara)
  const warnaStatus =
    status === 'warning'
      ? '#f59e0b'
      : status === 'processing'
        ? '#38bdf8'
        : status === 'listening'
          ? '#10b981'
          : status === 'speaking'
            ? '#22d3ee'
            : '#06b6d4'

  // Inti plasma energi SELALU cyan/ice blue elektrik untuk mempertahankan keaslian Arc Reactor Iron Man
  const warnaPlasma = '#00f0ff'
  const warnaTurbin = '#22d3ee'

  const glowClass =
    status === 'warning'
      ? 'shadow-[0_0_50px_rgba(6,182,212,0.45),0_0_25px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/60'
      : status === 'processing'
        ? 'shadow-[0_0_60px_rgba(56,189,248,0.5)] ring-1 ring-sky-400/50'
        : status === 'listening'
          ? 'shadow-[0_0_85px_rgba(16,185,129,0.65)] ring-2 ring-emerald-400'
          : status === 'speaking'
            ? 'shadow-[0_0_95px_rgba(34,211,238,0.75)] ring-2 ring-cyan-300'
            : 'shadow-[0_0_65px_rgba(6,182,212,0.45)] ring-1 ring-cyan-400/30'

  const labelStatus =
    status === 'listening'
      ? 'LISTENING // SILAKAN BICARA'
      : status === 'processing'
        ? 'SYNCHRONIZING LIVE DATA...'
        : status === 'speaking'
          ? 'J.A.R.V.I.S. MERESPON (KLIK POTONG)'
          : status === 'warning'
            ? 'ANOMALY DETECTED // SIAGA'
            : voiceLoopAktif
              ? 'VOICE LOOP STANDBY // SIAP MENDENGAR'
              : 'UNIFIED J.A.R.V.I.S. CORE READY'

  const avgEnergy =
    spektrumSuara.reduce((acc, v) => acc + v, 0) / (spektrumSuara.length || 1)
  const micLevelPct = Math.min(100, Math.max(0, Math.round((avgEnergy - 0.15) * 135)))
  const coreScale =
    status === 'speaking' || status === 'listening'
      ? 1 + Math.min(0.08, Math.max(0, (avgEnergy - 0.18) * 0.14))
      : hovered
        ? 1.03
        : 1

  const effectiveSizeMode = sizeMode || (isMukaDoang ? 'muka-doang' : compact ? 'compact' : 'large')

  const containerSizeClass =
    effectiveSizeMode === 'muka-doang'
      ? 'w-full h-full max-w-[min(92vw,58vh)] max-h-[58vh] min-h-[260px] aspect-square'
      : effectiveSizeMode === 'large'
        ? 'w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] md:w-[380px] md:h-[380px] lg:w-[440px] lg:h-[440px] xl:w-[480px] xl:h-[480px] max-w-[min(100%,48vh)] max-h-[48vh] aspect-square'
        : effectiveSizeMode === 'compact'
          ? 'w-[140px] h-[140px] sm:w-[165px] sm:h-[165px] lg:w-[185px] lg:h-[185px] max-w-[min(100%,21vh)] max-h-[21vh] aspect-square'
          : 'w-[200px] h-[200px] sm:w-[230px] sm:h-[230px] md:w-[260px] md:h-[260px] lg:w-[290px] lg:h-[290px] xl:w-[320px] xl:h-[320px] max-w-[min(100%,32vh)] max-h-[32vh] aspect-square'

  return (
    <div className={`relative flex flex-col items-center justify-center select-none py-0.5 w-full transition-all duration-300 ${isMukaDoang ? 'h-full flex-1' : ''}`}>
      {/* Target Reticle Container */}
      <div
        onDoubleClick={(e) => {
          e.stopPropagation()
          mainkanSuaraHud('chirp')
          onToggleMukaDoang?.()
        }}
        className={`relative flex items-center justify-center transition-all duration-300 ${containerSizeClass}`}
        title="Klik ganda untuk Mode Muka Doang // Klik untuk bicara"
      >
        {/* Ambient Plasma Glow (Electric Cyan Core) */}
        <div
          className="absolute inset-[12%] rounded-full blur-2xl opacity-45 transition-all duration-300 pointer-events-none animate-hud-pulse bg-cyan-400/40"
        />

        {/* Subtle Outer Status Rim Glow (Hanya halo lembut di pinggir jika warning/listening) */}
        {status !== 'optimal' && (
          <div
            className="absolute inset-[2%] rounded-full blur-3xl opacity-30 transition-all duration-300 pointer-events-none"
            style={{ backgroundColor: warnaStatus }}
          />
        )}

        {/* Layer 1: Outermost Tachymeter & Degree Compass (Bereaksi terhadap status) */}
        <div className="absolute inset-0 sm:inset-1 animate-hud-spin pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 400">
            <circle
              cx="200"
              cy="200"
              r="192"
              fill="none"
              stroke={warnaStatus}
              strokeWidth="1.5"
              strokeDasharray="3 6"
              opacity="0.35"
            />
            <circle
              cx="200"
              cy="200"
              r="182"
              fill="none"
              stroke={warnaStatus}
              strokeWidth="1"
              strokeDasharray="20 4 2 4"
              opacity="0.35"
            />
            <circle
              cx="200"
              cy="200"
              r="172"
              fill="none"
              stroke={warnaStatus}
              strokeWidth="2.5"
              strokeDasharray="70 20 15 20"
              opacity="0.65"
            />
            <path
              d="M200 4 L200 18 M200 382 L200 396 M4 200 L18 200 M382 200 L396 200"
              stroke={warnaStatus}
              strokeWidth="2.5"
              opacity="0.9"
            />
            <path
              d="M62 62 L72 72 M338 62 L328 72 M62 338 L72 328 M338 338 L328 328"
              stroke={warnaStatus}
              strokeWidth="1.5"
              opacity="0.6"
            />
            <text x="200" y="32" fill={warnaStatus} fontSize="10" fontFamily="monospace" textAnchor="middle" opacity="0.85" letterSpacing="1">
              SALES
            </text>
            <text x="364" y="203" fill={warnaStatus} fontSize="10" fontFamily="monospace" textAnchor="middle" opacity="0.85" letterSpacing="1">
              OPS
            </text>
            <text x="200" y="378" fill={warnaStatus} fontSize="10" fontFamily="monospace" textAnchor="middle" opacity="0.85" letterSpacing="1">
              HRD
            </text>
            <text x="36" y="203" fill={warnaStatus} fontSize="10" fontFamily="monospace" textAnchor="middle" opacity="0.85" letterSpacing="1">
              FIN
            </text>
          </svg>
        </div>

        {/* Layer 2: 10 Arc Reactor Transformer Coils (Mechanical Realism) */}
        <div className="absolute inset-[6%] pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 340 340">
            <circle cx="170" cy="170" r="158" fill="none" stroke="#0e7490" strokeWidth="1.5" opacity="0.4" />
            <circle cx="170" cy="170" r="136" fill="none" stroke="#0891b2" strokeWidth="1.5" opacity="0.5" />
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = i * 36
              return (
                <g key={i} transform={`rotate(${angle} 170 170)`}>
                  <rect
                    x="163"
                    y="14"
                    width="14"
                    height="20"
                    rx="2"
                    fill="#082f49"
                    stroke={status === 'warning' ? '#f59e0b' : '#22d3ee'}
                    strokeWidth="1.2"
                    opacity="0.85"
                  />
                  <line x1="170" y1="17" x2="170" y2="31" stroke="#38bdf8" strokeWidth="2" opacity="0.9" />
                  <circle cx="170" cy="10" r="2" fill={status === 'warning' ? '#f59e0b' : '#00f0ff'} opacity="0.9" />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Layer 3: Middle Turbine Ring (Counter-Rotating Electric Cyan) */}
        <div className="absolute inset-[13%] animate-hud-spin-reverse pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 280 280">
            <circle
              cx="140"
              cy="140"
              r="126"
              fill="none"
              stroke={warnaTurbin}
              strokeWidth="2"
              strokeDasharray="18 10 32 10"
              opacity="0.75"
            />
            <circle
              cx="140"
              cy="140"
              r="114"
              fill="none"
              stroke={warnaTurbin}
              strokeWidth="1.5"
              strokeDasharray="4 6"
              opacity="0.6"
            />
            <circle cx="230" cy="50" r="3" fill={warnaTurbin} opacity="0.8" />
            <circle cx="230" cy="230" r="3" fill={warnaTurbin} opacity="0.8" />
            <circle cx="50" cy="230" r="3" fill={warnaTurbin} opacity="0.8" />
            <circle cx="50" cy="50" r="3" fill={warnaTurbin} opacity="0.8" />
          </svg>
        </div>

        {/* Layer 4: Core Plasma Containment Arc (Brilliant Cyan Plasma) */}
        <div className="absolute inset-[19%] animate-hud-spin pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r="98"
              fill="none"
              stroke={warnaPlasma}
              strokeWidth="2.5"
              strokeDasharray="60 15 20 15"
              opacity="0.9"
            />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke={warnaTurbin}
              strokeWidth="1.5"
              strokeDasharray="6 3 12 3"
              opacity="0.65"
            />
          </svg>
        </div>

        {/* Central Arc Core Orb (Interactive Voice-to-Voice Trigger) */}
        <button
          onClick={handleKlik}
          onMouseEnter={() => {
            setHovered(true)
            mainkanSuaraHud('chirp')
          }}
          onMouseLeave={() => setHovered(false)}
          className={`group relative z-10 w-[54%] h-[54%] rounded-full flex flex-col items-center justify-center transition-transform duration-150 cursor-pointer overflow-hidden ${glowClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300`}
          style={{
            transform: `scale(${coreScale})`,
            background:
              status === 'listening'
                ? 'radial-gradient(circle, rgba(16,185,129,0.42) 0%, rgba(6,78,59,0.75) 48%, rgba(3,7,18,0.96) 92%)'
                : status === 'speaking'
                  ? 'radial-gradient(circle, rgba(34,211,238,0.5) 0%, rgba(8,51,68,0.8) 50%, rgba(3,7,18,0.96) 92%)'
                  : 'radial-gradient(circle, rgba(6,182,212,0.38) 0%, rgba(8,47,73,0.7) 48%, rgba(3,7,18,0.96) 92%)',
          }}
          title="Klik untuk mulai / hentikan bicara Voice-to-Voice dengan J.A.R.V.I.S."
          aria-label="Aktivasi Suara J.A.R.V.I.S."
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:10px_10px]" />
          <div className="absolute inset-2 rounded-full border border-cyan-400/25 border-dashed animate-hud-spin pointer-events-none" />

          {/* Central Dynamic Icon */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              {status === 'listening' ? (
                <Mic
                  className={`${
                    compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12'
                  } text-emerald-300 animate-bounce drop-shadow-[0_0_15px_rgba(16,185,129,0.9)]`}
                />
              ) : status === 'speaking' ? (
                <Volume2
                  className={`${
                    compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12'
                  } text-cyan-200 animate-pulse drop-shadow-[0_0_18px_rgba(34,211,238,0.95)]`}
                />
              ) : (
                <Cpu
                  className={`${
                    compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12'
                  } text-cyan-200 group-hover:text-white group-hover:scale-110 transition-all drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]`}
                />
              )}
              <div
                className="absolute inset-0 blur-md rounded-full animate-ping pointer-events-none"
                style={{ backgroundColor: `${warnaStatus}66` }}
              />
            </div>

            <span
              className={`mt-0.5 font-hud ${
                compact ? 'text-[9px] sm:text-[10px]' : 'text-xs sm:text-sm md:text-base'
              } tracking-[0.16em] text-cyan-100 group-hover:text-white font-black uppercase text-glow-cyan whitespace-nowrap`}
            >
              J.A.R.V.I.S.
            </span>
            {!compact && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-mono-hud text-[9px] sm:text-[10px] tracking-widest text-cyan-300 font-bold uppercase whitespace-nowrap">
                  {status === 'listening'
                    ? 'LISTENING...'
                    : status === 'speaking'
                      ? 'SPEAKING...'
                      : status === 'processing'
                        ? 'THINKING...'
                        : 'TAP TO SPEAK'}
                </span>
              </div>
            )}
          </div>

          {/* Real-Time 9-Band Waveform Equalizer */}
          <div
            className={`relative z-10 flex items-center justify-center gap-1 sm:gap-1.5 ${
              compact ? 'mt-1 h-3.5' : 'mt-2 h-6 sm:h-7'
            } pointer-events-none`}
          >
            {spektrumSuara.slice(0, 9).map((val, idx) => {
              const aktifSuara = status === 'speaking' || status === 'listening'
              const maxBarPx = compact ? 14 : 28
              const tinggiPx = aktifSuara ? Math.max(4, Math.round(val * maxBarPx)) : undefined
              return (
                <div
                  key={idx}
                  className={`w-1 sm:w-1.5 rounded-full transition-all duration-75 ${
                    status === 'listening'
                      ? 'bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.95)]'
                      : status === 'speaking'
                        ? 'bg-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.95)]'
                        : 'bg-cyan-400/75 animate-pulse'
                  }`}
                  style={{
                    height: tinggiPx ? `${tinggiPx}px` : `${(compact ? 4 : 7) + ((idx * 2) % 6)}px`,
                  }}
                />
              )
            })}
          </div>

          {/* Indikator Mikrofon saat Mode Listening */}
          {!compact && status === 'listening' && (
            <span className="mt-0.5 font-mono-hud text-[9px] sm:text-[10px] text-emerald-300/90 tracking-wider uppercase font-bold">
              MIC GAIN: {micLevelPct > 8 ? `ACTIVE (${micLevelPct}%)` : 'READY'}
            </span>
          )}
        </button>
      </div>

      {/* Live Voice Transcript Bubble */}
      {transkripLive && (
        <div className="mt-1.5 px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400/60 text-emerald-100 font-mono-hud text-xs max-w-md text-center shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-in fade-in flex items-center justify-center gap-1.5">
          <Mic className="size-3.5 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 font-bold">INPUT SUARA:</span>
          <span>&ldquo;{transkripLive.replace(/^🎙️\s*/, '')}&rdquo;</span>
        </div>
      )}

      {/* Tactical Telemetry & Contextual Diagnostic Ticker Under Core */}
      <div className={`${compact ? 'mt-1 gap-1' : 'mt-1.5 gap-1.5'} flex flex-col items-center text-center w-full max-w-lg px-2`}>
        {!compact && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <span
              className="w-2 h-2 rounded-full animate-ping shrink-0"
              style={{ backgroundColor: warnaStatus }}
            />
            <span className="font-hud text-[10px] sm:text-xs uppercase tracking-widest text-cyan-100 font-bold truncate">
              {labelStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
