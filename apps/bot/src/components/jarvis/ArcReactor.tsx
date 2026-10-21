'use client'

import { useState } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
import { Cpu, Mic, Volume2, Radio, FileBarChart2, MessageSquare } from 'lucide-react'

export type StatusArcReactor = 'optimal' | 'listening' | 'processing' | 'speaking' | 'warning'

interface ArcReactorProps {
  status: StatusArcReactor
  compact?: boolean
  voiceLoopAktif?: boolean
  spektrumSuara?: number[]
  transkripLive?: string
  onClickCore?: () => void
  onBukaDailyBriefing?: () => void
  onBukaChatLengkap?: () => void
}

const DEFAULT_SPEKTRUM = [0.2, 0.35, 0.22, 0.45, 0.3, 0.45, 0.22, 0.35, 0.2]

export default function ArcReactor({
  status = 'optimal',
  compact = false,
  voiceLoopAktif = false,
  spektrumSuara = DEFAULT_SPEKTRUM,
  transkripLive = '',
  onClickCore,
  onBukaDailyBriefing,
  onBukaChatLengkap,
}: ArcReactorProps) {
  const [hovered, setHovered] = useState(false)

  const handleKlik = () => {
    mainkanSuaraHud('engage')
    onClickCore?.()
  }

  // Warna aksen berdasarkan status neural
  const warnaAksen =
    status === 'warning'
      ? '#ef4444'
      : status === 'processing'
        ? '#f59e0b'
        : status === 'listening'
          ? '#10b981'
          : status === 'speaking'
            ? '#22d3ee'
            : '#06b6d4'

  const glowClass =
    status === 'warning'
      ? 'shadow-[0_0_75px_rgba(239,68,68,0.55)]'
      : status === 'processing'
        ? 'shadow-[0_0_75px_rgba(245,158,11,0.55)]'
        : status === 'listening'
          ? 'shadow-[0_0_85px_rgba(16,185,129,0.65)] ring-2 ring-emerald-400'
          : status === 'speaking'
            ? 'shadow-[0_0_95px_rgba(34,211,238,0.75)] ring-2 ring-cyan-300'
            : 'shadow-[0_0_70px_rgba(6,182,212,0.5)]'

  const labelStatus =
    status === 'listening'
      ? 'LISTENING // SILAKAN BICARA'
      : status === 'processing'
        ? 'SYNCHRONIZING LIVE DATA...'
        : status === 'speaking'
          ? 'J.A.R.V.I.S. SPEAKING (KLIK UNTUK POTONG)'
          : status === 'warning'
            ? 'ANOMALY DETECTED // SIAGA'
            : voiceLoopAktif
              ? 'VOICE LOOP STANDBY // SIAP MENDENGAR'
              : 'UNIFIED J.A.R.V.I.S. CORE READY'

  // Hitung rata-rata energi suara untuk efek denyut cincin saat bicara MAUPUN saat mendengarkan mikrofon
  const avgEnergy =
    spektrumSuara.reduce((acc, v) => acc + v, 0) / (spektrumSuara.length || 1)
  const micLevelPct = Math.min(100, Math.max(0, Math.round((avgEnergy - 0.15) * 135)))
  const coreScale =
    status === 'speaking' || status === 'listening'
      ? 1 + Math.min(0.1, Math.max(0, (avgEnergy - 0.18) * 0.16))
      : hovered
        ? 1.04
        : 1

  const containerSizeClass = compact
    ? 'w-[140px] h-[140px] sm:w-[165px] sm:h-[165px] lg:w-[185px] lg:h-[185px] max-w-[min(100%,21vh)] max-h-[21vh]'
    : 'w-[250px] h-[250px] sm:w-[310px] sm:h-[310px] md:w-[350px] md:h-[350px] lg:w-[375px] lg:h-[375px] xl:w-[425px] xl:h-[425px] 2xl:w-[465px] 2xl:h-[465px] max-w-[min(100%,43vh)] max-h-[43vh]'

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-0.5 w-full transition-all duration-300">
      {/* Target Reticle Container (Auto-Compact saat kartu jawaban Hologram terbuka) */}
      <div className={`relative flex items-center justify-center aspect-square transition-all duration-300 ${containerSizeClass}`}>
        {/* Corner Reticles with Sci-Fi HUD Coordinates */}
        {!compact && (
          <>
            <div className="absolute top-0 left-0 w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-l-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col justify-start">
              <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/70 font-semibold tracking-wider leading-none">
                {voiceLoopAktif ? 'VOICE // LOOP' : 'SYS // CORE-01'}
              </span>
            </div>
            <div className="absolute top-0 right-0 w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-r-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col items-end justify-start">
              <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/70 font-semibold tracking-wider leading-none">
                ALL-DIV ACCESS
              </span>
            </div>
            <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-l-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col justify-end">
              <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/70 font-semibold tracking-wider leading-none">
                NEURAL // ID
              </span>
            </div>
            <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-r-2 border-cyan-400/70 pointer-events-none p-1 flex flex-col items-end justify-end">
              <span className="font-mono-hud text-[7px] sm:text-[8px] text-cyan-400/70 font-semibold tracking-wider leading-none">
                MK-VIII
              </span>
            </div>
          </>
        )}

        {/* Ambient Back Glow */}
        <div
          className="absolute inset-[4%] rounded-full blur-3xl opacity-40 transition-all duration-300 pointer-events-none animate-hud-pulse"
          style={{ backgroundColor: warnaAksen }}
        />

        {/* Layer 1: Outermost Tachymeter & Degree Compass */}
        <div className="absolute inset-0 sm:inset-1 animate-hud-spin pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 400">
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
            <path
              d="M200 4 L200 18 M200 382 L200 396 M4 200 L18 200 M382 200 L396 200"
              stroke={warnaAksen}
              strokeWidth="2.5"
              opacity="0.9"
            />
            <path
              d="M62 62 L72 72 M338 62 L328 72 M62 338 L72 328 M338 338 L328 328"
              stroke={warnaAksen}
              strokeWidth="1.5"
              opacity="0.6"
            />
            <text x="200" y="32" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">
              SALES
            </text>
            <text x="364" y="203" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">
              OPS
            </text>
            <text x="200" y="378" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">
              HRD
            </text>
            <text x="36" y="203" fill={warnaAksen} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.75" letterSpacing="1">
              FIN
            </text>
          </svg>
        </div>

        {/* Layer 2: Counter-Rotating Tactical Ring */}
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
            <circle cx="276" cy="64" r="3.5" fill={warnaAksen} opacity="0.85" />
            <circle cx="276" cy="276" r="3.5" fill={warnaAksen} opacity="0.85" />
            <circle cx="64" cy="276" r="3.5" fill={warnaAksen} opacity="0.85" />
            <circle cx="64" cy="64" r="3.5" fill={warnaAksen} opacity="0.85" />
          </svg>
        </div>

        {/* Layer 3: Middle Turbine Ring */}
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

        {/* Layer 4: Core Plasma Containment Arc */}
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
              opacity="0.85"
            />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke={warnaAksen}
              strokeWidth="1"
              strokeDasharray="6 3 12 3"
              opacity="0.55"
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
          className={`group relative z-10 w-[54%] h-[54%] rounded-full flex flex-col items-center justify-center transition-transform duration-150 cursor-pointer overflow-hidden ${glowClass}`}
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
                    compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13'
                  } text-emerald-300 animate-bounce drop-shadow-[0_0_15px_rgba(16,185,129,0.9)]`}
                />
              ) : status === 'speaking' ? (
                <Volume2
                  className={`${
                    compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13'
                  } text-cyan-200 animate-pulse drop-shadow-[0_0_18px_rgba(34,211,238,0.95)]`}
                />
              ) : (
                <Cpu
                  className={`${
                    compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13'
                  } text-cyan-200 group-hover:text-white group-hover:scale-110 transition-all drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]`}
                />
              )}
              <div
                className="absolute inset-0 blur-md rounded-full animate-ping pointer-events-none"
                style={{ backgroundColor: `${warnaAksen}66` }}
              />
            </div>

            <span
              className={`mt-0.5 font-hud ${
                compact ? 'text-[9px] sm:text-[10px]' : 'text-xs sm:text-sm md:text-base lg:text-lg'
              } tracking-[0.22em] text-cyan-100 group-hover:text-white font-black uppercase text-glow-cyan`}
            >
              J.A.R.V.I.S.
            </span>
            {!compact && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-mono-hud text-[8px] sm:text-[9px] md:text-[10px] tracking-widest text-cyan-300 font-bold uppercase">
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

          {/* Real-Time 9-Band Waveform Equalizer (Bergerak dinamis saat Anda bicara di Mic maupun saat Jarvis menjawab) */}
          <div
            className={`relative z-10 flex items-center justify-center gap-1 sm:gap-1.5 ${
              compact ? 'mt-1 h-4' : 'mt-2 h-8 sm:h-9'
            } pointer-events-none`}
          >
            {spektrumSuara.slice(0, 9).map((val, idx) => {
              const aktifSuara = status === 'speaking' || status === 'listening'
              const maxBarPx = compact ? 16 : 36
              const tinggiPx = aktifSuara ? Math.max(5, Math.round(val * maxBarPx)) : undefined
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
                    height: tinggiPx ? `${tinggiPx}px` : `${(compact ? 4 : 8) + ((idx * 2) % 7)}px`,
                  }}
                />
              )
            })}
          </div>

          {/* Indikator Persentase Sinyal Mikrofon saat Mode Listening */}
          {!compact && status === 'listening' && (
            <span className="mt-1 font-mono-hud text-[8px] sm:text-[9px] text-emerald-300/90 tracking-widest uppercase font-bold">
              MIC GAIN: {micLevelPct > 8 ? `ACTIVE (${micLevelPct}%)` : 'READY — SILAKAN BICARA'}
            </span>
          )}
        </button>
      </div>

      {/* Live Voice Transcript Bubble */}
      {transkripLive && (
        <div className="mt-1.5 px-3.5 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400/60 text-emerald-100 font-mono-hud text-xs max-w-md text-center shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-in fade-in">
          <span className="text-emerald-400 font-bold mr-1.5">🎙️ VOICE INPUT:</span>
          <span>&ldquo;{transkripLive.replace(/^🎙️\s*/, '')}&rdquo;</span>
        </div>
      )}

      {/* Telemetry Readouts & Tactical Controls Under Core */}
      <div className={`${compact ? 'mt-1.5 gap-1.5' : 'mt-2.5 gap-2'} flex flex-col items-center text-center`}>
        {!compact && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: warnaAksen }}
            />
            <span className="font-hud text-[9px] sm:text-[11px] uppercase tracking-widest text-cyan-100 font-bold">
              {labelStatus}
            </span>
          </div>
        )}

        {/* Quick Core Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleKlik}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-hud text-[9px] sm:text-[10px] tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              voiceLoopAktif || status === 'listening'
                ? 'bg-emerald-600/80 border-emerald-300 text-white shadow-[0_0_18px_rgba(16,185,129,0.45)]'
                : 'bg-cyan-950/70 hover:bg-cyan-900/80 border-cyan-400/50 text-cyan-200'
            }`}
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{voiceLoopAktif ? 'VOICE-TO-VOICE: ON' : 'VOICE-TO-VOICE'}</span>
          </button>

          {onBukaDailyBriefing && (
            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('engage')
                onBukaDailyBriefing()
              }}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 border border-cyan-300/60 text-white font-hud text-[9px] sm:text-[10px] tracking-wider uppercase font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.35)] flex items-center gap-1.5 cursor-pointer"
            >
              <FileBarChart2 className="w-3 h-3" />
              <span>LAPORAN DAILY</span>
            </button>
          )}

          {onBukaChatLengkap && (
            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('chirp')
                onBukaChatLengkap()
              }}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-zinc-900/90 hover:bg-cyan-950/80 border border-cyan-500/35 hover:border-cyan-400 text-cyan-300 font-hud text-[9px] sm:text-[10px] tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              <span>PANEL CHAT &amp; TABEL</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
