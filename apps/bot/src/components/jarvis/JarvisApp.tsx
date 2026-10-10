'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  mainkanSuaraHud,
  setSuaraHud,
  apakahSuaraHudAktif,
} from '@/lib/audioHud'
import type { MejaKantor } from '@/kantor/keadaan'
import type { Profil } from '@/lib/peran'
import { keluar } from '@/lib/keluar'
import ArcReactor from '@/components/jarvis/ArcReactor'
import AgentNodeCard from '@/components/jarvis/AgentNodeCard'
import JarvisChatDrawer from '@/components/jarvis/JarvisChatDrawer'
import TelemetryTicker from '@/components/jarvis/TelemetryTicker'
import {
  mulaiMendengar,
  hentiMendengar,
  apakahVoiceDidukung,
} from '@/lib/voiceHud'
import {
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  Home,
  LogOut,
  Shield,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
} from 'lucide-react'

const POLL_MS = 10_000

interface JarvisAppProps {
  nama: string
  portalUrl: string
}

export default function JarvisApp({
  nama,
  portalUrl,
}: JarvisAppProps) {
  const [meja, setMeja] = useState<MejaKantor[] | null>(null)
  const [diambilAt, setDiambilAt] = useState<string | null>(null)
  const [pollingGagal, setPollingGagal] = useState(false)
  const [suaraNyala, setSuaraNyala] = useState(true)
  const [isLayarPenuh, setIsLayarPenuh] = useState(false)
  const [sedangMendengar, setSedangMendengar] = useState(false)
  const [voiceDidukung, setVoiceDidukung] = useState(false)

  // State percakapan terpilih
  const [agenTerpilih, setAgenTerpilih] = useState<Profil | null>(null)
  const [pesanAwal, setPesanAwal] = useState<string | null>(null)

  // Direct command prompt di tengah
  const [inputPerintah, setInputPerintah] = useState('')

  // Inisialisasi suara dari helper
  useEffect(() => {
    setSuaraNyala(apakahSuaraHudAktif())
    setVoiceDidukung(apakahVoiceDidukung().stt)
  }, [])

  // Listen perubahan status fullscreen browser
  useEffect(() => {
    const handler = () => {
      setIsLayarPenuh(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullScreen = () => {
    mainkanSuaraHud('chirp')
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  const toggleSuara = () => {
    const baru = !suaraNyala
    setSuaraNyala(baru)
    setSuaraHud(baru)
    if (baru) mainkanSuaraHud('blip')
  }

  // Polling data status bot dari API
  const muatStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/kantor/status', { cache: 'no-store' })
      if (r.status === 401) {
        window.location.href = portalUrl
        return
      }
      if (r.status === 403) {
        window.location.reload()
        return
      }
      if (!r.ok) throw new Error(String(r.status))
      const j = (await r.json()) as { diambilAt: string; meja: MejaKantor[] }
      setMeja(j.meja)
      setDiambilAt(j.diambilAt)
      setPollingGagal(false)
    } catch {
      setPollingGagal(true)
    }
  }, [portalUrl])

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null
    const mulai = () => {
      if (!t) {
        void muatStatus()
        t = setInterval(muatStatus, POLL_MS)
      }
    }
    const henti = () => {
      if (t) {
        clearInterval(t)
        t = null
      }
    }
    const onVis = () => (document.hidden ? henti() : mulai())
    if (!document.hidden) mulai()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      henti()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [muatStatus])

  // Cari meja berdasarkan profil
  const getMejaByProfil = (profil: Profil): MejaKantor | null => {
    return meja?.find((m) => m.profil === profil) ?? null
  }

  // Hitung jumlah node aktif
  const nodeAktifCount = meja?.filter((m) => m.keadaan === 'bekerja' || m.keadaan === 'siaga').length ?? 4
  const adaGalat = meja?.some((m) => m.keadaan === 'galat') ?? false

  const bukaAgen = (profil: Profil, pesan?: string) => {
    mainkanSuaraHud('engage')
    setPesanAwal(pesan || null)
    setAgenTerpilih(profil)
  }

  const handleToggleVoice = () => {
    if (sedangMendengar) {
      hentiMendengar()
      setSedangMendengar(false)
      mainkanSuaraHud('chirp')
    } else {
      mainkanSuaraHud('engage')
      const sukses = mulaiMendengar({
        onMulai: () => setSedangMendengar(true),
        onHasil: (teks) => {
          setInputPerintah(teks)
        },
        onSelesai: () => setSedangMendengar(false),
        onGalat: () => {
          setSedangMendengar(false)
          mainkanSuaraHud('alert')
        },
      })
      if (!sukses) setSedangMendengar(false)
    }
  }

  const handleKirimGlobal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputPerintah.trim()) return
    const teks = inputPerintah.trim()
    setInputPerintah('')
    if (sedangMendengar) {
      hentiMendengar()
      setSedangMendengar(false)
    }
    // Default arahkan ke CEO untuk pertanyaan umum Jarvis
    bukaAgen('ceo', teks)
  }

  return (
    <div className="h-screen h-dvh w-screen overflow-hidden flex flex-col justify-between jarvis-bg text-zinc-100 relative select-none">
      {/* Subtle Scanline Overlay */}
      <div className="absolute inset-0 jarvis-scanlines pointer-events-none opacity-30 z-10" />

      {/* Reticles di 4 Sudut Layar Utama (Edge-to-edge HUD) */}
      <div className="fixed top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none z-30" />
      <div className="fixed top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none z-30" />
      <div className="fixed bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none z-30" />
      <div className="fixed bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none z-30" />

      {/* TOP AVIONICS HUD HEADER (Compact Fullscreen Mode) */}
      <header className="relative z-20 border-b border-cyan-500/25 bg-black/75 backdrop-blur-md px-3 sm:px-5 py-2 shrink-0">
        <div className="w-full max-w-[1700px] mx-auto flex items-center justify-between gap-3">
          {/* Logo & Callout */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0">
              <Shield className="w-4 h-4 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-hud text-xs sm:text-sm font-black tracking-widest text-white uppercase text-glow-cyan">
                  J.A.R.V.I.S.
                </span>
                <span className="font-mono-hud text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/60 border border-cyan-400/40 text-cyan-300 font-semibold">
                  HERMES OPS
                </span>
              </div>
              <p className="font-mono-hud text-[9px] text-cyan-400/70 tracking-wider hidden sm:block">
                SUKA SHAWARMA COMMAND MATRIX &bull; CLEARANCE: {nama.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Quick HUD Navigation & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Audio Toggle */}
            <button
              onClick={toggleSuara}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg border font-mono-hud text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                suaraNyala
                  ? 'bg-cyan-950/70 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500'
              }`}
              title={suaraNyala ? 'SFX Audio Nyala' : 'SFX Audio Mute'}
            >
              {suaraNyala ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden md:inline text-[9px]">{suaraNyala ? 'SFX: ON' : 'SFX: OFF'}</span>
            </button>

            {/* Toggle Full Screen Browser (F11 Kiosk Style) */}
            <button
              onClick={toggleFullScreen}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg border font-mono-hud text-xs transition-all flex items-center gap-1 cursor-pointer ${
                isLayarPenuh
                  ? 'bg-cyan-600/80 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-zinc-900/80 border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
              }`}
              title={isLayarPenuh ? 'Keluar Layar Penuh' : 'Masuk Mode Layar Penuh'}
            >
              {isLayarPenuh ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline text-[9px] font-bold">
                {isLayarPenuh ? 'EXIT FULLSCREEN' : 'FULL SCREEN'}
              </span>
            </button>

            {/* Link Portal */}
            <a
              href={portalUrl}
              onClick={() => mainkanSuaraHud('blip')}
              className="p-1.5 rounded-lg border border-cyan-500/30 bg-zinc-900/80 text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
              title="Kembali ke Portal"
            >
              <Home className="w-3.5 h-3.5" />
            </a>

            {/* Logout */}
            <button
              onClick={() => {
                mainkanSuaraHud('alert')
                keluar(portalUrl)
              }}
              className="p-1.5 rounded-lg border border-red-500/30 bg-red-950/30 text-red-300 hover:border-red-400 transition-colors cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN COMMAND INTERFACE (Edge-to-edge fluid height without page scroll on desktop) */}
      <main className="relative z-20 flex-1 min-h-0 w-full max-w-[1700px] mx-auto px-3 sm:px-6 py-2 sm:py-3 flex flex-col justify-between gap-3 overflow-y-auto lg:overflow-hidden">
        
        {/* EXECUTIVE DIRECTIVE SEARCH / VOICE CONSOLE BAR */}
        <div className="w-full max-w-2xl mx-auto shrink-0">
          <form
            onSubmit={handleKirimGlobal}
            className="relative flex items-center rounded-xl bg-zinc-950/90 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)] focus-within:border-cyan-400 focus-within:shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all p-0.5 sm:p-1"
          >
            <div className="pl-3 pr-2 text-cyan-400 flex items-center">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-300" />
            </div>

            <input
              type="text"
              value={inputPerintah}
              onChange={(e) => setInputPerintah(e.target.value)}
              placeholder={sedangMendengar ? 'Mendengarkan suara Anda... Silakan bicara...' : "Instruksikan Jarvis (misal: 'Analisis omset hari ini')..."}
              className="w-full bg-transparent font-mono-hud text-xs sm:text-sm text-cyan-100 placeholder-cyan-400/40 py-1.5 sm:py-2 focus:outline-none"
            />

            {voiceDidukung && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-1.5 sm:px-2.5 rounded-lg border transition-all cursor-pointer mr-1.5 flex items-center gap-1 shrink-0 ${
                  sedangMendengar
                    ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60'
                }`}
                title={sedangMendengar ? 'Hentikan Mendengar' : 'Bicara ke Jarvis (Voice Input)'}
              >
                {sedangMendengar ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span className="hidden md:inline text-[9px] font-mono-hud">
                  {sedangMendengar ? 'LISTENING...' : 'VOICE'}
                </span>
              </button>
            )}

            <button
              type="submit"
              className="px-3 sm:px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-hud text-[11px] tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span className="hidden sm:inline">EXECUTE</span>
            </button>
          </form>

          {/* Quick Directive Chips */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
            <span className="font-mono-hud text-[9px] text-zinc-500 uppercase tracking-wider hidden sm:inline">
              DIRECTIVES:
            </span>
            {[
              { label: '⚡ Executive Daily Briefing', profil: 'ceo' as Profil, pesan: 'Berikan ringkasan eksekutif kondisi bisnis hari ini: omset, stok, dan absensi.' },
              { label: '📦 Audit Bahan Kritis', profil: 'gudang' as Profil, pesan: 'Bahan baku mana saja yang stoknya hampir habis dan butuh order segera?' },
              { label: '👥 Absensi Outlet Live', profil: 'hrd' as Profil, pesan: 'Siapa saja staf outlet yang belum absen atau terlambat hari ini?' },
              { label: '💰 Rekonsiliasi OPEX', profil: 'finance' as Profil, pesan: 'Berapa total pengeluaran OPEX bulan ini dan apakah ada tagihan jatuh tempo?' },
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => bukaAgen(chip.profil, chip.pesan)}
                className="px-2 py-0.5 rounded bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/25 hover:border-cyan-400 font-mono-hud text-[9px] transition-all cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* TACTICAL ORBITAL GRID: Left Nodes, Arc Reactor in Center, Right Nodes */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-center">
          {/* Left Column: CEO & FINANCE NODES */}
          <div className="lg:col-span-4 flex flex-col gap-2.5 sm:gap-3.5 justify-center h-full">
            <AgentNodeCard
              profilFallback="ceo"
              meja={getMejaByProfil('ceo')}
              terpilih={agenTerpilih === 'ceo'}
              onPilih={(p, q) => bukaAgen(p, q)}
            />

            <AgentNodeCard
              profilFallback="finance"
              meja={getMejaByProfil('finance')}
              terpilih={agenTerpilih === 'finance'}
              onPilih={(p, q) => bukaAgen(p, q)}
            />
          </div>

          {/* Center Column: ARC REACTOR / NEURAL CORE */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center h-full py-1">
            <ArcReactor
              status={adaGalat ? 'warning' : 'optimal'}
              agentAktifCount={nodeAktifCount}
              totalMeja={meja?.length || 4}
              onClickCore={() => bukaAgen('ceo', 'Jarvis, berikan status report menyeluruh sistem operasional sekarang.')}
            />
          </div>

          {/* Right Column: GUDANG & HRD NODES */}
          <div className="lg:col-span-4 flex flex-col gap-2.5 sm:gap-3.5 justify-center h-full">
            <AgentNodeCard
              profilFallback="gudang"
              meja={getMejaByProfil('gudang')}
              terpilih={agenTerpilih === 'gudang'}
              onPilih={(p, q) => bukaAgen(p, q)}
            />

            <AgentNodeCard
              profilFallback="hrd"
              meja={getMejaByProfil('hrd')}
              terpilih={agenTerpilih === 'hrd'}
              onPilih={(p, q) => bukaAgen(p, q)}
            />
          </div>
        </div>
      </main>

      {/* BOTTOM TELEMETRY TICKER */}
      <TelemetryTicker
        diambilAt={diambilAt}
        pollingGagal={pollingGagal}
        totalActive={nodeAktifCount}
      />

      {/* HOLOGRAPHIC COMM-LINK DRAWER (Jika Agen Terpilih) */}
      {agenTerpilih && (
        <JarvisChatDrawer
          profil={agenTerpilih}
          pesanAwal={pesanAwal}
          onTutup={() => {
            mainkanSuaraHud('chirp')
            setAgenTerpilih(null)
            setPesanAwal(null)
          }}
        />
      )}
    </div>
  )
}
