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
import ArcReactor, { type StatusArcReactor, type AnomaliItem } from '@/components/jarvis/ArcReactor'
import HologramHead3D from '@/components/jarvis/HologramHead3D'
import AgentNodeCard from '@/components/jarvis/AgentNodeCard'
import { FormatIsiHologram } from '@/components/jarvis/JarvisChatDrawer'
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
  Bot,
  Cpu,
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
  CheckCircle2,
  Activity,
  Zap,
  Calendar,
  DollarSign,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Move,
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
  const [spektrumSuara, setSpektrumSuara] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0])
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
  const [modeAvatar, setModeAvatar] = useState<'hologram' | 'reactor'>('hologram')
  const [tampilDailyBriefing, setTampilDailyBriefing] = useState(false)
  // Tactical Panel Visibility & Layout States
  // Box Tactical Anomaly sekarang mengintegrasikan Tab Radar Anomali & Tab Chatbox Conversation langsung
  const [radarAnomaliTerbuka, setRadarAnomaliTerbuka] = useState(true)
  const [tacticalTab, setTacticalTab] = useState<'radar' | 'chat'>('radar')
  const [leftWingMinimized, setLeftWingMinimized] = useState(false)
  const [rightWingMinimized, setRightWingMinimized] = useState(false)
  const [modeMukaDoang, setModeMukaDoang] = useState(false)

  // Floating Chatbox States for Full Screen (Mode Muka Doang)
  const [floatingChatTerbuka, setFloatingChatTerbuka] = useState(false)
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>({ x: 24, y: 76 })
  const floatingPosRef = useRef<{ x: number; y: number }>({ x: 24, y: 76 })
  const isDraggingFloatingRef = useRef(false)
  const floatingCardRef = useRef<HTMLDivElement>(null)
  const floatingChatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    floatingPosRef.current = floatingPos
  }, [floatingPos])

  const handlePointerDownFloating = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) return

    e.preventDefault()
    isDraggingFloatingRef.current = true

    const card = floatingCardRef.current
    if (card) {
      card.style.transition = 'none'
      card.style.willChange = 'transform'
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    const startClientX = e.clientX
    const startClientY = e.clientY
    const startPosX = floatingPosRef.current.x
    const startPosY = floatingPosRef.current.y
    let latestX = startPosX
    let latestY = startPosY
    let rafId: number | null = null

    const onPointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingFloatingRef.current) return

      const deltaX = moveEvt.clientX - startClientX
      const deltaY = moveEvt.clientY - startClientY

      const cardWidth = card?.offsetWidth || 420
      const cardHeight = card?.offsetHeight || 480
      const maxX = Math.max(12, window.innerWidth - cardWidth - 12)
      const maxY = Math.max(12, window.innerHeight - cardHeight - 12)

      latestX = Math.min(Math.max(12, startPosX + deltaX), maxX)
      latestY = Math.min(Math.max(12, startPosY + deltaY), maxY)

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (card) {
            card.style.transform = `translate3d(${latestX}px, ${latestY}px, 0)`
          }
          rafId = null
        })
      }
    }

    const onPointerUp = () => {
      isDraggingFloatingRef.current = false
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      if (card) {
        card.style.willChange = 'auto'
      }
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      floatingPosRef.current = { x: latestX, y: latestY }
      setFloatingPos({ x: latestX, y: latestY })
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { once: true })
  }

  // Handler untuk membuka Chatbox Khusus Percakapan langsung di dalam Box Tactical Anomaly
  const handleTindakLanjutAnomaly = (item: AnomaliItem) => {
    const prompt =
      item.perintahTindakLanjut ||
      `Investigasi anomali [${item.divisi}] ${item.judul} dan berikan rekomendasi penanganan taktis.`
    mainkanSuaraHud('engage')
    setRadarAnomaliTerbuka(true)
    setTacticalTab('chat')
    void eksekusiPerintahJarvis(prompt, false)
  }

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

  useEffect(() => {
    if (modeMukaDoang && floatingChatTerbuka) {
      floatingChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [riwayatHologram, sedangMemproses, modeMukaDoang, floatingChatTerbuka])

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
        if (modeMukaDoang) {
          setModeMukaDoang(false)
          return
        }
        if (radarAnomaliTerbuka) {
          setRadarAnomaliTerbuka(false)
          return
        }
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
          bicaraJarvis(
            narasi,
            () => {
              setSedangBicara(false)
              if (voiceLoopRef.current) {
                setTimeout(() => mulaiSesiDengar(true), 350)
              }
            },
            {
              gunakanTeksPenuh: true,
              onMulai: () => setSedangBicara(true),
            }
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
    setRadarAnomaliTerbuka(true)
    setTacticalTab('chat')
    setFloatingChatTerbuka(true)
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
          bicaraJarvis(
            pesanOk,
            () => {
              setSedangBicara(false)
              if (voiceLoopRef.current) setTimeout(() => mulaiSesiDengar(true), 350)
            },
            {
              gunakanTeksPenuh: true,
              onMulai: () => setSedangBicara(true),
            }
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
        bicaraJarvis(
          terkumpul,
          () => {
            setSedangBicara(false)
            if (voiceLoopRef.current) {
              setTimeout(() => {
                if (voiceLoopRef.current) {
                  mulaiSesiDengar(true)
                }
              }, 350)
            }
          },
          {
            onMulai: () => setSedangBicara(true),
          }
        )
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
                  bicaraJarvis(sapaanTes, () => setSedangBicara(false), {
                    gunakanTeksPenuh: true,
                    voiceId: idBaru,
                    onMulai: () => setSedangBicara(true),
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

            {/* Dedicated Chatbox Toggle */}
            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('chirp')
                if (modeMukaDoang) {
                  setFloatingChatTerbuka((prev) => !prev)
                } else {
                  setRadarAnomaliTerbuka(true)
                  setTacticalTab('chat')
                }
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border font-mono-hud text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                (modeMukaDoang ? floatingChatTerbuka : tacticalTab === 'chat' && radarAnomaliTerbuka)
                  ? 'bg-cyan-900/80 border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-zinc-900/80 border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
              }`}
              title="Buka Chatbox Percakapan"
              aria-label="Buka Chatbox Percakapan"
            >
              <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden sm:inline font-hud font-bold text-[11px] tracking-wider">CHATBOX</span>
              {riwayatHologram.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
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
      <main className="relative z-20 flex-1 min-h-0 w-full px-2 sm:px-3 lg:px-4 py-1.5 flex flex-col justify-between overflow-hidden">
        {/* TACTICAL 3-COLUMN HUD GRID: Left = Ops & HRD, Center = Hero Command Core, Right = Sales & Finance */}
        <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-2.5 lg:gap-3 items-stretch overflow-hidden">
          
          {/* Left Wing (OPERASIONAL & KRU: DIV-03 Ops & DIV-04 HRD) */}
          {!modeMukaDoang && (
            leftWingMinimized ? (
              /* Left Wing Minimized Strip */
              <div
                onClick={() => {
                  mainkanSuaraHud('chirp')
                  setLeftWingMinimized(false)
                }}
                className="hidden lg:flex flex-col items-center justify-between py-3 px-1.5 rounded-xl bg-zinc-950/85 border border-cyan-500/30 hover:border-cyan-400 cursor-pointer transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] group shrink-0 w-11 h-full select-none"
                title="Klik untuk membuka Radar Operasional & Kru"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className="font-hud text-[10px] tracking-widest text-cyan-300 font-bold uppercase [writing-mode:vertical-rl] rotate-180 py-2">
                  RADAR OPS &amp; KRU
                </span>
                <div className="flex flex-col items-center gap-1">
                  <span className="px-1 py-0.5 rounded text-[8px] font-mono-hud font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    OPS
                  </span>
                  <span className="px-1 py-0.5 rounded text-[8px] font-mono-hud font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    HRD
                  </span>
                </div>
              </div>
            ) : (
              /* Left Wing Expanded Full Cards */
              <div className="w-full lg:w-[28%] lg:max-w-[340px] xl:max-w-[370px] shrink-0 flex flex-col gap-2 h-full min-h-0">
                {/* Radar Header */}
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-cyan-500/35 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="font-hud text-xs tracking-widest uppercase text-cyan-300 font-bold truncate">
                      RADAR OPERASIONAL &amp; KRU
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono-hud text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-semibold">
                      OPS &bull; HRD
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        mainkanSuaraHud('chirp')
                        setLeftWingMinimized(true)
                      }}
                      className="p-1 rounded hover:bg-cyan-950/80 text-zinc-400 hover:text-cyan-200 border border-transparent hover:border-cyan-500/30 transition-colors cursor-pointer hidden lg:flex items-center justify-center"
                      title="Minimize Radar Operasional & Kru"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
            )
          )}

          {/* Center Stage: THE HERO COMMAND CORE (Majestic Arc Reactor / 3D Hologram Robot Head) */}
          <div
            className={`flex-1 min-w-0 w-full flex flex-col ${
              modeMukaDoang
                ? 'justify-center'
                : !radarAnomaliTerbuka
                  ? 'justify-between'
                  : 'justify-start'
            } items-center h-full min-h-0 relative px-1 py-0.5 gap-2`}
          >
            {/* Top / Center: The Majestic Hologram / Arc Reactor Avatar */}
            <div
              className={`flex flex-col items-center justify-center relative w-full ${
                modeMukaDoang || !radarAnomaliTerbuka
                  ? 'flex-1 h-full min-h-0'
                  : 'shrink-0'
              }`}
            >
              {/* Avatar Mode Switcher: 3D Hologram Robot Head vs Arc Reactor & Muka Doang Mode Toggle */}
              <div className="flex items-center justify-center mb-1 z-20 gap-2">
                <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950/85 border border-cyan-500/30 backdrop-blur-md shadow-sm gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      mainkanSuaraHud('chirp')
                      setModeAvatar('hologram')
                    }}
                    aria-label="Pilih Avatar Hologram 3D"
                    className={`px-2.5 py-1 min-h-[32px] rounded-md font-hud text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
                      modeAvatar === 'hologram'
                        ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
                    }`}
                    title="Wajah Robot Hologram 3D (Bisa Muter & Bicara)"
                  >
                    <Bot className="w-3.5 h-3.5 text-cyan-300" />
                    <span>3D HEAD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      mainkanSuaraHud('chirp')
                      setModeAvatar('reactor')
                    }}
                    aria-label="Pilih Avatar Arc Reactor"
                    className={`px-2.5 py-1 min-h-[32px] rounded-md font-hud text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
                      modeAvatar === 'reactor'
                        ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
                    }`}
                    title="Arc Reactor Core Asli Iron Man"
                  >
                    <Cpu className="w-3.5 h-3.5 text-cyan-300" />
                    <span>ARC REACTOR</span>
                  </button>
                </div>

                {/* Mode Full Screen / Focus Avatar Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    mainkanSuaraHud('engage')
                    const next = !modeMukaDoang
                    setModeMukaDoang(next)
                    if (next) {
                      setFloatingChatTerbuka(false)
                    }
                  }}
                  aria-label={modeMukaDoang ? 'Kembalikan Dashboard Lengkap' : 'Aktifkan Mode Full Screen'}
                  className={`px-2.5 py-1 min-h-[32px] rounded-lg font-hud text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1.5 backdrop-blur-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
                    modeMukaDoang
                      ? 'bg-cyan-500/35 text-white border border-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.6)] animate-pulse'
                      : 'bg-zinc-950/85 text-zinc-400 hover:text-cyan-200 border border-cyan-500/30'
                  }`}
                  title={modeMukaDoang ? 'Kembalikan Dashboard Lengkap (ESC)' : 'Mode Full Screen (Fokus Penuh Avatar Besar)'}
                >
                  {modeMukaDoang ? (
                    <Minimize2 className="w-3.5 h-3.5 text-cyan-300" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />
                  )}
                  <span>{modeMukaDoang ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}</span>
                </button>
              </div>

              {modeAvatar === 'hologram' ? (
                <HologramHead3D
                  status={statusCore}
                  compact={false}
                  sizeMode={
                    modeMukaDoang
                      ? 'muka-doang'
                      : !radarAnomaliTerbuka
                        ? 'large'
                        : 'normal'
                  }
                  isMukaDoang={modeMukaDoang}
                  onToggleMukaDoang={() => {
                    mainkanSuaraHud('engage')
                    setModeMukaDoang((prev) => {
                      const next = !prev
                      if (next) setFloatingChatTerbuka(false)
                      return next
                    })
                  }}
                  voiceLoopAktif={voiceLoopAktif}
                  spektrumSuara={spektrumSuara}
                  transkripLive={transkripLive}
                  anomaliItems={dailyData?.actionItems?.filter((a) => a.level === 'critical' || a.level === 'warning')}
                  onClickCore={handleToggleVoiceLoop}
                  onPilihAnomali={(item) => handleTindakLanjutAnomaly(item)}
                  onBukaDailyBriefing={() => bukaModalDailyBriefing(true)}
                  onBukaChatLengkap={() => {
                    mainkanSuaraHud('chirp')
                    if (modeMukaDoang) {
                      setFloatingChatTerbuka(true)
                    } else {
                      setRadarAnomaliTerbuka(true)
                      setTacticalTab('chat')
                    }
                  }}
                />
              ) : (
                <ArcReactor
                  status={statusCore}
                  compact={false}
                  sizeMode={
                    modeMukaDoang
                      ? 'muka-doang'
                      : !radarAnomaliTerbuka
                        ? 'large'
                        : 'normal'
                  }
                  isMukaDoang={modeMukaDoang}
                  onToggleMukaDoang={() => {
                    mainkanSuaraHud('engage')
                    setModeMukaDoang((prev) => {
                      const next = !prev
                      if (next) setFloatingChatTerbuka(false)
                      return next
                    })
                  }}
                  voiceLoopAktif={voiceLoopAktif}
                  spektrumSuara={spektrumSuara}
                  transkripLive={transkripLive}
                  anomaliItems={dailyData?.actionItems?.filter((a) => a.level === 'critical' || a.level === 'warning')}
                  onClickCore={handleToggleVoiceLoop}
                  onPilihAnomali={(item) => handleTindakLanjutAnomaly(item)}
                  onBukaDailyBriefing={() => bukaModalDailyBriefing(true)}
                  onBukaChatLengkap={() => {
                    mainkanSuaraHud('chirp')
                    if (modeMukaDoang) {
                      setFloatingChatTerbuka(true)
                    } else {
                      setRadarAnomaliTerbuka(true)
                      setTacticalTab('chat')
                    }
                  }}
                />
              )}
            </div>

            {/* Middle: Floating Holographic Transmission Feed OR Standby Aura OR Anomaly Radar */}
            {modeMukaDoang ? (
              <>
                {/* Floating Draggable Chatbox in Full Screen Mode */}
                {floatingChatTerbuka ? (
                  <div
                    ref={floatingCardRef}
                    style={{
                      transform: `translate3d(${floatingPos.x}px, ${floatingPos.y}px, 0)`,
                    }}
                    className="fixed top-0 left-0 z-40 w-[360px] sm:w-[420px] md:w-[460px] max-w-[94vw] h-[55vh] max-h-[520px] min-h-[300px] rounded-2xl bg-zinc-950/90 border border-cyan-400/40 shadow-[0_0_30px_rgba(6,182,212,0.25)] backdrop-blur-xl flex flex-col overflow-hidden select-none"
                  >
                    {/* Reticles di 4 Sudut Card */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                    {/* Draggable Header */}
                    <div
                      onPointerDown={handlePointerDownFloating}
                      style={{ touchAction: 'none' }}
                      className="flex items-center justify-between px-3 py-2 bg-cyan-950/75 border-b border-cyan-500/25 cursor-grab active:cursor-grabbing select-none text-xs font-mono-hud shrink-0"
                      title="Klik dan tahan untuk menggeser (drag) chatbox kemana saja"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                        <span className="font-hud font-bold uppercase tracking-wider text-cyan-100 truncate text-[11px]">
                          HOLOGRAPHIC CHAT // LIVE
                        </span>
                        {riwayatHologram.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/25 text-cyan-200 text-[10px] font-mono-hud font-bold border border-cyan-400/40 shrink-0">
                            {riwayatHologram.length}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {jawabanHologram && (
                          <button
                            type="button"
                            onClick={() => {
                              if (sedangBicara) {
                                hentiBicaraJarvis()
                                setSedangBicara(false)
                              } else {
                                bicaraJarvis(jawabanHologram, () => setSedangBicara(false), {
                                  onMulai: () => setSedangBicara(true),
                                })
                              }
                            }}
                            className="px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 flex items-center gap-1 text-[10px] cursor-pointer"
                            title={sedangBicara ? 'Hentikan Suara' : 'Dengarkan Jawaban'}
                          >
                            {sedangBicara ? (
                              <>
                                <VolumeX className="w-2.5 h-2.5 text-red-400" />
                                <span className="text-red-300 font-bold">STOP</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-2.5 h-2.5 text-cyan-300" />
                                <span>SPEAK</span>
                              </>
                            )}
                          </button>
                        )}

                        {riwayatHologram.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              hentiBicaraJarvis()
                              setSedangBicara(false)
                              setJawabanHologram('')
                              setRiwayatHologram([])
                              setDivisiSorot(null)
                              mainkanSuaraHud('chirp')
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-red-300 hover:bg-red-950/30 cursor-pointer transition-colors"
                            title="Bersihkan Semua Pesan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            mainkanSuaraHud('chirp')
                            setFloatingChatTerbuka(false)
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-cyan-200 hover:bg-cyan-950/60 cursor-pointer transition-colors"
                          title="Sembunyikan Chat (Riwayat Tetap Tersimpan)"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Continuous Chat Message Stream */}
                    <div className="p-3 overflow-y-auto flex-1 min-h-0 space-y-3 font-mono-hud text-xs no-scrollbar select-text">
                      {riwayatHologram.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-6 text-center space-y-2 font-mono-hud text-zinc-400">
                          <div className="p-3 rounded-full bg-cyan-950/50 border border-cyan-400/30 text-cyan-300">
                            <MessageSquare className="w-5 h-5 animate-pulse" />
                          </div>
                          <span className="font-hud font-bold text-xs text-cyan-200">
                            HOLOGRAPHIC CHAT ACTIVE
                          </span>
                          <p className="text-[11px] max-w-xs text-zinc-400 leading-relaxed">
                            Ketik instruksi di bar bawah atau bicara langsung. Respons Jarvis akan mengalir kontinu di panel ini.
                          </p>
                        </div>
                      ) : (
                        riwayatHologram.map((item) => (
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
                                <div className="grid grid-cols-2 gap-1 mb-1 text-[10px]">
                                  {['CEO & Owner', 'Finance & Treasury', 'Gudang & Ops', 'HRD & Personalia', 'SukaReview & CS'].map((div, dIdx) => (
                                    <div key={dIdx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 border border-emerald-500/30 text-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                      <span className="truncate">{div}</span>
                                    </div>
                                  ))}
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
                        ))
                      )}

                      {sedangMemproses && (
                        <div className="flex items-center gap-2 text-cyan-300 font-mono-hud text-xs py-2 px-3 rounded-lg bg-cyan-950/50 border border-cyan-500/30 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                          <span>J.A.R.V.I.S. SEDANG MENGANALISIS TELEMETRI...</span>
                        </div>
                      )}
                      <div ref={floatingChatBottomRef} />
                    </div>

                    {/* Footer Drag Tip */}
                    <div className="px-3 py-1 bg-black/70 border-t border-cyan-500/20 flex items-center justify-between text-[10px] font-mono-hud text-cyan-400/70 shrink-0 select-none">
                      <span className="flex items-center gap-1">
                        <Move className="w-3 h-3 text-cyan-400/70" />
                        <span>DRAG HEADER UNTUK GESER</span>
                      </span>
                      <span>CONTINUOUS CHAT // ACTIVE</span>
                    </div>
                  </div>
                ) : riwayatHologram.length > 0 ? (
                  /* Minimized Floating Pill when closed and there is chat history */
                  <button
                    type="button"
                    onClick={() => {
                      mainkanSuaraHud('chirp')
                      setFloatingChatTerbuka(true)
                    }}
                    className="fixed left-4 top-20 z-40 px-3 py-2 rounded-xl bg-zinc-950/90 border border-cyan-400/60 text-cyan-200 font-hud text-xs font-bold shadow-[0_0_20px_rgba(6,182,212,0.35)] backdrop-blur-md flex items-center gap-2 hover:bg-cyan-900/60 hover:text-white transition-all cursor-pointer animate-in fade-in"
                    title="Buka Floating Chatbox"
                  >
                    <MessageSquare className="w-4 h-4 text-cyan-300" />
                    <span>CHATBOX</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-300 text-[10px] font-mono-hud font-bold border border-cyan-400/40">
                      {riwayatHologram.length}
                    </span>
                  </button>
                ) : null}
              </>
            ) : !radarAnomaliTerbuka ? (
              /* Standby Collapsed Status Bar */
              <div
                onClick={() => {
                  mainkanSuaraHud('chirp')
                  setRadarAnomaliTerbuka(true)
                }}
                className="w-full shrink-0 mt-auto rounded-xl bg-zinc-950/85 border border-cyan-500/35 hover:border-cyan-400 backdrop-blur-xl shadow-[0_0_20px_rgba(6,182,212,0.15)] p-2 sm:px-3 sm:py-2 flex items-center justify-between gap-2.5 cursor-pointer transition-all group my-0.5 select-none"
                title="Klik untuk membuka rincian Tactical Anomaly Radar atau Chatbox"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${adaAnomaliKritis ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                  <span className="font-hud text-xs text-cyan-200 font-bold uppercase tracking-wider truncate">
                    {adaAnomaliKritis
                      ? `TACTICAL ANOMALY RADAR // ${dailyData?.actionItems?.length || 0} ISSUES LOGGED`
                      : 'HERMES NEURAL OPERATIONS MATRIX // OPTIMAL'}
                  </span>
                  <span className="hidden sm:inline font-mono-hud text-[10px] text-zinc-400 truncate">
                    &bull; Klik untuk membuka radar isu atau chatbox
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      mainkanSuaraHud('chirp')
                      setRadarAnomaliTerbuka(true)
                      setTacticalTab('radar')
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-hud text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                      tacticalTab === 'radar'
                        ? 'bg-cyan-900/90 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                        : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-400/40 text-cyan-300'
                    }`}
                  >
                    <span>BUKA RADAR</span>
                    <ChevronUp className="w-3 h-3 text-cyan-300" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      mainkanSuaraHud('chirp')
                      setRadarAnomaliTerbuka(true)
                      setTacticalTab('chat')
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-hud text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)] ${
                      tacticalTab === 'chat'
                        ? 'bg-cyan-900/90 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                        : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-400/40 text-cyan-200'
                    }`}
                    title="Buka Chatbox Percakapan di Box Ini"
                  >
                    <MessageSquare className="w-3 h-3 text-cyan-300" />
                    <span>CHATBOX</span>
                    {riwayatHologram.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      bukaModalDailyBriefing(true)
                    }}
                    className="px-2 py-1 rounded-lg bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 text-[10px] font-hud flex items-center gap-1 cursor-pointer transition-colors"
                    title="Buka Laporan Daily Komprehensif"
                  >
                    <FileBarChart2 className="w-3 h-3 text-cyan-300" />
                    <span className="hidden sm:inline">BRIEFING</span>
                  </button>
                </div>
              </div>
            ) : (
              /* UNIFIED TACTICAL DECK: ANOMALY RADAR + INTEGRATED CHATBOX (IN-BOX) */
              <div className="w-full flex-1 min-h-[160px] rounded-2xl bg-zinc-950/85 border border-cyan-500/30 backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.12)] flex flex-col overflow-hidden my-0.5 animate-in fade-in duration-200 relative">
                {/* Hologram Reticles */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                {/* Deck Header with Dual Tabs: Radar Anomali vs Chatbox Conversation */}
                <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 bg-cyan-950/60 border-b border-cyan-500/20 font-mono-hud text-xs shrink-0">
                  {/* Left Tabs */}
                  <div className="flex items-center gap-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        mainkanSuaraHud('chirp')
                        setTacticalTab('radar')
                      }}
                      className={`px-2.5 py-1 rounded-lg font-hud text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                        tacticalTab === 'radar'
                          ? 'bg-cyan-900/80 border border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                          : 'text-zinc-400 hover:text-cyan-300 hover:bg-zinc-900/60 border border-transparent'
                      }`}
                      title="Lihat Daftar Isu Tactical Anomaly Radar"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${adaAnomaliKritis ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                      <span className="truncate">
                        RADAR ANOMALI // {dailyData?.actionItems?.length || 0} ISSUES
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        mainkanSuaraHud('chirp')
                        setTacticalTab('chat')
                      }}
                      className={`px-2.5 py-1 rounded-lg font-hud text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                        tacticalTab === 'chat'
                          ? 'bg-cyan-900/80 border border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                          : 'text-zinc-400 hover:text-cyan-300 hover:bg-zinc-900/60 border border-transparent'
                      }`}
                      title="Buka Chatbox Percakapan di Box Ini"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                      <span>CHATBOX CONVERSATION</span>
                      {riwayatHologram.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/25 text-cyan-200 text-[10px] font-mono-hud font-bold border border-cyan-400/40">
                          {riwayatHologram.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Right Header Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {tacticalTab === 'chat' && jawabanHologram && (
                      <button
                        type="button"
                        onClick={() => {
                          if (sedangBicara) {
                            hentiBicaraJarvis()
                            setSedangBicara(false)
                          } else {
                            bicaraJarvis(jawabanHologram, () => setSedangBicara(false), {
                              onMulai: () => setSedangBicara(true),
                            })
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 flex items-center gap-1 text-[11px] cursor-pointer"
                        title={sedangBicara ? 'Hentikan Suara' : 'Dengarkan Jawaban'}
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

                    {tacticalTab === 'chat' && riwayatHologram.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          hentiBicaraJarvis()
                          setSedangBicara(false)
                          setJawabanHologram('')
                          setRiwayatHologram([])
                          setDivisiSorot(null)
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-red-300 hover:bg-red-950/30 cursor-pointer transition-colors"
                        title="Bersihkan Percakapan Chatbox"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}

                    {tacticalTab === 'radar' && (
                      <button
                        type="button"
                        onClick={() => bukaModalDailyBriefing(true)}
                        aria-label="Buka Laporan Daily Komprehensif"
                        className="px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-400/30 text-cyan-200 text-[11px] flex items-center gap-1 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                        title="Buka Laporan Daily Komprehensif"
                      >
                        <FileBarChart2 className="w-3 h-3 text-cyan-300" />
                        <span>BRIEFING</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        mainkanSuaraHud('chirp')
                        setRadarAnomaliTerbuka(false)
                      }}
                      aria-label="Minimize Box"
                      className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-cyan-950 border border-cyan-400/40 text-cyan-300 text-[11px] font-hud flex items-center gap-1 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                      title="Tutup / Minimize Box (Wajah Robot Membesar)"
                    >
                      <ChevronDown className="w-3 h-3 text-cyan-300" />
                      <span>MINIMIZE</span>
                    </button>
                  </div>
                </div>

                {/* Content Stream: Tab RADAR vs Tab CHATBOX */}
                {tacticalTab === 'radar' ? (
                  /* TAB 1: RADAR ANOMALI CARDS */
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
                              onClick={() => handleTindakLanjutAnomaly(item)}
                              className={`px-2.5 py-1 rounded-lg border font-hud text-[10px] tracking-wider uppercase font-bold shrink-0 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                isCritical
                                  ? 'bg-red-900/70 hover:bg-red-800 border-red-400/50 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                                  : 'bg-amber-900/70 hover:bg-amber-800 border-amber-400/50 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                              }`}
                              title="Buka Chatbox & Investigasi Anomali Ini"
                            >
                              <MessageSquare className="w-3 h-3" />
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
                ) : (
                  /* TAB 2: CHATBOX CONVERSATION STREAM */
                  <div className="p-3 overflow-y-auto flex-1 min-h-0 space-y-3 no-scrollbar">
                    {riwayatHologram.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center py-4 px-2 text-center space-y-3 font-mono-hud animate-in fade-in duration-200">
                        {/* Title Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-400/40 text-cyan-200 shadow-[0_0_18px_rgba(6,182,212,0.2)]">
                          <MessageSquare className="w-4 h-4 text-cyan-400 animate-pulse" />
                          <span className="font-hud tracking-wider uppercase font-bold text-xs text-glow-cyan">
                            J.A.R.V.I.S. INTERACTIVE CHAT &amp; DIRECTIVE CORE
                          </span>
                        </div>

                        {/* Clear Bilingual / Tactical Instructions */}
                        <div className="max-w-lg space-y-1">
                          <p className="text-xs text-zinc-100 font-semibold leading-relaxed">
                            Pusat dialog dua arah, analisis operasional, &amp; konsultasi bisnis Suka Shawarma.
                          </p>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Anda bisa <strong className="text-cyan-300">chat &amp; bertanya apa saja</strong> (penjualan, keuangan, HRD, stok, closing shift) atau <strong className="text-cyan-300">menindaklanjuti isu anomali</strong> dari tab Radar.
                          </p>
                        </div>

                        {/* Quick Conversation Starter Chips */}
                        <div className="w-full max-w-lg pt-1">
                          <div className="text-[10px] text-cyan-400/80 font-bold uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            <span>Contoh Topik Percakapan Cepat:</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-left">
                            {[
                              {
                                label: 'Evaluasi Closing Kemarin',
                                desc: 'Rekap performa omzet & profit H-1',
                                prompt: 'Buat laporan evaluasi komprehensif kemarin (H-1) dari semua aplikasi lengkap dengan analisis performa dan rekomendasi taktis.',
                              },
                              {
                                label: 'Keuangan & Kas Fisik',
                                desc: 'OPEX, kasir closing, & selisih kas',
                                prompt: 'Rincikan pengeluaran OPEX kemarin, kas fisik tutup shift kemarin, selisih kasir, dan utang PO supplier.',
                              },
                              {
                                label: 'Operasional & Waste',
                                desc: 'Bahan baku kritis & void kasir',
                                prompt: 'Analisis laporan waste bahan baku tertinggi dan cek transaksi void kasir kemarin.',
                              },
                              {
                                label: 'HRD & Google Review',
                                desc: 'Presensi kru outlet & rating CS',
                                prompt: 'Siapa saja kru outlet yang terlambat atau izin kemarin, dan bagaimana rating Google Review?',
                              },
                            ].map((topic, tIdx) => (
                              <button
                                key={tIdx}
                                type="button"
                                onClick={() => void eksekusiPerintahJarvis(topic.prompt, false)}
                                className="p-2 rounded-xl bg-zinc-900/80 hover:bg-cyan-950/70 border border-cyan-500/25 hover:border-cyan-400 transition-all text-left group cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                              >
                                <div className="text-[11px] font-bold text-cyan-200 group-hover:text-cyan-100 flex items-center justify-between">
                                  <span>{topic.label}</span>
                                  <span className="text-[10px] text-cyan-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                                </div>
                                <div className="text-[10px] text-zinc-400 line-clamp-1">{topic.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons: Switch to Radar */}
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              mainkanSuaraHud('chirp')
                              setTacticalTab('radar')
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/50 text-cyan-200 text-xs font-hud font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 text-cyan-300" />
                            <span>LIHAT RADAR ANOMALI ({dailyData?.actionItems?.length || 0} ISSUES)</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      riwayatHologram.map((item) => (
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
                      ))
                    )}
                    {sedangMemproses && (
                      <div className="flex items-center gap-2 text-cyan-300 font-mono-hud text-xs py-2 px-3 rounded-lg bg-cyan-950/50 border border-cyan-500/30 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>J.A.R.V.I.S. SEDANG MENGANALISIS TELEMETRI DATABASE...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}

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

          {/* Right Wing (SALES & TREASURY: DIV-01 Sales & DIV-02 Finance) */}
          {!modeMukaDoang && (
            rightWingMinimized ? (
              /* Right Wing Minimized Strip */
              <div
                onClick={() => {
                  mainkanSuaraHud('chirp')
                  setRightWingMinimized(false)
                }}
                className="hidden lg:flex flex-col items-center justify-between py-3 px-1.5 rounded-xl bg-zinc-950/85 border border-cyan-500/30 hover:border-cyan-400 cursor-pointer transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] group shrink-0 w-11 h-full select-none"
                title="Klik untuk membuka Radar Sales & Finance"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <ChevronLeft className="w-3.5 h-3.5 text-cyan-300 group-hover:-translate-x-0.5 transition-transform" />
                </div>
                <span className="font-hud text-[10px] tracking-widest text-cyan-300 font-bold uppercase [writing-mode:vertical-rl] rotate-180 py-2">
                  RADAR SALES &amp; FIN
                </span>
                <div className="flex flex-col items-center gap-1">
                  <span className="px-1 py-0.5 rounded text-[8px] font-mono-hud font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    POS
                  </span>
                  <span className="px-1 py-0.5 rounded text-[8px] font-mono-hud font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    FIN
                  </span>
                </div>
              </div>
            ) : (
              /* Right Wing Expanded Full Cards */
              <div className="w-full lg:w-[28%] lg:max-w-[340px] xl:max-w-[370px] shrink-0 flex flex-col gap-2 h-full min-h-0">
                {/* Radar Header with Time Switch */}
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-cyan-500/35 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="font-hud text-xs tracking-widest uppercase text-cyan-300 font-bold truncate">
                      RADAR SALES &amp; FINANCE
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 bg-black/80 p-0.5 rounded-lg border border-cyan-500/25">
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

                    <button
                      type="button"
                      onClick={() => {
                        mainkanSuaraHud('chirp')
                        setRightWingMinimized(true)
                      }}
                      className="p-1 rounded hover:bg-cyan-950/80 text-zinc-400 hover:text-cyan-200 border border-transparent hover:border-cyan-500/30 transition-colors cursor-pointer hidden lg:flex items-center justify-center"
                      title="Minimize Radar Sales & Finance"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
            )
          )}
        </div>

        {/* BOTTOM COMMAND CONSOLE DOCK (Centered, Balanced Cockpit Foundation) */}
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-1.5 shrink-0 pt-1 pb-1 z-30">
          {/* Quick Directive Chips (Strict No-Emoji HUD Standard) */}
          <div className="w-full flex items-center justify-center flex-wrap gap-1.5 py-0.5">
            <button
              type="button"
              onClick={() => bukaModalDailyBriefing(true)}
              aria-label="Buka Daily Briefing Modal"
              className="px-3 py-1 min-h-[34px] rounded-lg bg-cyan-600/40 hover:bg-cyan-600/70 text-cyan-100 border border-cyan-400/60 font-mono-hud text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            >
              <Zap className="size-3 text-cyan-300 shrink-0" />
              <span>Daily Briefing</span>
            </button>
            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('chirp')
                if (modeMukaDoang) {
                  setFloatingChatTerbuka((prev) => !prev)
                } else {
                  setRadarAnomaliTerbuka(true)
                  setTacticalTab('chat')
                }
              }}
              aria-label="Buka Chatbox Percakapan"
              className={`px-3 py-1 min-h-[34px] rounded-lg border font-mono-hud text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                (modeMukaDoang ? floatingChatTerbuka : tacticalTab === 'chat' && radarAnomaliTerbuka)
                  ? 'bg-cyan-900/90 border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-200 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.18)]'
              }`}
              title="Buka Chatbox Percakapan"
            >
              <MessageSquare className="size-3 text-cyan-300 shrink-0" />
              <span>Chatbox</span>
              {riwayatHologram.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
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
                  aria-label={`Jalankan perintah cepat: ${chip.label}`}
                  className="px-3 py-1 min-h-[34px] rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 font-mono-hud text-[11px] sm:text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
              aria-label="Ketik instruksi atau pertanyaan untuk J.A.R.V.I.S."
              placeholder={
                sedangMendengar
                  ? '🎙️ Mendengarkan Anda... (otomatis terkirim)'
                  : "Ketik instruksi/pertanyaan atau tekan '/'..."
              }
              className="w-full bg-transparent font-mono-hud text-xs sm:text-sm text-cyan-100 placeholder-cyan-400/65 py-1.5 focus:outline-none"
            />

            {voiceDidukung && (
              <button
                type="button"
                onClick={handleToggleVoiceLoop}
                aria-label={
                  sedangMendengar || voiceLoopAktif
                    ? 'Hentikan atau kirim input suara'
                    : 'Mulai input suara Voice-to-Voice'
                }
                className={`p-1.5 sm:px-3 py-1.5 min-h-[34px] rounded-xl border transition-all cursor-pointer mr-1 flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
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
              aria-label="Kirim instruksi ke J.A.R.V.I.S."
              className="px-3 sm:px-4 py-1.5 min-h-[34px] rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-hud text-xs tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-1.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
    </div>
  )
}
