'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  mainkanSuaraHud,
  setSuaraHud,
  apakahSuaraHudAktif,
} from '@/lib/audioHud'
import type { MejaKantor } from '@/kantor/keadaan'
import type { Profil } from '@/lib/peran'
import { keluar } from '@/lib/keluar'
import ArcReactor, { type StatusArcReactor } from '@/components/jarvis/ArcReactor'
import AgentNodeCard from '@/components/jarvis/AgentNodeCard'
import JarvisChatDrawer, { FormatIsiHologram } from '@/components/jarvis/JarvisChatDrawer'
import DailyBriefingModal from '@/components/jarvis/DailyBriefingModal'
import TelemetryTicker from '@/components/jarvis/TelemetryTicker'
import type { DailyReportPayload } from '@/app/api/jarvis/daily-report/route'
import {
  mulaiMendengar,
  hentiMendengar,
  apakahVoiceDidukung,
  bicaraJarvis,
  hentiBicaraJarvis,
  pasangListenerSpektrumSuara,
  mulaiWakeWordJarvis,
  hentiWakeWordJarvis,
  PILIHAN_SUARA_JARVIS,
  ambilSuaraJarvisAktif,
  setSuaraJarvisAktif,
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
  Bell,
  Mic,
  MicOff,
  Radio,
  FileBarChart2,
  MessageSquare,
  X,
  Printer,
  CheckCircle2,
  Activity,
  Zap,
  Calendar,
  DollarSign,
  Trash2,
  Users,
} from 'lucide-react'

const POLL_STATUS_MS = 12_000
const POLL_TELEMETRY_MS = 25_000

interface JarvisAppProps {
  nama: string
  portalUrl: string
}

export interface PesanHologram {
  id: string
  waktu: string
  peran: 'user' | 'jarvis'
  teks: string
  isDispatch?: boolean
  detailDispatch?: {
    terkirimKe: number
    mode: string
    isDivisi: boolean
  }
}

function deteksiDivisiTopik(teks: string): Profil {
  const p = teks.toLowerCase()
  if (
    p.includes('utang') ||
    p.includes('hutang') ||
    p.includes('supplier') ||
    p.includes('opex') ||
    p.includes('pengeluaran') ||
    p.includes('setoran') ||
    p.includes('selisih') ||
    p.includes('kas') ||
    p.includes('finance') ||
    p.includes('keuangan')
  ) {
    return 'finance'
  }
  if (
    p.includes('waste') ||
    p.includes('rusak') ||
    p.includes('basi') ||
    p.includes('void') ||
    p.includes('batal') ||
    p.includes('stok') ||
    p.includes('bahan') ||
    p.includes('gudang') ||
    p.includes('belum buka')
  ) {
    return 'gudang'
  }
  if (
    p.includes('absen') ||
    p.includes('presensi') ||
    p.includes('telat') ||
    p.includes('terlambat') ||
    p.includes('cuti') ||
    p.includes('izin') ||
    p.includes('kru') ||
    p.includes('hrd') ||
    p.includes('review') ||
    p.includes('ulasan') ||
    p.includes('rating') ||
    p.includes('bintang') ||
    p.includes('komplain')
  ) {
    return 'hrd'
  }
  return 'ceo'
}

export default function JarvisApp({
  nama,
  portalUrl,
}: JarvisAppProps) {
  const [meja, setMeja] = useState<MejaKantor[] | null>(null)
  const [dailyData, setDailyData] = useState<DailyReportPayload | null>(null)
  const [memuatDaily, setMemuatDaily] = useState(false)
  const [diambilAt, setDiambilAt] = useState<string | null>(null)
  const [pollingGagal, setPollingGagal] = useState(false)

  // Audio & Voice States
  const [suaraNyala, setSuaraNyala] = useState(true)
  const [autoVoiceReply, setAutoVoiceReply] = useState(true)
  const [voiceIdAktif, setVoiceIdAktif] = useState('brian')
  const [isLayarPenuh, setIsLayarPenuh] = useState(false)
  const [voiceDidukung, setVoiceDidukung] = useState(false)
  const [sedangMendengar, setSedangMendengar] = useState(false)
  const [sedangBicara, setSedangBicara] = useState(false)
  const [voiceLoopAktif, setVoiceLoopAktif] = useState(false)
  const [wakeWordNyala, setWakeWordNyala] = useState(false)
  const [spektrumSuara, setSpektrumSuara] = useState<number[]>([0.2, 0.35, 0.22, 0.45, 0.3, 0.45, 0.22, 0.35, 0.2])
  const [transkripLive, setTranskripLive] = useState('')

  // Unified Jarvis Conversation State (Center Hologram + Chat Drawer Sync)
  const [percakapanIdAktif, setPercakapanIdAktif] = useState<string | null>(null)
  const [inputPerintah, setInputPerintah] = useState('')
  const [sedangMemproses, setSedangMemproses] = useState(false)
  const [jawabanHologram, setJawabanHologram] = useState<string>('')
  const [riwayatHologram, setRiwayatHologram] = useState<PesanHologram[]>([])
  const [divisiSorot, setDivisiSorot] = useState<Profil | null>(null)
  const [modeWaktuKotak, setModeWaktuKotak] = useState<'kemarin' | 'hari_ini'>('kemarin')

  // Modal / Drawer States
  const [tampilDailyBriefing, setTampilDailyBriefing] = useState(false)
  const [tampilChatDrawer, setTampilChatDrawer] = useState(false)
  const [pesanAwalDrawer, setPesanAwalDrawer] = useState<string | null>(null)

  const voiceLoopRef = useRef(false)
  const chatAbortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    voiceLoopRef.current = voiceLoopAktif
  }, [voiceLoopAktif])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [riwayatHologram, sedangMemproses])

  // Global Keyboard Shortcuts ('/' or 'Ctrl+K' focuses input bar, 'Escape' clears/unfocuses)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        const target = e.target as HTMLElement | null
        const isInput =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.tagName === 'SELECT' ||
          target?.isContentEditable
        if (!isInput) {
          e.preventDefault()
          inputRef.current?.focus()
        }
      } else if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Inisialisasi Audio HUD & Web Speech Detection
  useEffect(() => {
    setSuaraNyala(apakahSuaraHudAktif())
    const infoVoice = apakahVoiceDidukung()
    setVoiceDidukung(Boolean(infoVoice.stt || infoVoice.tts))
    setVoiceIdAktif(ambilSuaraJarvisAktif())

    // Spektrum visualizer
    pasangListenerSpektrumSuara((bars) => {
      setSpektrumSuara(bars)
    })

    return () => {
      pasangListenerSpektrumSuara(null)
      hentiMendengar()
      hentiBicaraJarvis()
      hentiWakeWordJarvis()
    }
  }, [])

  // Deteksi Fullscreen
  useEffect(() => {
    const handler = () => {
      setIsLayarPenuh(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleSuara = () => {
    const baru = !suaraNyala
    setSuaraNyala(baru)
    setSuaraHud(baru)
    if (baru) mainkanSuaraHud('chirp')
  }

  const toggleFullScreen = () => {
    mainkanSuaraHud('chirp')
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Polling data meja & status agent
  const muatStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/kantor/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('Status kantor gagal dimuat')
      const data = await res.json()
      setMeja(data.meja ?? [])
      setPollingGagal(false)
    } catch {
      setPollingGagal(true)
    }
  }, [])

  // Polling Telemetri Komprehensif (POS, Finance, Waste, HRD, Review)
  const muatDailyTelemetry = useCallback(async (tampilkanLoading = false) => {
    if (tampilkanLoading) setMemuatDaily(true)
    try {
      const r = await fetch('/api/jarvis/daily-report', { cache: 'no-store' })
      if (r.ok) {
        const j: DailyReportPayload = await r.json()
        setDailyData(j)
        setDiambilAt(j.diambilAt || new Date().toISOString())
      }
    } catch {
      // Abaikan jika gagal sementara
    } finally {
      setMemuatDaily(false)
    }
  }, [])

  useEffect(() => {
    void muatStatus()
    void muatDailyTelemetry(false)
    const tStatus = setInterval(muatStatus, POLL_STATUS_MS)
    const tTele = setInterval(() => void muatDailyTelemetry(false), POLL_TELEMETRY_MS)
    return () => {
      clearInterval(tStatus)
      clearInterval(tTele)
    }
  }, [muatStatus, muatDailyTelemetry])

  // Fungsi mulai mendengarkan suara (Auto-Turn Loop & Dual-Engine STT)
  const mulaiSesiDengar = useCallback(
    (dariLoop = false) => {
      if (!dariLoop) {
        mainkanSuaraHud('engage')
      }
      hentiBicaraJarvis()
      setSedangBicara(false)
      setTranskripLive('🎙️ Mendengarkan suara Anda...')

      let adaFinalTerkirim = false

      const sukses = mulaiMendengar({
        onMulai: () => {
          setSedangMendengar(true)
        },
        onHasil: (teks) => {
          setTranskripLive(teks)
          if (teks && !teks.startsWith('🎙️') && !teks.startsWith('⏳')) {
            setInputPerintah(teks)
          }
        },
        onFinalOtomatis: (teksFinal) => {
          adaFinalTerkirim = true
          setSedangMendengar(false)
          setTranskripLive('')
          setInputPerintah('')
          void eksekusiPerintahJarvis(teksFinal, true)
        },
        onSelesai: () => {
          setSedangMendengar(false)
          if (!adaFinalTerkirim) {
            setVoiceLoopAktif(false)
            setTranskripLive('')
          }
        },
        onGalat: (pesan) => {
          setSedangMendengar(false)
          setVoiceLoopAktif(false)
          setTranskripLive('')
          mainkanSuaraHud('alert')
          setJawabanHologram(`> **PERINGATAN MIKROFON**: ${pesan}`)
        },
      })

      if (!sukses) {
        setSedangMendengar(false)
        setVoiceLoopAktif(false)
        setTranskripLive('')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [percakapanIdAktif, dailyData, autoVoiceReply]
  )

  // Buka Daily Briefing Modal
  const bukaModalDailyBriefing = useCallback(
    (bacakanOtomatis = true, modePaksa?: 'hari_ini' | 'kemarin') => {
      mainkanSuaraHud('engage')
      setTampilDailyBriefing(true)
      if (!dailyData) {
        void muatDailyTelemetry(true)
      } else if (bacakanOtomatis && (autoVoiceReply || voiceLoopRef.current)) {
        const pilihMode = modePaksa || dailyData.modeRekomendasi
        const narasi =
          pilihMode === 'kemarin' ? dailyData.narasiSuaraKemarin : dailyData.narasiSuaraHariIni
        if (narasi) {
          setSedangBicara(true)
          bicaraJarvis(
            narasi,
            () => {
              setSedangBicara(false)
              if (voiceLoopRef.current) {
                setTimeout(() => mulaiSesiDengar(true), 350)
              }
            },
            { gunakanTeksPenuh: true }
          )
        }
      }
    },
    [dailyData, autoVoiceReply, muatDailyTelemetry, mulaiSesiDengar]
  )

  // Eksekusi perintah utama ke Unified J.A.R.V.I.S.
  const eksekusiPerintahJarvis = async (teksMentah: string, dariVoice = false) => {
    const isi = teksMentah.trim()
    if (!isi) return

    const lower = isi.toLowerCase()
    const waktuSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

    // 1. Pintasan Perintah Suara/Teks: Stop / Diam / Matikan Suara
    if (
      lower === 'stop' ||
      lower === 'berhenti' ||
      lower === 'diam' ||
      lower === 'matikan suara' ||
      lower === 'standby'
    ) {
      hentiBicaraJarvis()
      hentiMendengar()
      setSedangBicara(false)
      setSedangMendengar(false)
      setVoiceLoopAktif(false)
      mainkanSuaraHud('chirp')
      return
    }

    // 2. Pintasan Perintah: Kirim Laporan Daily atau Dispatch Instruksi ke Telegram
    if (
      (lower.includes('kirim') || lower.includes('broadcast') || lower.includes('share') || lower.includes('dispatch') || lower.includes('teruskan')) &&
      (lower.includes('telegram') || lower.includes('divisi') || lower.includes('instruksi'))
    ) {
      const isDispatchDivisi = lower.includes('dispatch') || lower.includes('divisi') || lower.includes('instruksi')
      mainkanSuaraHud('transmit')
      setSedangMemproses(true)

      const idUser = 'u-' + Date.now()
      const idJarvis = 'j-' + (Date.now() + 1)

      setRiwayatHologram((prev) => [
        ...prev.slice(-6),
        { id: idUser, waktu: waktuSekarang, peran: 'user', teks: isi },
        {
          id: idJarvis,
          waktu: waktuSekarang,
          peran: 'jarvis',
          teks: isDispatchDivisi
            ? 'Meneruskan **Instruksi & Rekomendasi Strategis Agent** ke Bot Telegram masing-masing Divisi...'
            : 'Mengirim **Executive Daily Briefing** ke Bot Telegram CEO...',
        },
      ])

      try {
        const mode = lower.includes('hari ini') ? 'hari_ini' : (dailyData?.modeRekomendasi ?? 'kemarin')
        const r = await fetch('/api/jarvis/daily-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isDispatchDivisi ? { action: 'dispatch', targetBot: 'all', mode } : { mode }
          ),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.ok) {
          throw new Error(j.galat || 'Gagal mengirim laporan ke Telegram.')
        }
        const pesanOk =
          j.ringkasanSuara || `Instruksi strategis telah berhasil diteruskan ke ${j.terkirimKe || 5} kontak Telegram Operasional, Sir.`
        
        setJawabanHologram(`> **TRANSMISI TELEGRAM BERHASIL**\n\n${pesanOk}`)
        setRiwayatHologram((prev) =>
          prev.map((msg) =>
            msg.id === idJarvis
              ? {
                  ...msg,
                  teks: pesanOk,
                  isDispatch: true,
                  detailDispatch: {
                    terkirimKe: j.terkirimKe || 5,
                    mode,
                    isDivisi: isDispatchDivisi,
                  },
                }
              : msg
          )
        )
        mainkanSuaraHud('blip')
        if (dariVoice || autoVoiceReply) {
          setSedangBicara(true)
          bicaraJarvis(
            pesanOk,
            () => {
              setSedangBicara(false)
              if (voiceLoopRef.current) setTimeout(() => mulaiSesiDengar(true), 350)
            },
            { gunakanTeksPenuh: true }
          )
        }
      } catch (e) {
        mainkanSuaraHud('alert')
        const errText = `> [!WARNING]\n> ${(e as Error).message}`
        setJawabanHologram(errText)
        setRiwayatHologram((prev) =>
          prev.map((msg) => (msg.id === idJarvis ? { ...msg, teks: errText } : msg))
        )
      } finally {
        setSedangMemproses(false)
      }
      return
    }

    // 3. Pintasan Perintah: Buka Panel Laporan Daily / Daily Briefing
    if (
      lower === 'laporan daily' ||
      lower === 'buka laporan daily' ||
      lower === 'tampilkan laporan daily' ||
      lower === 'daily briefing' ||
      lower === 'executive daily briefing' ||
      lower === 'laporan harian'
    ) {
      bukaModalDailyBriefing(true)
      return
    }

    // 4. Tanya-Jawab Langsung ke Unified J.A.R.V.I.S.
    mainkanSuaraHud('transmit')
    hentiBicaraJarvis()
    setSedangBicara(false)
    setSedangMemproses(true)
    setDivisiSorot(deteksiDivisiTopik(isi))

    const idUser = 'u-' + Date.now()
    const idJarvis = 'j-' + (Date.now() + 1)

    setRiwayatHologram((prev) => [
      ...prev.slice(-6),
      { id: idUser, waktu: waktuSekarang, peran: 'user', teks: isi },
      { id: idJarvis, waktu: waktuSekarang, peran: 'jarvis', teks: '' },
    ])
    setJawabanHologram('')

    chatAbortRef.current?.abort()
    const controller = new AbortController()
    chatAbortRef.current = controller

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pesan: isi,
          profil: 'ceo',
          percakapanId: percakapanIdAktif ?? undefined,
        }),
        signal: controller.signal,
      })

      if (!r.ok || !r.body) {
        const b = await r.json().catch(() => ({}))
        throw new Error(b.galat || 'Gagal terhubung ke J.A.R.V.I.S. Core.')
      }

      const idBaru = r.headers.get('X-Percakapan-Id')
      if (idBaru) {
        setPercakapanIdAktif(idBaru)
      }

      const pembaca = r.body.getReader()
      const dekoder = new TextDecoder()
      let terkumpul = ''

      for (;;) {
        const { value, done } = await pembaca.read()
        if (done) break
        const potongan = dekoder.decode(value, { stream: true })
        terkumpul += potongan
        setJawabanHologram(terkumpul)
        setRiwayatHologram((prev) =>
          prev.map((msg) => (msg.id === idJarvis ? { ...msg, teks: terkumpul } : msg))
        )
      }

      mainkanSuaraHud('blip')
      setSedangMemproses(false)

      if ((dariVoice || autoVoiceReply || voiceLoopRef.current) && terkumpul.trim()) {
        setSedangBicara(true)
        bicaraJarvis(terkumpul, () => {
          setSedangBicara(false)
          if (voiceLoopRef.current) {
            setTimeout(() => {
              if (voiceLoopRef.current) {
                mulaiSesiDengar(true)
              }
            }, 350)
          }
        })
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      mainkanSuaraHud('alert')
      setSedangMemproses(false)
      const errText = `> [!WARNING]\n> Transmisi terkendala: ${(e as Error)?.message || 'Koneksi terputus.'}`
      setJawabanHologram(errText)
      setRiwayatHologram((prev) =>
        prev.map((msg) => (msg.id === idJarvis ? { ...msg, teks: errText } : msg))
      )
    }
  }

  // Klik Arc Reactor atau Tombol Voice-to-Voice Utama
  const handleToggleVoiceLoop = () => {
    if (sedangBicara) {
      hentiBicaraJarvis()
      setSedangBicara(false)
      setVoiceLoopAktif(true)
      mulaiSesiDengar(false)
      return
    }

    if (sedangMendengar) {
      mainkanSuaraHud('chirp')
      hentiMendengar(true)
      return
    }

    if (voiceLoopAktif) {
      hentiMendengar(false)
      hentiBicaraJarvis()
      setSedangMendengar(false)
      setSedangBicara(false)
      setVoiceLoopAktif(false)
      setTranskripLive('')
      mainkanSuaraHud('chirp')
    } else {
      setVoiceLoopAktif(true)
      mulaiSesiDengar(false)
    }
  }

  // Toggle Wake Word ("Halo Jarvis")
  const handleToggleWakeWord = () => {
    if (wakeWordNyala) {
      hentiWakeWordJarvis()
      setWakeWordNyala(false)
      mainkanSuaraHud('chirp')
    } else {
      mainkanSuaraHud('engage')
      const ok = mulaiWakeWordJarvis((perintahLangsung) => {
        mainkanSuaraHud('engage')
        setVoiceLoopAktif(true)
        if (perintahLangsung && perintahLangsung.length > 2) {
          void eksekusiPerintahJarvis(perintahLangsung, true)
        } else {
          mulaiSesiDengar(true)
        }
      })
      setWakeWordNyala(ok)
    }
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputPerintah.trim()) return
    const teks = inputPerintah.trim()
    setInputPerintah('')
    if (sedangMendengar) {
      hentiMendengar()
      setSedangMendengar(false)
    }
    void eksekusiPerintahJarvis(teks, false)
  }

  const getMejaByProfil = (profil: Profil): MejaKantor | null => {
    return meja?.find((m) => m.profil === profil) ?? null
  }

  const nodeAktifCount =
    meja?.filter((m) => m.keadaan === 'bekerja' || m.keadaan === 'siaga').length ?? 4
  const adaAnomaliKritis =
    dailyData?.actionItems?.some((a) => a.level === 'critical') ?? false

  const statusCore: StatusArcReactor = sedangMendengar
    ? 'listening'
    : sedangMemproses
      ? 'processing'
      : sedangBicara
        ? 'speaking'
        : adaAnomaliKritis
          ? 'warning'
          : 'optimal'

  return (
    <div className="h-screen h-dvh w-screen overflow-hidden flex flex-col justify-between jarvis-bg text-zinc-100 relative select-none">
      {/* Subtle Scanline Overlay */}
      <div className="absolute inset-0 jarvis-scanlines pointer-events-none opacity-30 z-10" />

      {/* Reticles di 4 Sudut Layar Utama */}
      <div className="fixed top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none z-30" />
      <div className="fixed top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none z-30" />
      <div className="fixed bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none z-30" />
      <div className="fixed bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none z-30" />

      {/* TOP AVIONICS HUD HEADER (100% Full Width) */}
      <header className="relative z-20 w-full border-b border-cyan-500/25 bg-black/80 backdrop-blur-md px-3 sm:px-5 py-2 shrink-0">
        <div className="w-full flex items-center justify-between gap-2">
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
                <span className="font-mono-hud text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/60 border border-cyan-400/40 text-cyan-300 font-semibold">
                  UNIFIED AI CORE
                </span>
              </div>
              <p className="font-mono-hud text-[10px] text-cyan-400/80 tracking-wider hidden sm:block">
                SUKA SHAWARMA ALL-DIVISION COMMAND &bull; CLEARANCE: {nama.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Quick HUD Navigation & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Laporan Daily Quick Button */}
            <button
              type="button"
              onClick={() => bukaModalDailyBriefing(true)}
              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 border border-cyan-300/50 text-white font-mono-hud text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              title="Buka Hologram Laporan Daily & Voice Briefing"
            >
              <FileBarChart2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DAILY BRIEFING</span>
            </button>

            {/* Wake Word Standby Toggle ("Halo Jarvis") */}
            {voiceDidukung && (
              <button
                type="button"
                onClick={handleToggleWakeWord}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border font-mono-hud text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                  wakeWordNyala
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-zinc-900/70 border-zinc-700/60 text-zinc-400 hover:text-cyan-300'
                }`}
                title={
                  wakeWordNyala
                    ? 'Wake Word Aktif: Panggil "Halo Jarvis" kapan saja'
                    : 'Aktifkan Wake Word ("Halo Jarvis")'
                }
              >
                <Radio className={`w-3.5 h-3.5 ${wakeWordNyala ? 'text-emerald-400 animate-ping' : ''}`} />
                <span className="hidden xl:inline">
                  {wakeWordNyala ? 'WAKE: "JARVIS" ON' : 'WAKE WORD: OFF'}
                </span>
              </button>
            )}

            {/* Pilihan Karakter Suara */}
            <div className="relative flex items-center">
              <select
                value={voiceIdAktif}
                onChange={(e) => {
                  const idBaru = e.target.value
                  setVoiceIdAktif(idBaru)
                  setSuaraJarvisAktif(idBaru)
                  mainkanSuaraHud('chirp')
                  const info = PILIHAN_SUARA_JARVIS.find((v) => v.id === idBaru)
                  const sapaanTes =
                    info?.gender === 'Wanita'
                      ? 'Siap Bos, modul suara saya sekarang aktif mendampingi Anda.'
                      : 'Siap Sir, sistem suara saya sudah aktif dan siap berdiskusi.'
                  setSedangBicara(true)
                  bicaraJarvis(sapaanTes, () => setSedangBicara(false), {
                    gunakanTeksPenuh: true,
                    voiceId: idBaru,
                  })
                }}
                className="px-2 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-400/50 text-cyan-200 font-mono-hud text-xs font-semibold focus:outline-none focus:border-cyan-300 cursor-pointer hover:bg-cyan-900/70 transition-colors"
                title="Pilih Karakter Suara J.A.R.V.I.S."
                aria-label="Pilih Karakter Suara J.A.R.V.I.S."
              >
                {PILIHAN_SUARA_JARVIS.map((v) => (
                  <option key={v.id} value={v.id} className="bg-zinc-950 text-cyan-100">
                    VOICE // {v.label.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-Voice Reply Toggle */}
            <button
              type="button"
              onClick={() => {
                const baru = !autoVoiceReply
                setAutoVoiceReply(baru)
                if (!baru) {
                  hentiBicaraJarvis()
                  setSedangBicara(false)
                }
                mainkanSuaraHud('chirp')
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border font-mono-hud text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                autoVoiceReply
                  ? 'bg-cyan-950/70 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500'
              }`}
              title={autoVoiceReply ? 'Suara Balasan Jarvis: OTOMATIS' : 'Suara Balasan Jarvis: MUTE'}
            >
              {autoVoiceReply ? (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline text-[10px]">
                {autoVoiceReply ? 'VOICE: ON' : 'VOICE: OFF'}
              </span>
            </button>

            {/* SFX Audio Toggle */}
            <button
              type="button"
              onClick={toggleSuara}
              className={`p-1.5 sm:px-2 sm:py-1.5 rounded-lg border font-mono-hud text-xs transition-colors hidden lg:flex items-center gap-1 cursor-pointer ${
                suaraNyala
                  ? 'bg-cyan-950/50 border-cyan-500/30 text-cyan-300'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500'
              }`}
              title={suaraNyala ? 'SFX HUD Nyala' : 'SFX HUD Mute'}
            >
              <span className="text-[10px]">{suaraNyala ? 'SFX: ON' : 'SFX: OFF'}</span>
            </button>

            {/* Full Screen Toggle */}
            <button
              type="button"
              onClick={toggleFullScreen}
              className={`p-1.5 sm:p-2 rounded-lg border font-mono-hud text-xs transition-all flex items-center gap-1 cursor-pointer ${
                isLayarPenuh
                  ? 'bg-cyan-600/80 border-cyan-400 text-white'
                  : 'bg-zinc-900/80 border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
              }`}
              title={isLayarPenuh ? 'Keluar Layar Penuh' : 'Masuk Mode Layar Penuh'}
            >
              {isLayarPenuh ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Pengaturan Telegram */}
            <a
              href="/telegram"
              onClick={() => mainkanSuaraHud('blip')}
              className="p-1.5 sm:p-2 rounded-lg border border-cyan-500/30 bg-zinc-900/80 text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
              title="Pengaturan Integrasi Bot Telegram"
              aria-label="Pengaturan Integrasi Bot Telegram"
            >
              <Bell className="w-3.5 h-3.5" />
            </a>

            {/* Link Portal */}
            <a
              href={portalUrl}
              onClick={() => mainkanSuaraHud('blip')}
              className="p-1.5 sm:p-2 rounded-lg border border-cyan-500/30 bg-zinc-900/80 text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
              title="Kembali ke Portal"
            >
              <Home className="w-3.5 h-3.5" />
            </a>

            {/* Logout */}
            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('alert')
                keluar(portalUrl)
              }}
              className="p-1.5 sm:p-2 rounded-lg border border-red-500/30 bg-red-950/30 text-red-300 hover:border-red-400 transition-colors cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN COMMAND INTERFACE (Opsi A: Center Stage Iron Man Layout) */}
      <main className="relative z-20 flex-1 min-h-0 w-full px-3 sm:px-4 lg:px-5 py-2 flex flex-col justify-between overflow-hidden">
        {/* TACTICAL 3-COLUMN HUD GRID: Left = 3 Cols (Ops & HRD), Center = 6 Cols (Arc Reactor + Hologram Stage), Right = 3 Cols (Sales & Finance) */}
        <div className="flex-1 min-h-0 w-full grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-3.5 items-stretch">
          
          {/* Left Wing (3 Cols / 25%): OPERASIONAL & KRU (DIV-03 Ops & DIV-04 HRD) */}
          <div className="w-full lg:col-span-3 flex flex-col gap-2 h-full min-h-0">
            {/* Radar Header */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-cyan-500/35 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="font-hud text-xs tracking-widest uppercase text-cyan-300 font-bold truncate">
                  RADAR OPERASIONAL &amp; KRU
                </span>
              </div>
              <span className="font-mono-hud text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-semibold shrink-0">
                OPS &bull; HRD
              </span>
            </div>

            {/* Stacked Cards Container */}
            <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5 no-scrollbar">
              <AgentNodeCard
                profilFallback="gudang"
                meja={getMejaByProfil('gudang')}
                telemetri={dailyData?.telemetri}
                modeWaktu={modeWaktuKotak}
                terpilih={divisiSorot === 'gudang'}
                className="flex-1 min-h-0 h-full"
                onPilih={(_p, q) =>
                  void eksekusiPerintahJarvis(
                    q ||
                      (modeWaktuKotak === 'kemarin'
                        ? 'Analisis laporan waste bahan baku tertinggi, rekap tutup shift kemarin, dan void kasir kemarin.'
                        : 'Analisis laporan waste bahan baku tertinggi, status buka cabang, dan void kasir hari ini.'),
                    false
                  )
                }
              />

              <AgentNodeCard
                profilFallback="hrd"
                meja={getMejaByProfil('hrd')}
                telemetri={dailyData?.telemetri}
                modeWaktu={modeWaktuKotak}
                terpilih={divisiSorot === 'hrd'}
                className="flex-1 min-h-0 h-full"
                onPilih={(_p, q) =>
                  void eksekusiPerintahJarvis(
                    q ||
                      (modeWaktuKotak === 'kemarin'
                        ? 'Siapa saja kru outlet yang terlambat atau izin kemarin, dan bagaimana rating Google Review?'
                        : 'Siapa saja kru outlet yang terlambat atau izin hari ini, dan bagaimana rating Google Review?'),
                    false
                  )
                }
              />
            </div>
          </div>

          {/* Center Stage (6 Cols / 50%): THE HERO COMMAND CORE (Majestic Arc Reactor + Hologram Stage) */}
          <div className="order-first lg:order-none w-full lg:col-span-6 flex flex-col justify-between items-center h-full min-h-0 relative px-1 py-0.5">
            {/* Top / Center: The Majestic Arc Reactor */}
            <div className="shrink-0 flex flex-col items-center justify-center relative w-full">
              <ArcReactor
                status={statusCore}
                compact={false}
                voiceLoopAktif={voiceLoopAktif}
                spektrumSuara={spektrumSuara}
                transkripLive={transkripLive}
                anomaliItems={dailyData?.actionItems?.filter((a) => a.level === 'critical' || a.level === 'warning')}
                onClickCore={handleToggleVoiceLoop}
                onPilihAnomali={(item) =>
                  void eksekusiPerintahJarvis(
                    item.perintahTindakLanjut ||
                      `Jelaskan anomali ${item.judul} dan berikan rekomendasi penanganan taktis.`,
                    false
                  )
                }
                onBukaDailyBriefing={() => bukaModalDailyBriefing(true)}
                onBukaChatLengkap={() => {
                  setPesanAwalDrawer(null)
                  setTampilChatDrawer(true)
                }}
              />
            </div>

            {/* Middle: Floating Holographic Transmission Feed OR Standby Aura */}
            {riwayatHologram.length > 0 ? (
              <div className="w-full flex-1 min-h-0 rounded-2xl bg-zinc-950/85 border border-cyan-400/35 backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.18)] flex flex-col overflow-hidden my-0.5 animate-in fade-in duration-200 relative">
                {/* Hologram Reticles */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                {/* Feed Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-950/60 border-b border-cyan-500/20 font-mono-hud text-xs shrink-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="font-hud text-xs text-cyan-200 font-bold uppercase tracking-wider">
                      HOLOGRAPHIC TRANSMISSION FEED
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {jawabanHologram && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (sedangBicara) {
                              hentiBicaraJarvis()
                              setSedangBicara(false)
                            } else {
                              setSedangBicara(true)
                              bicaraJarvis(jawabanHologram, () => setSedangBicara(false))
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          {sedangBicara ? (
                            <>
                              <VolumeX className="w-3 h-3 text-red-400" />
                              <span className="text-red-300 font-bold">STOP</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-cyan-300" />
                              <span>SPEAK</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => void eksekusiPerintahJarvis('Dispatch semua instruksi rekomendasi ke divisi Telegram', false)}
                          className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 flex items-center gap-1 text-[11px] cursor-pointer"
                          title="Dispatch Rekomendasi ke Bot Telegram Divisi"
                        >
                          <Send className="w-3 h-3 text-cyan-300" />
                          <span>DISPATCH</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            mainkanSuaraHud('engage')
                            if (typeof window === 'undefined') return
                            const win = window.open('', '_blank', 'width=920,height=800')
                            if (!win) return
                            const escaped = jawabanHologram
                              .replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;')
                              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                              .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                              .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
                              .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                            win.document.open()
                            win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><title>Laporan Evaluasi J.A.R.V.I.S. - Suka Shawarma</title><style>body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:28px;line-height:1.5;white-space:pre-wrap;}h1{font-size:18px;border-bottom:2px solid #0284c7;padding-bottom:6px;margin-bottom:8px;}h3{font-size:14px;color:#0369a1;margin:14px 0 4px 0;}h4{font-size:13px;color:#0f172a;margin:10px 0 2px 0;}</style></head><body>${escaped}<script>window.onload=()=>{setTimeout(()=>window.print(),250);};</script></body></html>`)
                            win.document.close()
                          }}
                          className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
                          title="Cetak / Simpan PDF Laporan"
                        >
                          <Printer className="w-3 h-3" />
                          <span className="hidden sm:inline">PDF</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        mainkanSuaraHud('chirp')
                        setPesanAwalDrawer(null)
                        setTampilChatDrawer(true)
                      }}
                      className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 text-xs font-mono-hud cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                      title="Buka Layar Penuh"
                      aria-label="Buka Layar Penuh"
                    >
                      <MessageSquare className="size-3.5" />
                      <span className="hidden sm:inline">FULL</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        hentiBicaraJarvis()
                        setSedangBicara(false)
                        setJawabanHologram('')
                        setRiwayatHologram([])
                        setDivisiSorot(null)
                      }}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-red-300 hover:bg-red-950/30 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                      title="Bersihkan Layar"
                      aria-label="Bersihkan Layar"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Conversation Stream */}
                <div className="p-3 overflow-y-auto flex-1 min-h-0 space-y-3">
                  {riwayatHologram.map((item) => (
                    <div key={item.id} className="space-y-1.5 animate-in fade-in duration-200">
                      {item.peran === 'user' ? (
                        <div className="flex items-start justify-end gap-2">
                          <div className="max-w-[85%] rounded-xl px-3 py-1.5 bg-cyan-950/70 border border-cyan-400/40 text-cyan-100 font-mono-hud text-xs shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                            <div className="flex items-center justify-between gap-3 text-[10px] text-cyan-400/80 mb-0.5 border-b border-cyan-500/20 pb-0.5">
                              <span className="font-bold tracking-wider">COMMAND // ANDA</span>
                              <span>{item.waktu}</span>
                            </div>
                            <p className="leading-relaxed">&ldquo;{item.teks}&rdquo;</p>
                          </div>
                        </div>
                      ) : item.isDispatch ? (
                        <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/35 p-3 shadow-[0_0_24px_rgba(16,185,129,0.22)] font-mono-hud backdrop-blur-md">
                          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/30 mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              <span className="font-hud text-xs font-bold text-emerald-200 tracking-wider">
                                ENCRYPTED TELEGRAM DISPATCH // VERIFIED
                              </span>
                            </div>
                            <span className="text-[10px] text-emerald-300 font-semibold">{item.waktu}</span>
                          </div>
                          <p className="text-xs text-zinc-100 leading-relaxed mb-2.5">
                            {item.teks}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2 text-[10px]">
                            {['CEO & Owner', 'Finance & Treasury', 'Gudang & Ops', 'HRD & Personalia', 'SukaReview & CS'].map((div, dIdx) => (
                              <div key={dIdx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 border border-emerald-500/30 text-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="truncate">{div}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-emerald-500/25">
                            <button
                              type="button"
                              onClick={() => void eksekusiPerintahJarvis('Tampilkan rincian isi instruksi rekomendasi yang baru saja dikirim ke Telegram divisi.', false)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-400/50 text-emerald-100 text-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>📋 Rincian Instruksi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void eksekusiPerintahJarvis('Tampilkan progres omzet berjalan dan cabang yang sudah buka hari ini.', false)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-400/40 text-cyan-200 text-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>📊 Pantau Progres Cabang</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl p-3 bg-zinc-950/70 border border-cyan-500/25 text-zinc-100 font-mono-hud text-xs shadow-md">
                          <div className="flex items-center justify-between text-[10px] text-cyan-400/70 border-b border-cyan-500/20 pb-1 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              <span className="font-hud font-bold tracking-wider text-cyan-300">J.A.R.V.I.S. INTELLIGENCE</span>
                            </div>
                            <span>{item.waktu}</span>
                          </div>
                          <FormatIsiHologram isi={item.teks} />
                        </div>
                      )}
                    </div>
                  ))}
                  {sedangMemproses && (
                    <div className="flex items-center gap-2 text-cyan-300 font-mono-hud text-xs py-2 px-3 rounded-lg bg-cyan-950/50 border border-cyan-500/30 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span>J.A.R.V.I.S. SEDANG MENGANALISIS TELEMETRI DATABASE...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            ) : (
              /* Standby: Hermes Tactical Anomaly & Operations Matrix Deck */
              <div className="w-full flex-1 min-h-0 rounded-2xl bg-zinc-950/85 border border-cyan-500/30 backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.12)] flex flex-col overflow-hidden my-0.5 animate-in fade-in duration-200 relative">
                {/* Hologram Reticles */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                {/* Deck Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-950/60 border-b border-cyan-500/20 font-mono-hud text-xs shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${adaAnomaliKritis ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="font-hud text-xs text-cyan-200 font-bold uppercase tracking-wider truncate">
                      {adaAnomaliKritis
                        ? `TACTICAL ANOMALY RADAR // ${dailyData?.actionItems?.length || 0} ISSUES LOGGED`
                        : 'HERMES NEURAL OPERATIONS MATRIX'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => bukaModalDailyBriefing(true)}
                      className="px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Buka Laporan Daily Komprehensif"
                    >
                      <FileBarChart2 className="w-3 h-3 text-cyan-300" />
                      <span>BRIEFING</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void eksekusiPerintahJarvis('Dispatch semua instruksi rekomendasi ke divisi Telegram', false)}
                      className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 flex items-center gap-1 text-[11px] cursor-pointer"
                      title="Dispatch Rekomendasi ke Bot Telegram Divisi"
                    >
                      <Send className="w-3 h-3 text-cyan-300" />
                      <span>DISPATCH</span>
                    </button>
                  </div>
                </div>

                {/* Content Stream: Anomaly Cards or Divisional Heartbeat */}
                <div className="p-2 sm:p-2.5 overflow-y-auto flex-1 min-h-0 space-y-2 no-scrollbar">
                  {dailyData?.actionItems && dailyData.actionItems.length > 0 ? (
                    dailyData.actionItems.map((item, idx) => {
                      const isCritical = item.level === 'critical'
                      return (
                        <div
                          key={item.id || idx}
                          className={`p-2 sm:p-2.5 rounded-xl border backdrop-blur-md transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            isCritical
                              ? 'bg-red-950/30 border-red-500/40 hover:border-red-400/70 hover:bg-red-950/45'
                              : 'bg-amber-950/25 border-amber-500/35 hover:border-amber-400/60 hover:bg-amber-950/35'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono-hud font-bold tracking-wider uppercase shrink-0 ${
                                  isCritical
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {item.divisi}
                              </span>
                              <span className="font-mono-hud text-xs font-semibold text-zinc-100 truncate">
                                {item.judul}
                              </span>
                            </div>
                            {item.deskripsi && (
                              <p className="text-[11px] font-mono-hud text-zinc-400 line-clamp-1">
                                {item.deskripsi}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              mainkanSuaraHud('chirp')
                              void eksekusiPerintahJarvis(
                                item.perintahTindakLanjut ||
                                  `Investigasi anomali [${item.divisi}] ${item.judul} dan berikan rekomendasi penanganan taktis.`,
                                false
                              )
                            }}
                            className={`px-2.5 py-1 rounded-lg border font-hud text-[10px] tracking-wider uppercase font-bold shrink-0 transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isCritical
                                ? 'bg-red-900/70 hover:bg-red-800 border-red-400/50 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                                : 'bg-amber-900/70 hover:bg-amber-800 border-amber-400/50 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                            }`}
                          >
                            <span>TINDAK LANJUT</span>
                            <span className="text-[9px] font-mono-hud">&gt;&gt;</span>
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    /* Divisional Heartbeat Matrix when no anomalies */
                    <div className="h-full flex flex-col items-center justify-center py-4 text-center space-y-2.5 font-mono-hud">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/30 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.15)]">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-hud tracking-wider uppercase font-bold text-xs">
                          HERMES NEURAL LINKED &bull; 4 DIVISI AKTIF
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                        Semua telemetri divisi berjalan optimal. Bicara langsung atau pilih direktif cepat di bawah.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Telemetry Strip */}
                <div className="px-3 py-1 bg-black/60 border-t border-cyan-500/20 flex items-center justify-between text-[10px] font-mono-hud text-cyan-400/70 shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>HERMES AI &bull; {nodeAktifCount}/4 NODES ONLINE</span>
                  </span>
                  <span>VOICE &bull; TAP OR SAY &quot;HALO JARVIS&quot;</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Wing (3 Cols / 25%): SALES & TREASURY (DIV-01 Sales & DIV-02 Finance) */}
          <div className="w-full lg:col-span-3 flex flex-col gap-2 h-full min-h-0">
            {/* Radar Header with Time Switch */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-cyan-500/35 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="font-hud text-xs tracking-widest uppercase text-cyan-300 font-bold truncate">
                  RADAR SALES &amp; FINANCE
                </span>
              </div>

              <div className="flex items-center gap-1 bg-black/80 p-0.5 rounded-lg border border-cyan-500/25 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    mainkanSuaraHud('chirp')
                    setModeWaktuKotak('kemarin')
                  }}
                  className={`px-2 py-0.5 rounded font-mono-hud text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    modeWaktuKotak === 'kemarin'
                      ? 'bg-cyan-600/85 text-white border border-cyan-300/60 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                      : 'text-zinc-400 hover:text-cyan-200'
                  }`}
                  title="Tampilkan data evaluasi closing kemarin"
                >
                  H-1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    mainkanSuaraHud('chirp')
                    setModeWaktuKotak('hari_ini')
                  }}
                  className={`px-2 py-0.5 rounded font-mono-hud text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    modeWaktuKotak === 'hari_ini'
                      ? 'bg-emerald-600/85 text-white border border-emerald-300/60 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                      : 'text-zinc-400 hover:text-emerald-200'
                  }`}
                  title="Tampilkan data live berjalan hari ini"
                >
                  LIVE
                </button>
              </div>
            </div>

            {/* Stacked Cards Container */}
            <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5 no-scrollbar">
              <AgentNodeCard
                profilFallback="ceo"
                meja={getMejaByProfil('ceo')}
                telemetri={dailyData?.telemetri}
                modeWaktu={modeWaktuKotak}
                terpilih={divisiSorot === 'ceo'}
                className="flex-1 min-h-0 h-full"
                onPilih={(_p, q) =>
                  void eksekusiPerintahJarvis(
                    q ||
                      (modeWaktuKotak === 'kemarin'
                        ? 'Buat laporan evaluasi komprehensif kemarin (H-1) dari semua aplikasi lengkap dengan analisis performa dan rekomendasi taktis.'
                        : 'Tampilkan peringkat omzet seluruh cabang live hari ini beserta menu terlaris.'),
                    false
                  )
                }
              />

              <AgentNodeCard
                profilFallback="finance"
                meja={getMejaByProfil('finance')}
                telemetri={dailyData?.telemetri}
                modeWaktu={modeWaktuKotak}
                terpilih={divisiSorot === 'finance'}
                className="flex-1 min-h-0 h-full"
                onPilih={(_p, q) =>
                  void eksekusiPerintahJarvis(
                    q ||
                      (modeWaktuKotak === 'kemarin'
                        ? 'Rincikan pengeluaran OPEX kemarin, kas fisik tutup shift kemarin, selisih kasir, dan utang PO supplier.'
                        : 'Rincikan pengeluaran OPEX hari ini, setoran kas, dan utang PO supplier.'),
                    false
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* BOTTOM COMMAND CONSOLE DOCK (Centered, Balanced Cockpit Foundation) */}
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-1.5 shrink-0 pt-2 pb-0.5">
          {/* Quick Directive Chips (Strict No-Emoji HUD Standard) */}
          <div className="w-full flex items-center justify-center flex-wrap gap-1.5 py-0.5">
            <button
              type="button"
              onClick={() => bukaModalDailyBriefing(true)}
              className="px-2.5 py-1 min-h-[30px] rounded-lg bg-cyan-600/40 hover:bg-cyan-600/70 text-cyan-100 border border-cyan-400/60 font-mono-hud text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            >
              <Zap className="size-3 text-cyan-300 shrink-0" />
              <span>Daily Briefing</span>
            </button>
            {[
              { icon: Calendar, label: 'Evaluasi Kemarin', pesan: 'Buat laporan evaluasi komprehensif kemarin (H-1) dari semua aplikasi (penjualan, finance, HRD, waste, stok, distribusi, dan review) lengkap dengan rekomendasi dan saran taktis dari agent.' },
              { icon: DollarSign, label: 'OPEX & Kas', pesan: 'Berapa total pengeluaran OPEX kemarin, kas fisik tutup shift kemarin, selisih kasir, dan utang PO supplier?' },
              { icon: Trash2, label: 'Waste & Void', pesan: 'Analisis laporan waste bahan baku tertinggi dan cek transaksi void POS kemarin.' },
              { icon: Users, label: 'Presensi Kru', pesan: 'Siapa saja kru outlet yang terlambat atau izin/cuti kemarin?' },
              { icon: Activity, label: 'Live Hari Ini', pesan: 'Tampilkan progres omzet berjalan dan cabang yang sudah buka hari ini.' },
              { icon: Send, label: 'Kirim Telegram', pesan: 'Kirim laporan daily ke Telegram' },
            ].map((chip, idx) => {
              const ChipIcon = chip.icon
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void eksekusiPerintahJarvis(chip.pesan, false)}
                  className="px-2.5 py-1 min-h-[30px] rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 font-mono-hud text-[11px] sm:text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                >
                  <ChipIcon className="size-3 text-cyan-400/80 shrink-0" />
                  <span>{chip.label}</span>
                </button>
              )
            })}
          </div>

          {/* Centered Command Bar */}
          <form
            onSubmit={handleSubmitForm}
            className="w-full relative flex items-center rounded-2xl bg-zinc-950/90 border border-cyan-400/50 shadow-[0_0_24px_rgba(6,182,212,0.2)] backdrop-blur-xl focus-within:border-cyan-300 focus-within:shadow-[0_0_32px_rgba(6,182,212,0.35)] transition-all p-1.5"
          >
            <div className="pl-3 pr-2 text-cyan-400 flex items-center">
              <Sparkles className="w-4 h-4 animate-spin text-cyan-300" />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={inputPerintah}
              onChange={(e) => setInputPerintah(e.target.value)}
              placeholder={
                sedangMendengar
                  ? '🎙️ Mendengarkan Anda... (otomatis terkirim)'
                  : "Ketik instruksi/pertanyaan atau tekan '/'..."
              }
              className="w-full bg-transparent font-mono-hud text-xs sm:text-sm text-cyan-100 placeholder-cyan-400/45 py-1.5 focus:outline-none"
            />

            {voiceDidukung && (
              <button
                type="button"
                onClick={handleToggleVoiceLoop}
                className={`p-1.5 sm:px-3 py-1.5 rounded-xl border transition-all cursor-pointer mr-1 flex items-center gap-1.5 shrink-0 ${
                  sedangMendengar || voiceLoopAktif
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-cyan-950/60 border-cyan-500/35 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60'
                }`}
                title={
                  sedangMendengar || voiceLoopAktif
                    ? 'Hentikan / Kirim Suara Sekarang'
                    : 'Mulai Ngobrol Voice-to-Voice dengan Jarvis'
                }
              >
                {sedangMendengar || voiceLoopAktif ? (
                  <MicOff className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline text-xs font-mono-hud font-bold">
                  {sedangMendengar ? 'LISTENING' : voiceLoopAktif ? 'LOOP: ON' : 'VOICE'}
                </span>
              </button>
            )}

            <button
              type="submit"
              disabled={sedangMemproses || !inputPerintah.trim()}
              className="px-3 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-hud text-xs tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>KIRIM</span>
            </button>
          </form>
        </div>
      </main>

      {/* BOTTOM TELEMETRY TICKER */}
      <TelemetryTicker
        diambilAt={diambilAt}
        pollingGagal={pollingGagal}
        totalActive={nodeAktifCount}
        telemetri={dailyData?.telemetri}
      />

      {/* MODAL HOLOGRAM LAPORAN DAILY (5 PILAR + AI ACTION ITEMS) */}
      {tampilDailyBriefing && (
        <DailyBriefingModal
          data={dailyData}
          memuat={memuatDaily}
          sedangBicaraBriefing={sedangBicara}
          onRefresh={() => void muatDailyTelemetry(true)}
          onTutup={() => setTampilDailyBriefing(false)}
          onTanyaJarvis={(perintah) => void eksekusiPerintahJarvis(perintah, false)}
          onStatusBicaraChange={(bicara) => setSedangBicara(bicara)}
        />
      )}

      {/* SIDE CHAT DRAWER */}
      {tampilChatDrawer && (
        <JarvisChatDrawer
          profil="ceo"
          pesanAwal={pesanAwalDrawer}
          percakapanIdAwal={percakapanIdAktif}
          onPercakapanIdChange={(idBaru) => setPercakapanIdAktif(idBaru)}
          onTutup={() => {
            mainkanSuaraHud('chirp')
            setTampilChatDrawer(false)
            setPesanAwalDrawer(null)
          }}
        />
      )}
    </div>
  )
}
