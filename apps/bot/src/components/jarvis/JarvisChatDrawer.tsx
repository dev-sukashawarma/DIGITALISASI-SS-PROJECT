'use client'

import { useEffect, useRef, useState } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
import { pecahTeks } from '@/lib/teks'
import type { Profil } from '@/lib/peran'
import {
  mulaiMendengar,
  hentiMendengar,
  apakahVoiceDidukung,
  bicaraJarvis,
  hentiBicaraJarvis,
} from '@/lib/voiceHud'
import {
  X,
  Send,
  History,
  Plus,
  Trash2,
  Terminal,
  Radio,
  Cpu,
  ShieldAlert,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react'

type Percakapan = { id: string; judul: string; diperbarui_at: string }
type Pesan = { id: string | number; peran: 'user' | 'bot'; isi: string }

const LABEL_AGENT: Record<Profil, { nama: string; badge: string; deskripsi: string }> = {
  ceo: { nama: 'J.A.R.V.I.S. // MASTER CORE', badge: 'EXECUTIVE INTELLIGENCE MATRIX', deskripsi: 'Pusat komando strategis, analitik penjualan, dan eksekutif AI Suka Shawarma' },
  gudang: { nama: 'JARVIS-02 // BOT GUDANG', badge: 'SUPPLY CHAIN RADAR', deskripsi: 'Analitik stok bahan baku, rantai pasok, dan deteksi bahan kritis' },
  hrd: { nama: 'JARVIS-03 // BOT HRD', badge: 'WORKFORCE TELEMETRY', deskripsi: 'Pemantauan absensi shift, roster tim cabang, dan data SDM' },
  finance: { nama: 'JARVIS-04 // BOT FINANCE', badge: 'TREASURY RECONCILIATION', deskripsi: 'Arus kas harian, rekonsiliasi OPEX, dan liabilitas supplier' },
}

const CEPAT: Record<Profil, string[]> = {
  ceo: ['Omzet kemarin berapa?', 'Peringkat outlet minggu ini', 'Menu terlaris bulan ini', 'Laporan pagi hari ini'],
  hrd: ['Siapa yang belum absen hari ini?', 'Cuti & izin minggu ini', 'Rekap keterlambatan bulan ini'],
  gudang: ['Bahan yang hampir habis', 'Kiriman hari ini'],
  finance: ['Utang supplier jatuh tempo', 'Kas kecil bulan ini'],
}

const GALAT_UMUM = 'Koneksi ke Hermes Core terputus. Pastikan gateway aktif.'

function FormatIsiHologram({ isi }: { isi: string }) {
  return (
    <div className="space-y-1.5 leading-relaxed font-mono-hud text-xs sm:text-sm">
      {pecahTeks(isi).map((baris, i) => (
        <p key={i} className="min-h-[1.2em]">
          {baris.map((s, j) =>
            s.tebal ? (
              <strong key={j} className="text-cyan-300 font-semibold">
                {s.teks}
              </strong>
            ) : (
              <span key={j} className="text-zinc-200">
                {s.teks}
              </span>
            )
          )}
        </p>
      ))}
    </div>
  )
}

interface JarvisChatDrawerProps {
  profil: Profil
  pesanAwal?: string | null
  onTutup: () => void
}

export default function JarvisChatDrawer({
  profil,
  pesanAwal,
  onTutup,
}: JarvisChatDrawerProps) {
  const [daftar, setDaftar] = useState<Percakapan[]>([])
  const [aktif, setAktif] = useState<string | null>(null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [input, setInput] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [menunggu, setMenunggu] = useState(false)
  const [riwayat, setRiwayat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [sedangMendengar, setSedangMendengar] = useState(false)
  const [voiceDidukung, setVoiceDidukung] = useState(false)
  const [sedangBicara, setSedangBicara] = useState<string | number | null>(null)
  const bawah = useRef<HTMLDivElement>(null)
  const inisialisasiRef = useRef(false)

  const meta = LABEL_AGENT[profil] || LABEL_AGENT.ceo

  useEffect(() => {
    setVoiceDidukung(apakahVoiceDidukung().stt)
    return () => {
      hentiMendengar()
      hentiBicaraJarvis()
    }
  }, [])

  const toggleBicaraPesan = (id: string | number, teks: string) => {
    if (sedangBicara === id) {
      hentiBicaraJarvis()
      setSedangBicara(null)
    } else {
      mainkanSuaraHud('chirp')
      setSedangBicara(id)
      bicaraJarvis(teks, () => setSedangBicara(null))
    }
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
          setInput(teks)
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

  const muatDaftar = async () => {
    const r = await fetch(`/api/percakapan?profil=${profil}`, { cache: 'no-store' })
    if (r.ok) setDaftar((await r.json()).percakapan)
  }

  useEffect(() => {
    void muatDaftar()
    mainkanSuaraHud('engage')
  }, [profil])

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pesan, menunggu])

  const buka = async (id: string) => {
    mainkanSuaraHud('chirp')
    setRiwayat(false)
    setGalat(null)
    setAktif(id)
    setPesan([])
    const r = await fetch(`/api/percakapan/${id}`, { cache: 'no-store' })
    if (r.ok) setPesan((await r.json()).pesan)
    else setGalat('Gagal memuat arsip transmisi.')
  }

  const baru = () => {
    mainkanSuaraHud('chirp')
    setAktif(null)
    setPesan([])
    setRiwayat(false)
    setGalat(null)
  }

  const hapus = async (id: string) => {
    if (!confirm('Hapus log transmisi ini dari memori?')) return
    mainkanSuaraHud('alert')
    await fetch(`/api/percakapan/${id}`, { method: 'DELETE' })
    if (aktif === id) baru()
    void muatDaftar()
  }

  const kirim = async (teks: string) => {
    const isi = teks.trim()
    if (!isi || sibuk) return
    mainkanSuaraHud('transmit')
    setSibuk(true)
    setMenunggu(true)
    setGalat(null)
    setInput('')
    setPesan((p) => [
      ...p,
      { id: `u${Date.now()}`, peran: 'user', isi },
      { id: `b${Date.now()}`, peran: 'bot', isi: '' },
    ])

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: isi, profil, percakapanId: aktif ?? undefined }),
      })
      if (!r.ok || !r.body) {
        const b = await r.json().catch(() => ({}))
        throw new Error(b.galat || GALAT_UMUM)
      }
      const id = r.headers.get('X-Percakapan-Id')
      if (id) setAktif(id)

      const pembaca = r.body.getReader()
      const dek = new TextDecoder()
      for (;;) {
        const { value, done } = await pembaca.read()
        if (done) break
        const t = dek.decode(value, { stream: true })
        setMenunggu(false)
        setPesan((p) => {
          const s = [...p]
          s[s.length - 1] = { ...s[s.length - 1], isi: s[s.length - 1].isi + t }
          return s
        })
      }
      mainkanSuaraHud('blip')
      void muatDaftar()
    } catch (e) {
      mainkanSuaraHud('alert')
      setPesan((p) => p.slice(0, -1))
      setGalat((e as Error).message || GALAT_UMUM)
    } finally {
      setSibuk(false)
      setMenunggu(false)
    }
  }

  // Jika ada pesan awal dari Quick Directives, langsung jalankan
  useEffect(() => {
    if (pesanAwal && !inisialisasiRef.current) {
      inisialisasiRef.current = true
      void kirim(pesanAwal)
    }
  }, [pesanAwal])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Side Holographic Drawer */}
      <div className="relative w-full max-w-xl h-full flex flex-col bg-zinc-950/95 border-l border-cyan-500/40 shadow-[-15px_0_50px_rgba(6,182,212,0.25)] text-zinc-100 backdrop-blur-xl">
        {/* Reticles Corner HUD */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/25 bg-black/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
              <Terminal className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <h2 className="font-hud text-xs sm:text-sm font-bold tracking-widest text-white uppercase text-glow-cyan">
                  {meta.nama}
                </h2>
              </div>
              <p className="font-mono-hud text-[10px] text-cyan-400/80 tracking-wider">
                {meta.badge} &bull; DIRECT TELEMETRY COMM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                mainkanSuaraHud('chirp')
                setRiwayat(!riwayat)
              }}
              className={`p-2 rounded-lg border font-mono-hud text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                riwayat
                  ? 'bg-cyan-900/60 border-cyan-400 text-cyan-200'
                  : 'bg-zinc-900/80 border-cyan-500/30 text-cyan-300 hover:border-cyan-400'
              }`}
              title="Arsip Transmisi"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">ARCHIVES ({daftar.length})</span>
            </button>

            <button
              onClick={() => {
                mainkanSuaraHud('chirp')
                onTutup()
              }}
              className="p-2 rounded-lg border border-red-500/30 bg-red-950/40 text-red-300 hover:bg-red-900/60 hover:border-red-400 transition-colors cursor-pointer"
              title="Disconnect Comm-link"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Archives Panel (Overlay jika diaktifkan) */}
        {riwayat && (
          <div className="p-3 border-b border-cyan-500/25 bg-black/80 font-mono-hud text-xs max-h-60 overflow-y-auto space-y-1.5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
              <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                COMM-LOG MEMORY CACHE
              </span>
              <button
                onClick={baru}
                className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/50 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>NEW SESSION</span>
              </button>
            </div>
            {daftar.length === 0 ? (
              <p className="text-zinc-500 py-2 text-center">Belum ada rekaman transmisi tersimpan.</p>
            ) : (
              daftar.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer ${
                    aktif === item.id
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-cyan-500/40'
                  }`}
                  onClick={() => buka(item.id)}
                >
                  <span className="truncate pr-2">{item.judul || 'Transmisi Tanpa Judul'}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      hapus(item.id)
                    }}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Message Stream Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pesan.length === 0 && !sibuk && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-hud-pulse">
                <Radio className="w-8 h-8" />
              </div>
              <h3 className="font-hud text-sm font-bold text-white tracking-widest uppercase">
                NEURAL CHANNEL ESTABLISHED
              </h3>
              <p className="font-mono-hud text-xs text-cyan-400/70 max-w-sm">
                {meta.deskripsi}. Ajukan instruksi komando atau pilih direktif cepat di bawah.
              </p>

              {/* Quick Directives */}
              <div className="flex flex-wrap justify-center gap-2 pt-3">
                {CEPAT[profil]?.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => kirim(q)}
                    className="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-mono-hud text-xs transition-all cursor-pointer"
                  >
                    &gt; {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pesan.map((p, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                p.peran === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1 px-1 text-[10px] font-mono-hud text-zinc-400 uppercase tracking-widest">
                {p.peran === 'user' ? (
                  <span>OPERATOR // DIRECTIVE</span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-cyan-400" />
                      <span className="text-cyan-400 font-semibold">{meta.nama}</span>
                    </div>
                    {p.isi && (
                      <button
                        onClick={() => toggleBicaraPesan(p.id, p.isi)}
                        className="flex items-center gap-1 text-[9px] text-cyan-300 hover:text-cyan-100 p-0.5 rounded cursor-pointer"
                        title={sedangBicara === p.id ? 'Hentikan Suara Jarvis' : 'Dengarkan Suara Jarvis (Voice Output)'}
                      >
                        {sedangBicara === p.id ? (
                          <>
                            <VolumeX className="w-3 h-3 text-red-400" />
                            <span className="text-red-400 font-bold">STOP</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
                            <span>SPEAK</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>

              <div
                className={`max-w-[85%] rounded-xl p-3.5 border transition-all ${
                  p.peran === 'user'
                    ? 'bg-gradient-to-r from-blue-900/60 to-cyan-900/60 border-cyan-400/40 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-mono-hud text-xs sm:text-sm'
                    : 'bg-zinc-900/90 border-cyan-500/25 text-zinc-100 shadow-[0_0_20px_rgba(0,0,0,0.5)]'
                }`}
              >
                {p.peran === 'user' ? (
                  <p className="whitespace-pre-wrap">{p.isi}</p>
                ) : p.isi ? (
                  <FormatIsiHologram isi={p.isi} />
                ) : menunggu ? (
                  <div className="flex items-center gap-2 text-cyan-400 font-mono-hud text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>SYNCHRONIZING WITH HERMES MCP DATA STREAM...</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {menunggu && (
            <div className="flex items-center gap-2 p-2 font-mono-hud text-xs text-cyan-400">
              <span className="animate-pulse">HERMES NEURAL SYNAPSE ACTIVE</span>
              <span className="animate-spin text-cyan-300">▰</span>
            </div>
          )}

          {galat && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-red-200 font-mono-hud text-xs">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">TRANSMISSION ANOMALY:</strong>
                <span>{galat}</span>
              </div>
            </div>
          )}

          <div ref={bawah} />
        </div>

        {/* Input Console Footer */}
        <div className="p-3 border-t border-cyan-500/25 bg-black/80">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void kirim(input)
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-hud text-cyan-400 text-xs select-none">
                &gt;_
              </span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={sedangMendengar ? 'Mendengarkan suara Anda...' : `Instruksikan ${meta.nama}...`}
                disabled={sibuk}
                className="w-full bg-zinc-950/80 border border-cyan-500/30 focus:border-cyan-400 rounded-lg pl-8 pr-4 py-2.5 font-mono-hud text-xs sm:text-sm text-cyan-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </div>

            {voiceDidukung && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  sedangMendengar
                    ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60'
                }`}
                title={sedangMendengar ? 'Hentikan Mendengar' : 'Bicara (Voice Input)'}
              >
                {sedangMendengar ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            <button
              type="submit"
              disabled={sibuk || !input.trim()}
              className="p-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-hud text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer disabled:cursor-not-allowed"
              title="Transmit Directive"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between text-[10px] font-mono-hud text-zinc-500">
            <span>PRESS [ENTER] TO TRANSMIT DIRECTIVE</span>
            <span className="text-cyan-400/70">END-TO-END MCP ENCRYPTED</span>
          </div>
        </div>
      </div>
    </div>
  )
}
