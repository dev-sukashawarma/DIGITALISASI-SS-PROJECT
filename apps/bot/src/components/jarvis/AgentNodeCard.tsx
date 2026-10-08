'use client'

import { mainkanSuaraHud } from '@/lib/audioHud'
import type { MejaKantor } from '@/kantor/keadaan'
import type { Profil } from '@/lib/peran'
import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
  Radio,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react'

// Peta konfigurasi tampilan per profil agen
const CONFIG_PROFIL: Record<
  Profil,
  {
    judul: string
    subjudul: string
    kode: string
    warnaAksen: string
    icon: typeof TrendingUp
    ringkasanPeran: string
    contohPertanyaan: string[]
  }
> = {
  ceo: {
    judul: 'J.A.R.V.I.S. MASTER CORE',
    subjudul: 'Executive Command & Strategic Ops',
    kode: 'CORE-01 // J.A.R.V.I.S.',
    warnaAksen: 'cyan',
    icon: TrendingUp,
    ringkasanPeran: 'Pusat kecerdasan AI terpadu: pantau omset, performa cabang, dan orkestrasi subsistem.',
    contohPertanyaan: ['Omzet kemarin berapa?', 'Peringkat outlet minggu ini', 'Laporan eksekutif hari ini'],
  },
  gudang: {
    judul: 'SUPPLY & STORAGE',
    subjudul: 'Logistics & Inventory Radar',
    kode: 'NODE-02 // GUDANG',
    warnaAksen: 'emerald',
    icon: Package,
    ringkasanPeran: 'Deteksi dini bahan baku menipis, monitoring cold chain, dan jadwal restock.',
    contohPertanyaan: ['Bahan yang hampir habis', 'Kiriman hari ini'],
  },
  hrd: {
    judul: 'HUMAN CAPITAL',
    subjudul: 'Workforce & Attendance Radar',
    kode: 'NODE-03 // HRD',
    warnaAksen: 'indigo',
    icon: Users,
    ringkasanPeran: 'Absensi langsung staf outlet, roster shift operasional, dan izin/cuti.',
    contohPertanyaan: ['Siapa yang belum absen?', 'Cuti & izin minggu ini', 'Rekap keterlambatan'],
  },
  finance: {
    judul: 'TREASURY & VAULT',
    subjudul: 'Financial Telemetry & OPEX',
    kode: 'NODE-04 // FINANCE',
    warnaAksen: 'amber',
    icon: DollarSign,
    ringkasanPeran: 'Arus kas harian, rekonsiliasi OPEX otomatis, dan status hutang supplier.',
    contohPertanyaan: ['Utang supplier jatuh tempo', 'Kas kecil bulan ini'],
  },
}

interface AgentNodeCardProps {
  meja?: MejaKantor | null
  profilFallback: Profil
  terpilih: boolean
  onPilih: (profil: Profil, pesanAwal?: string) => void
}

export default function AgentNodeCard({
  meja,
  profilFallback,
  terpilih,
  onPilih,
}: AgentNodeCardProps) {
  const profil = meja?.profil ?? profilFallback
  const config = CONFIG_PROFIL[profil] || CONFIG_PROFIL.ceo
  const IconComponent = config.icon

  const keadaan = meja?.keadaan ?? 'siaga'
  const bolehChat = meja ? meja.bolehChat : true

  // Styling status keadaan
  const statusBadge = {
    bekerja: { label: 'PROCESSING', color: 'text-cyan-300 border-cyan-500/50 bg-cyan-950/60', icon: Zap },
    siaga: { label: 'ONLINE / SIAGA', color: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60', icon: CheckCircle2 },
    galat: { label: 'ANOMALY DETECTED', color: 'text-red-400 border-red-500/60 bg-red-950/60', icon: AlertTriangle },
    tidur: { label: 'STANDBY MODE', color: 'text-zinc-400 border-zinc-700/60 bg-zinc-900/60', icon: Clock },
  }[keadaan]

  const StatusIcon = statusBadge.icon

  const handleClick = (pesanAwal?: string) => {
    if (!bolehChat) return
    mainkanSuaraHud('engage')
    onPilih(profil, pesanAwal)
  }

  return (
    <div
      className={`relative group rounded-xl p-3 sm:p-3.5 transition-all duration-300 backdrop-blur-md border ${
        terpilih
          ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
          : 'bg-zinc-950/75 border-cyan-500/20 hover:border-cyan-400/50 hover:bg-zinc-900/80 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]'
      }`}
    >
      {/* Reticle Corners */}
      <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400/70 pointer-events-none" />
      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400/70 pointer-events-none" />
      <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400/70 pointer-events-none" />
      <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/70 pointer-events-none" />

      {/* Header Card: Code & Live Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/15 pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono-hud text-[10px] tracking-widest text-cyan-300 font-bold uppercase">
            {config.kode}
          </span>
        </div>

        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono-hud uppercase tracking-wider border ${statusBadge.color}`}>
          <StatusIcon className="w-3 h-3" />
          <span>{statusBadge.label}</span>
        </div>
      </div>

      {/* Main Title & Agent Description */}
      <div className="flex items-start gap-2.5">
        <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 group-hover:scale-105 transition-transform shrink-0">
          <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-hud text-xs sm:text-sm font-bold text-white tracking-wider group-hover:text-cyan-300 transition-colors truncate">
            {config.judul}
          </h3>
          <p className="font-mono-hud text-[10px] sm:text-[11px] text-cyan-400/75 truncate">
            {config.subjudul}
          </p>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] sm:text-xs text-zinc-300/90 leading-snug line-clamp-2">
        {config.ringkasanPeran}
      </p>

      {/* Telemetry Tool Readout */}
      <div className="mt-2 py-1 px-2 rounded bg-black/60 border border-cyan-500/10 font-mono-hud text-[10px] text-cyan-400/80 flex items-center justify-between">
        <span className="text-zinc-500">TELEMETRY:</span>
        <span className="truncate max-w-[140px] font-semibold text-cyan-300">
          {meja?.alatTerakhir ? meja.alatTerakhir : 'standby_ready'}
        </span>
      </div>

      {/* Quick Directives Chips */}
      <div className="mt-2 pt-2 border-t border-cyan-500/15">
        <div className="flex flex-wrap gap-1">
          {config.contohPertanyaan.slice(0, 2).map((q, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation()
                handleClick(q)
              }}
              disabled={!bolehChat}
              className="text-left font-mono-hud text-[9px] px-2 py-0.5 rounded bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed truncate max-w-[200px]"
            >
              &gt; {q}
            </button>
          ))}
        </div>
      </div>

      {/* Engage / Comm-link Button */}
      <button
        onClick={() => handleClick()}
        disabled={!bolehChat}
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg font-hud text-[10px] sm:text-xs tracking-wider uppercase font-bold transition-all cursor-pointer ${
          bolehChat
            ? 'bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)] border border-cyan-400/40'
            : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-not-allowed'
        }`}
      >
        <Radio className="w-3 h-3 animate-pulse" />
        <span>{bolehChat ? 'INITIALIZE COMM-LINK' : 'LOCKED'}</span>
      </button>
    </div>
  )
}
