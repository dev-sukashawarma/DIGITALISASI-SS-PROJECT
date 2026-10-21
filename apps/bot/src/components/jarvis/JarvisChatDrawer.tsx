'use client'

import { useEffect, useRef, useState } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
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

const LABEL_AGENT_BAWAAN: Record<string, { nama: string; badge: string; deskripsi: string }> = {
  ceo: {
    nama: 'J.A.R.V.I.S. // UNIFIED MASTER CORE',
    badge: 'ALL-DIVISION EXECUTIVE INTELLIGENCE',
    deskripsi: 'Pusat komando terpadu Suka Shawarma (Sales, Finance, Gudang/Waste, HRD, & SukaReview)',
  },
  gudang: {
    nama: 'JARVIS // SUBSYSTEM GUDANG',
    badge: 'SUPPLY CHAIN RADAR',
    deskripsi: 'Analitik stok bahan baku, rantai pasok, dan deteksi bahan kritis',
  },
  hrd: {
    nama: 'JARVIS // SUBSYSTEM HRD',
    badge: 'WORKFORCE TELEMETRY',
    deskripsi: 'Pemantauan absensi shift, roster tim cabang, dan data SDM',
  },
  finance: {
    nama: 'JARVIS // SUBSYSTEM FINANCE',
    badge: 'TREASURY RECONCILIATION',
    deskripsi: 'Arus kas harian, rekonsiliasi OPEX, dan liabilitas supplier',
  },
  sentry: {
    nama: 'JARVIS // SENTRY OPS',
    badge: 'DATABASE & VPS WATCHDOG',
    deskripsi: 'Pemantau kesehatan database Supabase, sisa disk & RAM VPS, dan deteksi dini anomali sistem',
  },
}

const CEPAT_BAWAAN: Record<string, string[]> = {
  ceo: [
    'Peringkat omzet semua cabang hari ini',
    'Evaluasi penjualan kemarin',
    'Rincian utang PO supplier & OPEX',
    'Siapa kru yang telat atau izin hari ini?',
    'Audit bahan waste & void kasir',
  ],
  hrd: ['Siapa yang belum absen hari ini?', 'Cuti & izin minggu ini', 'Rekap keterlambatan bulan ini'],
  gudang: ['Bahan yang hampir habis', 'Kiriman hari ini'],
  finance: ['Utang supplier jatuh tempo', 'Kas kecil bulan ini'],
  sentry: ['Status database & VPS sekarang', 'Berapa sisa disk server?', 'Ada error sistem hari ini?'],
}

function ambilMetaAgent(profil: Profil) {
  if (profil in LABEL_AGENT_BAWAAN) return LABEL_AGENT_BAWAAN[profil]
  const namaKapital = profil.toUpperCase()
  return {
    nama: `JARVIS // BOT ${namaKapital}`,
    badge: 'SUBSYSTEM RADAR',
    deskripsi: `Modul operasional AI dan analitik terpadu untuk divisi ${profil}`,
  }
}

function ambilOpsiCepat(profil: Profil): string[] {
  if (profil in CEPAT_BAWAAN) return CEPAT_BAWAAN[profil]
  return [`Status operasional ${profil}`, `Rangkuman metrik hari ini`, `Bantuan dan analitik divisi`]
}

const GALAT_UMUM = 'Koneksi ke Hermes Core terputus. Pastikan gateway aktif.'

function parseInline(text: string) {
  const parts: Array<{ type: 'text' | 'bold' | 'code'; val: string }> = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', val: text.slice(lastIdx, match.index) })
    }
    const chunk = match[0]
    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      parts.push({ type: 'code', val: chunk.slice(1, -1) })
    } else if (chunk.startsWith('**') && chunk.endsWith('**')) {
      parts.push({ type: 'bold', val: chunk.slice(2, -2) })
    }
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) {
    parts.push({ type: 'text', val: text.slice(lastIdx) })
  }
  return parts
}

function RenderInline({ text }: { text: string }) {
  const parts = parseInline(text)
  return (
    <>
      {parts.map((p, idx) => {
        if (p.type === 'bold') {
          return (
            <strong key={idx} className="text-cyan-300 font-semibold">
              {p.val}
            </strong>
          )
        }
        if (p.type === 'code') {
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-mono text-[11px]"
            >
              {p.val}
            </code>
          )
        }
        return <span key={idx}>{p.val}</span>
      })}
    </>
  )
}

function RenderTable({ rows }: { rows: string[] }) {
  const parseRow = (r: string) =>
    r
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())

  if (rows.length === 0) return null
  const header = parseRow(rows[0])
  const isSeparator = (r: string) => /^\|?\s*:?-+:?\s*(\|:?-+:?\s*)*\|?$/.test(r.trim())
  const bodyRows = rows.slice(1).filter((r) => !isSeparator(r)).map(parseRow)

  return (
    <div className="my-2.5 overflow-x-auto rounded border border-cyan-800/60 bg-zinc-950/70 shadow-lg">
      <table className="w-full text-left text-[11px] sm:text-xs">
        <thead className="bg-cyan-950/80 text-cyan-300 font-mono-hud uppercase tracking-wider border-b border-cyan-800/60">
          <tr>
            {header.map((col, idx) => (
              <th key={idx} className="px-2.5 py-1.5 font-semibold">
                <RenderInline text={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-cyan-950/60 font-mono-hud text-zinc-300">
          {bodyRows.map((cols, rIdx) => (
            <tr key={rIdx} className="hover:bg-cyan-950/30 transition-colors">
              {cols.map((col, cIdx) => (
                <td key={cIdx} className="px-2.5 py-1.5">
                  <RenderInline text={col} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FormatIsiHologram({ isi }: { isi: string }) {
  const lines = isi.split('\n')
  const blocks: Array<
    | { type: 'table'; rows: string[] }
    | { type: 'quote'; lines: string[] }
    | { type: 'heading'; level: number; text: string }
    | { type: 'list-item'; marker: string; text: string }
    | { type: 'p'; text: string }
  > = []

  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const tableRows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableRows.push(lines[i].trim())
        i++
      }
      blocks.push({ type: 'table', rows: tableRows })
      continue
    }

    if (raw.trimStart().startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s*/, ''))
        i++
      }
      blocks.push({ type: 'quote', lines: quoteLines })
      continue
    }

    const headingMatch = raw.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      i++
      continue
    }

    const listMatch = raw.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      blocks.push({ type: 'list-item', marker: listMatch[2], text: listMatch[3] })
      i++
      continue
    }

    blocks.push({ type: 'p', text: raw })
    i++
  }

  return (
    <div className="space-y-1.5 leading-relaxed font-mono-hud text-xs sm:text-sm">
      {blocks.map((b, idx) => {
        if (b.type === 'table') {
          return <RenderTable key={idx} rows={b.rows} />
        }
        if (b.type === 'quote') {
          const isDirective = b.lines.some(
            (l) => l.includes('[!NOTE]') || l.includes('[!IMPORTANT]') || l.includes('[!WARNING]')
          )
          if (isDirective) {
            const cleanText = b.lines.map((l) => l.replace(/^\[!(NOTE|IMPORTANT|WARNING)\]\s*/, '')).join(' ')
            return (
              <div
                key={idx}
                className="my-2 px-3 py-2 rounded-r bg-cyan-950/70 border-l-2 border-cyan-400 text-cyan-200 text-[11px] sm:text-xs flex items-start gap-2 shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mt-1 shrink-0" />
                <div className="font-mono-hud">
                  <RenderInline text={cleanText} />
                </div>
              </div>
            )
          }
          return (
            <div
              key={idx}
              className="pl-3 py-1 my-1 border-l-2 border-cyan-500/40 text-cyan-100/90 text-[11px] sm:text-xs italic bg-cyan-950/20"
            >
              {b.lines.map((l, lIdx) => (
                <p key={lIdx}>
                  <RenderInline text={l} />
                </p>
              ))}
            </div>
          )
        }
        if (b.type === 'heading') {
          return (
            <h4
              key={idx}
              className="text-cyan-400 font-bold text-xs sm:text-sm tracking-wider uppercase mt-3 mb-1.5 flex items-center gap-1.5 border-b border-cyan-800/40 pb-1"
            >
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
              <RenderInline text={b.text} />
            </h4>
          )
        }
        if (b.type === 'list-item') {
          const isNum = /^\d+\./.test(b.marker)
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span
                className={
                  isNum
                    ? 'text-cyan-400 text-[11px] font-bold mt-0.5 shrink-0'
                    : 'text-cyan-400 text-xs mt-0.5 shrink-0'
                }
              >
                {isNum ? b.marker : '•'}
              </span>
              <div className="text-zinc-200">
                <RenderInline text={b.text} />
              </div>
            </div>
          )
        }
        return (
          <p key={idx} className="min-h-[1.2em] text-zinc-200">
            <RenderInline text={b.text} />
          </p>
        )
      })}
    </div>
  )
}

interface JarvisChatDrawerProps {
  profil: Profil
  pesanAwal?: string | null
  percakapanIdAwal?: string | null
  onPercakapanIdChange?: (id: string | null) => void
  onTutup: () => void
}

export default function JarvisChatDrawer({
  profil,
  pesanAwal,
  percakapanIdAwal,
  onPercakapanIdChange,
  onTutup,
}: JarvisChatDrawerProps) {
  const [daftar, setDaftar] = useState<Percakapan[]>([])
  const [aktif, setAktif] = useState<string | null>(percakapanIdAwal ?? null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [input, setInput] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [menunggu, setMenunggu] = useState(false)
  const [riwayat, setRiwayat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [sedangMendengar, setSedangMendengar] = useState(false)
  const [voiceDidukung, setVoiceDidukung] = useState(false)
  const [ttsDidukung, setTtsDidukung] = useState(false)
  const [autoSuara, setAutoSuara] = useState(true)
  const [sedangBicara, setSedangBicara] = useState<string | number | null>(null)
  const bawah = useRef<HTMLDivElement>(null)
  const inisialisasiRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const meta = ambilMetaAgent(profil)

  useEffect(() => {
    const support = apakahVoiceDidukung()
    setVoiceDidukung(support.stt)
    setTtsDidukung(support.tts)
    return () => {
      abortRef.current?.abort()
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
      hentiMendengar(true)
      mainkanSuaraHud('chirp')
    } else {
      mainkanSuaraHud('engage')
      const sukses = mulaiMendengar({
        onMulai: () => setSedangMendengar(true),
        onHasil: (teks) => {
          if (teks && !teks.startsWith('🎙️') && !teks.startsWith('⏳')) {
            setInput(teks)
          }
        },
        onFinalOtomatis: (teksFinal) => {
          setSedangMendengar(false)
          void kirim(teksFinal, true)
        },
        onSelesai: () => setSedangMendengar(false),
        onGalat: (pesan) => {
          setSedangMendengar(false)
          setGalat(pesan)
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
    if (percakapanIdAwal && !pesanAwal) {
      void buka(percakapanIdAwal)
    }
  }, [profil])

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pesan, menunggu])

  const buka = async (id: string) => {
    mainkanSuaraHud('chirp')
    setRiwayat(false)
    setGalat(null)
    setAktif(id)
    onPercakapanIdChange?.(id)
    setPesan([])
    const r = await fetch(`/api/percakapan/${id}`, { cache: 'no-store' })
    if (r.ok) {
      const data = (await r.json()) as { pesan: Pesan[] }
      setPesan((data.pesan || []).filter((m) => m.isi && m.isi.trim()))
    } else {
      setGalat('Gagal memuat arsip transmisi.')
    }
  }

  const baru = () => {
    mainkanSuaraHud('chirp')
    setAktif(null)
    onPercakapanIdChange?.(null)
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

  const kirim = async (teks: string, dariVoice = false) => {
    const isi = teks.trim()
    if (!isi || sibuk) return
    mainkanSuaraHud('transmit')
    hentiBicaraJarvis()
    setSedangBicara(null)
    setSibuk(true)
    setMenunggu(true)
    setGalat(null)
    setInput('')
    const botMsgId = `b${Date.now()}`
    setPesan((p) => [
      ...p,
      { id: `u${Date.now()}`, peran: 'user', isi },
      { id: botMsgId, peran: 'bot', isi: '' },
    ])

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: isi, profil, percakapanId: aktif ?? undefined }),
        signal: controller.signal,
      })
      if (!r.ok || !r.body) {
        const b = await r.json().catch(() => ({}))
        throw new Error(b.galat || GALAT_UMUM)
      }
      const id = r.headers.get('X-Percakapan-Id')
      if (id) {
        setAktif(id)
        onPercakapanIdChange?.(id)
      }

      const pembaca = r.body.getReader()
      const dek = new TextDecoder()
      let jawabanLengkap = ''
      for (;;) {
        const { value, done } = await pembaca.read()
        if (done) break
        const t = dek.decode(value, { stream: true })
        jawabanLengkap += t
        setMenunggu(false)
        setPesan((p) => {
          const s = [...p]
          s[s.length - 1] = { ...s[s.length - 1], isi: s[s.length - 1].isi + t }
          return s
        })
      }
      mainkanSuaraHud('blip')
      void muatDaftar()

      if ((dariVoice || autoSuara) && jawabanLengkap.trim()) {
        setSedangBicara(botMsgId)
        bicaraJarvis(jawabanLengkap, () => setSedangBicara(null))
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      mainkanSuaraHud('alert')
      setPesan((p) => {
        const s = [...p]
        const last = s[s.length - 1]
        if (last && last.peran === 'bot' && last.isi.trim()) {
          s[s.length - 1] = {
            ...last,
            isi: `${last.isi}\n\n[Transmisi terputus: ${(e as Error).message || GALAT_UMUM}]`,
          }
          return s
        }
        return s.slice(0, -1)
      })
      setGalat((e as Error).message || GALAT_UMUM)
    } finally {
      setSibuk(false)
      setMenunggu(false)
    }
  }

  useEffect(() => {
    if (pesanAwal && !inisialisasiRef.current) {
      inisialisasiRef.current = true
      void kirim(pesanAwal)
    }
  }, [pesanAwal])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-full flex flex-col bg-zinc-950/95 border-l border-cyan-500/40 shadow-[-15px_0_50px_rgba(6,182,212,0.25)] text-zinc-100 backdrop-blur-xl">
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
                {meta.badge} &bull; TEXT &amp; VOICE TELEMETRY
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {ttsDidukung && (
              <button
                type="button"
                onClick={() => {
                  const baruVal = !autoSuara
                  setAutoSuara(baruVal)
                  if (!baruVal) {
                    hentiBicaraJarvis()
                    setSedangBicara(null)
                  }
                  mainkanSuaraHud('chirp')
                }}
                className={`p-2 rounded-lg border font-mono-hud text-[10px] transition-colors flex items-center gap-1 cursor-pointer ${
                  autoSuara
                    ? 'bg-cyan-950/80 border-cyan-400/60 text-cyan-200'
                    : 'bg-zinc-900/80 border-zinc-700 text-zinc-400'
                }`}
                title={autoSuara ? 'Balasan Suara Otomatis: AKTIF' : 'Balasan Suara Otomatis: MATI'}
              >
                {autoSuara ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{autoSuara ? 'VOICE: AUTO' : 'VOICE: OFF'}</span>
              </button>
            )}

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

        {/* Archives Panel */}
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
                      void hapus(item.id)
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
                {meta.deskripsi}. Ketik pertanyaan Anda atau gunakan mikrofon untuk bicara langsung.
              </p>

              <div className="flex flex-wrap justify-center gap-2 pt-3">
                {ambilOpsiCepat(profil).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => void kirim(q)}
                    className="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-mono-hud text-xs transition-all cursor-pointer"
                  >
                    &gt; {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pesan.map((p, idx) => {
            if (p.peran === 'bot' && !p.isi.trim() && !(menunggu && idx === pesan.length - 1)) {
              return null
            }
            return (
              <div
                key={idx}
                className={`flex flex-col ${p.peran === 'user' ? 'items-end' : 'items-start'}`}
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
                      {p.isi && ttsDidukung && (
                        <button
                          onClick={() => toggleBicaraPesan(p.id, p.isi)}
                          className="flex items-center gap-1 text-[9px] text-cyan-300 hover:text-cyan-100 p-0.5 rounded cursor-pointer"
                          title={sedangBicara === p.id ? 'Hentikan Suara Jarvis' : 'Dengarkan Suara Jarvis'}
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
                  className={`max-w-[90%] rounded-xl p-3.5 border transition-all ${
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
            )
          })}

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
              void kirim(input, false)
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
                placeholder={
                  sedangMendengar
                    ? 'Mendengarkan suara Anda (otomatis kirim saat jeda)...'
                    : 'Ketik pertanyaan atau instruksi ke J.A.R.V.I.S...'
                }
                disabled={sibuk}
                className="w-full bg-zinc-950/80 border border-cyan-500/30 focus:border-cyan-400 rounded-lg pl-8 pr-4 py-2.5 font-mono-hud text-base sm:text-sm text-cyan-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </div>

            {voiceDidukung && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  sedangMendengar
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                    : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60'
                }`}
                title={sedangMendengar ? 'Hentikan Mendengar' : 'Bicara ke Jarvis (Auto-Send & Auto-Voice)'}
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
            <span>KETIK [ENTER] ATAU BICARA VIA MIC UNTUK TRANSMISI</span>
            <span className="text-cyan-400/70">UNIFIED J.A.R.V.I.S. MEMORY</span>
          </div>
        </div>
      </div>
    </div>
  )
}
