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
  Cpu,
} from 'lucide-react'

const POLL_STATUS_MS = 12_000
const POLL_TELEMETRY_MS = 25_000

interface JarvisAppProps {
  nama: string
  portalUrl: string
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
  const [pertanyaanTerakhir, setPertanyaanTerakhir] = useState<string | null>(null)
  const [jawabanHologram, setJawabanHologram] = useState<string>('')
  const [divisiSorot, setDivisiSorot] = useState<Profil | null>(null)

  // Modal / Drawer States
  const [tampilDailyBriefing, setTampilDailyBriefing] = useState(false)
  const [tampilChatDrawer, setTampilChatDrawer] = useState(false)
  const [pesanAwalDrawer, setPesanAwalDrawer] = useState<string | null>(null)

  const voiceLoopRef = useRef(false)
  const chatAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    voiceLoopRef.current = voiceLoopAktif
  }, [voiceLoopAktif])

  // Inisialisasi dukungan suara & listener spektrum frekuensi Arc Reactor
  useEffect(() => {
    setSuaraNyala(apakahSuaraHudAktif())
    setVoiceIdAktif(ambilSuaraJarvisAktif())
    setVoiceDidukung(apakahVoiceDidukung().stt)
    pasangListenerSpektrumSuara((bands) => {
      setSpektrumSuara(bands)
    })
    return () => {
      pasangListenerSpektrumSuara(null)
      hentiMendengar()
      hentiBicaraJarvis()
      hentiWakeWordJarvis()
      chatAbortRef.current?.abort()
    }
  }, [])

  // Fullscreen listener
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
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }

  const toggleSuara = () => {
    const baru = !suaraNyala
    setSuaraNyala(baru)
    setSuaraHud(baru)
    if (baru) mainkanSuaraHud('blip')
  }

  // Muat status node kantor
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

  // Muat telemetri nyata 5 pilar & Daily Briefing
  const muatDailyTelemetry = useCallback(async (forceRefresh = false) => {
    setMemuatDaily(true)
    try {
      const r = await fetch(`/api/jarvis/daily-report${forceRefresh ? '?refresh=1' : ''}`, {
        cache: 'no-store',
      })
      if (r.ok) {
        const data = (await r.json()) as DailyReportPayload
        setDailyData(data)
        setDiambilAt(data.diambilAt)
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

  // Fungsi mulai mendengarkan suara (mendukung Auto-Turn Loop & Dual-Engine STT)
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

  // Buka Daily Briefing Modal & opsional langsung bacakan suara
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

  // Eksekusi perintah utama ke Unified J.A.R.V.I.S. (baik dari ketik teks maupun Voice-to-Voice)
  const eksekusiPerintahJarvis = async (teksMentah: string, dariVoice = false) => {
    const isi = teksMentah.trim()
    if (!isi) return

    const lower = isi.toLowerCase()

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

    // 2. Pintasan Perintah: Kirim Laporan Daily ke Telegram
    if (
      (lower.includes('kirim') || lower.includes('broadcast') || lower.includes('share')) &&
      lower.includes('telegram')
    ) {
      mainkanSuaraHud('transmit')
      setPertanyaanTerakhir(isi)
      setSedangMemproses(true)
      setJawabanHologram('Mengirim **Executive Daily Briefing** ke Bot Telegram CEO...')
      try {
        const mode = lower.includes('kemarin') ? 'kemarin' : (dailyData?.modeRekomendasi ?? 'hari_ini')
        const r = await fetch('/api/jarvis/daily-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.ok) {
          throw new Error(j.galat || 'Gagal mengirim laporan ke Telegram.')
        }
        const pesanOk =
          j.ringkasanSuara || `Laporan Daily berhasil dikirim ke ${j.terkirimKe} kontak Telegram CEO, Sir.`
        setJawabanHologram(`> **TRANSMISI TELEGRAM BERHASIL**\n\n${pesanOk}`)
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
        setJawabanHologram(`> [!WARNING]\n> ${(e as Error).message}`)
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

    // 4. Tanya-Jawab Langsung ke Unified J.A.R.V.I.S. (Profil 'ceo' = Akses Semua Divisi)
    mainkanSuaraHud('transmit')
    hentiBicaraJarvis()
    setSedangBicara(false)
    setPertanyaanTerakhir(isi)
    setJawabanHologram('')
    setSedangMemproses(true)
    setDivisiSorot(deteksiDivisiTopik(isi))

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
      }

      mainkanSuaraHud('blip')
      setSedangMemproses(false)

      // Bacakan intisari eksekutif dengan suara J.A.R.V.I.S. jika Voice-to-Voice / Auto-Voice aktif
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
      setJawabanHologram(
        `> [!WARNING]\n> Transmisi terkendala: ${(e as Error)?.message || 'Koneksi terputus.'}`
      )
    }
  }

  // Klik Arc Reactor atau Tombol Voice-to-Voice Utama
  const handleToggleVoiceLoop = () => {
    // Jika Jarvis sedang bicara, klik Core berfungsi sebagai Interrupt / Barge-in untuk langsung bicara!
    if (sedangBicara) {
      hentiBicaraJarvis()
      setSedangBicara(false)
      setVoiceLoopAktif(true)
      mulaiSesiDengar(false)
      return
    }

    if (sedangMendengar) {
      // Jika sedang merekam suara, klik kedua akan langsung memproses/mengirim suara yang sudah diucapkan (atau mematikan mic jika hening)
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
      <header className="relative z-20 w-full border-b border-cyan-500/25 bg-black/75 backdrop-blur-md px-3 sm:px-5 py-2 shrink-0">
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
                <span className="font-mono-hud text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/60 border border-cyan-400/40 text-cyan-300 font-semibold">
                  UNIFIED AI CORE
                </span>
              </div>
              <p className="font-mono-hud text-[9px] text-cyan-400/70 tracking-wider hidden sm:block">
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
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 border border-cyan-300/50 text-white font-mono-hud text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.3)]"
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
                className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg border font-mono-hud text-[10px] transition-colors flex items-center gap-1 cursor-pointer ${
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

            {/* Pilihan Karakter Suara (Voice Persona Selector) */}
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
                      ? 'Siap Bos, sistem suara saya sekarang aktif mendampingi Anda.'
                      : 'Siap Sir, modul suara saya sudah aktif dan siap berdiskusi.'
                  setSedangBicara(true)
                  bicaraJarvis(sapaanTes, () => setSedangBicara(false), {
                    gunakanTeksPenuh: true,
                    voiceId: idBaru,
                  })
                }}
                className="px-2 py-1 rounded-lg bg-cyan-950/80 border border-cyan-400/50 text-cyan-200 font-mono-hud text-[10px] font-semibold focus:outline-none focus:border-cyan-300 cursor-pointer hover:bg-cyan-900/70 transition-colors"
                title="Pilih Karakter Suara J.A.R.V.I.S. / F.R.I.D.A.Y."
                aria-label="Pilih Karakter Suara J.A.R.V.I.S."
              >
                {PILIHAN_SUARA_JARVIS.map((v) => (
                  <option key={v.id} value={v.id} className="bg-zinc-950 text-cyan-100">
                    🎙️ {v.label}
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
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg border font-mono-hud text-[10px] transition-colors flex items-center gap-1 cursor-pointer ${
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
              <span className="hidden md:inline text-[9px]">
                {autoVoiceReply ? 'JARVIS VOICE: ON' : 'JARVIS VOICE: OFF'}
              </span>
            </button>

            {/* SFX Audio Toggle */}
            <button
              type="button"
              onClick={toggleSuara}
              className={`p-1.5 sm:px-2 sm:py-1 rounded-lg border font-mono-hud text-[10px] transition-colors hidden lg:flex items-center gap-1 cursor-pointer ${
                suaraNyala
                  ? 'bg-cyan-950/50 border-cyan-500/30 text-cyan-300'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500'
              }`}
              title={suaraNyala ? 'SFX HUD Nyala' : 'SFX HUD Mute'}
            >
              <span className="text-[9px]">{suaraNyala ? 'SFX: ON' : 'SFX: OFF'}</span>
            </button>

            {/* Full Screen Toggle */}
            <button
              type="button"
              onClick={toggleFullScreen}
              className={`p-1.5 rounded-lg border font-mono-hud text-xs transition-all flex items-center gap-1 cursor-pointer ${
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
              className="p-1.5 rounded-lg border border-cyan-500/30 bg-zinc-900/80 text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
              title="Pengaturan Integrasi Bot Telegram"
              aria-label="Pengaturan Integrasi Bot Telegram"
            >
              <Bell className="w-3.5 h-3.5" />
            </a>

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
              type="button"
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

      {/* MAIN COMMAND INTERFACE (100% Full Width Edge-to-Edge) */}
      <main className="relative z-20 flex-1 min-h-0 w-full px-3 sm:px-5 py-2 sm:py-3 flex flex-col justify-between overflow-y-auto lg:overflow-hidden">
        {/* TACTICAL 3-COLUMN HUD GRID (100% Full Width): Left = Direct Hologram Chat Box (with Input & Directives inside), Center = Full-Size Arc Reactor, Right = All 4 Division Telemetry Boxes */}
        <div className="flex-1 min-h-0 w-full grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-center">
          {/* Left Column: J.A.R.V.I.S. DIRECT HOLOGRAM & CHAT CONSOLE (Lengkap dengan Input & Directives di dalamnya) */}
          <div className="w-full lg:col-span-4 xl:col-span-4 flex flex-col justify-center h-full max-h-[86vh] min-h-0">
            <div className="w-full h-full rounded-xl bg-zinc-950/90 border border-cyan-400/55 shadow-[0_0_32px_rgba(6,182,212,0.22)] backdrop-blur-xl overflow-hidden flex flex-col relative">
              {/* Reticle Corners */}
              <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

              {/* Hologram Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-cyan-950/75 border-b border-cyan-500/30 font-mono-hud text-[10px] shrink-0">
                <div className="flex items-center gap-1.5 truncate pr-2">
                  <Cpu className="w-3.5 h-3.5 text-cyan-300 shrink-0 animate-pulse" />
                  <span className="font-hud text-cyan-200 font-bold tracking-wider uppercase">
                    J.A.R.V.I.S. DIRECT HOLOGRAM
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {jawabanHologram && (
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
                      className="px-2 py-0.5 rounded bg-cyan-900/70 hover:bg-cyan-800 border border-cyan-400/40 text-cyan-200 flex items-center gap-1 cursor-pointer"
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
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      mainkanSuaraHud('chirp')
                      setPesanAwalDrawer(null)
                      setTampilChatDrawer(true)
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 cursor-pointer"
                    title="Buka di Panel Chat & Tabel Lengkap"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>LAYAR PENUH</span>
                  </button>

                  {(pertanyaanTerakhir || jawabanHologram) && (
                    <button
                      type="button"
                      onClick={() => {
                        hentiBicaraJarvis()
                        setSedangBicara(false)
                        setPertanyaanTerakhir(null)
                        setJawabanHologram('')
                        setDivisiSorot(null)
                      }}
                      className="p-0.5 rounded text-zinc-400 hover:text-red-300 cursor-pointer"
                      title="Bersihkan Layar Hologram"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Pertanyaan Terakhir User */}
              {pertanyaanTerakhir && (
                <div className="px-3.5 py-2 bg-cyan-950/35 border-b border-cyan-500/20 font-mono-hud text-xs text-cyan-100 flex items-start gap-2 shrink-0">
                  <span className="text-cyan-400 font-bold shrink-0">ANDA:</span>
                  <span className="italic text-cyan-200">&ldquo;{pertanyaanTerakhir}&rdquo;</span>
                </div>
              )}

              {/* Hologram Stream Body */}
              <div className="p-3.5 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                {jawabanHologram ? (
                  <FormatIsiHologram isi={jawabanHologram} />
                ) : sedangMemproses ? (
                  <div className="flex items-center gap-2 text-cyan-300 font-mono-hud text-xs py-4">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>J.A.R.V.I.S. SEDANG MENGANALISIS TELEMETRI DATABASE...</span>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-between gap-4 py-1 font-mono-hud">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-[10px] text-cyan-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>HOLOGRAM TERMINAL STANDBY</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Selamat bertugas, <span className="text-cyan-300 font-bold">{nama}</span>. Klik bola inti{' '}
                        <span className="text-cyan-300 font-semibold">J.A.R.V.I.S.</span> di tengah untuk mulai mengobrol dengan suara, atau ketik pertanyaan di kolom bawah ini.
                      </p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Seluruh jawaban lisan dan tabel analisis lintas divisi (Sales, Finance, Gudang/Waste, HRD &amp; Google Review) ditampilkan langsung di panel kiri ini.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTTOM CONSOLE INSIDE CHAT BOX: Quick Directive Chips + Input Bar */}
              <div className="p-2.5 bg-black/75 border-t border-cyan-500/25 space-y-2 shrink-0">
                {/* Quick Directive Chips */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bukaModalDailyBriefing(true)}
                    className="px-2 py-0.5 rounded bg-cyan-600/35 hover:bg-cyan-600/55 text-cyan-100 border border-cyan-400/50 font-mono-hud text-[9px] font-bold transition-all cursor-pointer"
                  >
                    ⚡ Daily Briefing (5 Pilar)
                  </button>
                  {[
                    { label: '📊 Omzet Hari Ini', pesan: 'Tampilkan peringkat omzet seluruh cabang hari ini.' },
                    { label: '📅 Evaluasi Kemarin', pesan: 'Bagaimana rekapitulasi dan peringkat penjualan seluruh cabang kemarin?' },
                    { label: '💰 Utang PO & OPEX', pesan: 'Berapa total pengeluaran OPEX hari ini dan rincian utang PO supplier?' },
                    { label: '🥬 Waste & Void POS', pesan: 'Analisis laporan waste bahan baku tertinggi dan cek transaksi void hari ini.' },
                    { label: '👥 Presensi & Telat', pesan: 'Siapa saja kru outlet yang terlambat atau izin/cuti hari ini?' },
                    { label: '📨 Kirim ke Telegram', pesan: 'Kirim laporan daily ke Telegram' },
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void eksekusiPerintahJarvis(chip.pesan, false)}
                      className="px-2 py-0.5 rounded bg-cyan-950/50 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/25 hover:border-cyan-400 font-mono-hud text-[9px] transition-all cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Input Command Form inside Chat Box */}
                <form
                  onSubmit={handleSubmitForm}
                  className="relative flex items-center rounded-xl bg-zinc-950/95 border border-cyan-500/45 shadow-[0_0_16px_rgba(6,182,212,0.15)] focus-within:border-cyan-400 focus-within:shadow-[0_0_24px_rgba(6,182,212,0.3)] transition-all p-1"
                >
                  <div className="pl-2.5 pr-1.5 text-cyan-400 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                  </div>

                  <input
                    type="text"
                    value={inputPerintah}
                    onChange={(e) => setInputPerintah(e.target.value)}
                    placeholder={
                      sedangMendengar
                        ? '🎙️ Mendengarkan Anda... (otomatis terkirim)'
                        : "Ketik pertanyaan/instruksi atau klik VOICE..."
                    }
                    className="w-full bg-transparent font-mono-hud text-xs text-cyan-100 placeholder-cyan-400/45 py-1.5 focus:outline-none"
                  />

                  {voiceDidukung && (
                    <button
                      type="button"
                      onClick={handleToggleVoiceLoop}
                      className={`p-1.5 sm:px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer mr-1 flex items-center gap-1 shrink-0 ${
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
                      <span className="hidden xl:inline text-[9px] font-mono-hud font-bold">
                        {sedangMendengar ? 'LISTENING' : voiceLoopAktif ? 'LOOP: ON' : 'VOICE'}
                      </span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={sedangMemproses || !inputPerintah.trim()}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-hud text-[10px] tracking-wider font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>KIRIM</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Center Column: FULL-SIZE ARC REACTOR CORE (Tidak pernah mengecil!) */}
          <div className="order-first lg:order-none w-full lg:col-span-4 xl:col-span-4 flex flex-col items-center justify-center h-full min-h-0 py-1 relative">
            <ArcReactor
              status={statusCore}
              compact={false}
              voiceLoopAktif={voiceLoopAktif}
              spektrumSuara={spektrumSuara}
              transkripLive={transkripLive}
              onClickCore={handleToggleVoiceLoop}
              onBukaDailyBriefing={() => bukaModalDailyBriefing(true)}
              onBukaChatLengkap={() => {
                setPesanAwalDrawer(null)
                setTampilChatDrawer(true)
              }}
            />
          </div>

          {/* Right Column: ALL 4 DIVISION TELEMETRY BOXES (Full Width di kolom kanan, 2x2 grid di layar ultra-lebar) */}
          <div className="w-full lg:col-span-4 xl:col-span-4 grid grid-cols-1 2xl:grid-cols-2 gap-2.5 sm:gap-3 content-start h-full max-h-[86vh] overflow-y-auto overflow-x-hidden px-1.5 py-1">
            <AgentNodeCard
              profilFallback="ceo"
              meja={getMejaByProfil('ceo')}
              telemetri={dailyData?.telemetri}
              terpilih={divisiSorot === 'ceo'}
              onPilih={(_p, q) =>
                void eksekusiPerintahJarvis(
                  q || 'Tampilkan peringkat omzet seluruh cabang hari ini beserta menu terlaris.',
                  false
                )
              }
            />

            <AgentNodeCard
              profilFallback="finance"
              meja={getMejaByProfil('finance')}
              telemetri={dailyData?.telemetri}
              terpilih={divisiSorot === 'finance'}
              onPilih={(_p, q) =>
                void eksekusiPerintahJarvis(
                  q || 'Rincikan pengeluaran OPEX hari ini, setoran kas, dan utang PO supplier.',
                  false
                )
              }
            />

            <AgentNodeCard
              profilFallback="gudang"
              meja={getMejaByProfil('gudang')}
              telemetri={dailyData?.telemetri}
              terpilih={divisiSorot === 'gudang'}
              onPilih={(_p, q) =>
                void eksekusiPerintahJarvis(
                  q || 'Analisis laporan waste bahan baku tertinggi, status buka cabang, dan void kasir hari ini.',
                  false
                )
              }
            />

            <AgentNodeCard
              profilFallback="hrd"
              meja={getMejaByProfil('hrd')}
              telemetri={dailyData?.telemetri}
              terpilih={divisiSorot === 'hrd'}
              onPilih={(_p, q) =>
                void eksekusiPerintahJarvis(
                  q || 'Siapa saja kru outlet yang terlambat atau izin hari ini, dan bagaimana rating Google Review?',
                  false
                )
              }
            />
          </div>
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

      {/* SIDE CHAT DRAWER (Sinkron dengan Memori Percakapan J.A.R.V.I.S. Tunggal) */}
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
