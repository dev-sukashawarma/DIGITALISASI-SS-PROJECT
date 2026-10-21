'use client'

import { mainkanSuaraHud } from '@/lib/audioHud'
import type { MejaKantor } from '@/kantor/keadaan'
import type { Profil } from '@/lib/peran'
import type { TelemetriHariIni } from '@/lib/server/telemetriNyata'
import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'

function fmtRpSingkat(angka: number): string {
  if (!angka || isNaN(angka)) return 'Rp 0'
  if (angka >= 1_000_000_000) {
    return `Rp ${(angka / 1_000_000_000).toFixed(2).replace('.', ',')} M`
  }
  if (angka >= 1_000_000) {
    return `Rp ${(angka / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')} Jt`
  }
  if (angka >= 1_000) {
    return `Rp ${Math.round(angka / 1_000)} Rb`
  }
  return `Rp ${angka}`
}

interface BarisMetrik {
  label: string
  nilai: string
  sorot?: 'normal' | 'good' | 'warn' | 'crit'
}

interface DivisiVisual {
  kode: string
  judul: string
  subjudul: string
  icon: typeof TrendingUp
  statusLabel: string
  statusLevel: 'optimal' | 'warning' | 'critical'
  metrik: BarisMetrik[]
  contohPertanyaan: string[]
}

function bangunVisualDivisi(profil: string, t: TelemetriHariIni | null | undefined): DivisiVisual {
  const p = profil.toLowerCase()

  if (p === 'ceo' || p === 'sales') {
    const omzetHariIni = t?.omzetTotal ?? 0
    const orderHariIni = t?.totalOrder ?? 0
    const omzetKemarin = t?.ringkasanKemarin?.omzetTotal ?? 0
    const aktifCount = t?.outletsAktifTransaksi?.length ?? 0
    const totalOut = t?.totalOutletAktif ?? 0
    const top1 = t?.outletsAktifTransaksi?.[0] || t?.ringkasanKemarin?.outletsAktifTransaksi?.[0]

    return {
      kode: 'DIV-01 // SALES & POS RADAR',
      judul: 'SALES & OUTLET NETWORK',
      subjudul: 'Real-Time POS Revenue & Leaderboard',
      icon: TrendingUp,
      statusLabel: t ? `${aktifCount}/${totalOut} OUTLET AKTIF` : 'SYNCING POS...',
      statusLevel: 'optimal',
      metrik: [
        {
          label: 'OMZET HARI INI',
          nilai: t ? `${fmtRpSingkat(omzetHariIni)} (${orderHariIni} struk)` : 'Memuat...',
          sorot: omzetHariIni > 0 ? 'good' : 'normal',
        },
        {
          label: 'CLOSING KEMARIN',
          nilai: t ? `${fmtRpSingkat(omzetKemarin)} (${t.ringkasanKemarin?.totalOrder ?? 0} struk)` : 'Memuat...',
          sorot: 'normal',
        },
        {
          label: 'RATA-RATA STRUK (AOV)',
          nilai: t ? fmtRpSingkat(t.aov || t.ringkasanKemarin?.aov || 0) : '-',
          sorot: 'normal',
        },
        {
          label: 'TOP #1 CABANG',
          nilai: top1 ? `${top1.nama.replace(/^SUKA SHAWARMA\s+/i, '')} (${fmtRpSingkat(top1.omzet)})` : '-',
          sorot: 'good',
        },
      ],
      contohPertanyaan: [
        'Tampilkan peringkat omzet seluruh cabang hari ini',
        'Bagaimana evaluasi lengkap penjualan kemarin?',
      ],
    }
  }

  if (p === 'finance') {
    const opexHariIni = t?.finance?.pengeluaranHariIni?.totalNominal ?? 0
    const setoranHariIni = t?.finance?.setoranKas?.inputHariIni?.totalNominal ?? 0
    const utangTotal = t?.finance?.utangPo?.totalUtang ?? 0
    const overdue = t?.finance?.utangPo?.totalLewatJatuhTempo ?? 0

    return {
      kode: 'DIV-02 // TREASURY & VAULT',
      judul: 'FINANCE & RECONCILIATION',
      subjudul: 'Cash Flow, OPEX & Supplier Liability',
      icon: DollarSign,
      statusLabel: overdue > 0 ? 'PO OVERDUE ALERT' : 'TREASURY NOMINAL',
      statusLevel: overdue > 0 ? 'warning' : 'optimal',
      metrik: [
        {
          label: 'OPEX / KAS KECIL HARI INI',
          nilai: t ? `${fmtRpSingkat(opexHariIni)} (${t.finance?.pengeluaranHariIni?.jumlahTransaksi ?? 0} tx)` : 'Memuat...',
          sorot: 'normal',
        },
        {
          label: 'SETORAN DIREKAP HARI INI',
          nilai: t ? fmtRpSingkat(setoranHariIni) : 'Memuat...',
          sorot: setoranHariIni > 0 ? 'good' : 'normal',
        },
        {
          label: 'UTANG PO SUPPLIER',
          nilai: t ? `${fmtRpSingkat(utangTotal)} (${t.finance?.utangPo?.jumlahPo ?? 0} PO)` : 'Memuat...',
          sorot: 'normal',
        },
        {
          label: 'PO LEWAT JATUH TEMPO',
          nilai: t ? (overdue > 0 ? fmtRpSingkat(overdue) : 'Rp 0 (Aman)') : '-',
          sorot: overdue > 0 ? 'crit' : 'good',
        },
      ],
      contohPertanyaan: [
        'Rincikan utang PO supplier & yang jatuh tempo',
        'Bagaimana rincian pengeluaran OPEX & setoran kas hari ini?',
      ],
    }
  }

  if (p === 'gudang') {
    const buka = t?.statusBuka?.totalBuka ?? 0
    const belumBuka = t?.statusBuka?.totalBelumBuka ?? 0
    const voidCount = t?.voidOrder?.totalVoidHariIni ?? 0
    const voidRp = t?.voidOrder?.totalNilaiVoidHariIni ?? 0
    const wasteRp = t?.waste?.totalEstKerugianRp ?? 0
    const topWaste = t?.waste?.topBahan?.[0]

    return {
      kode: 'DIV-03 // SUPPLY & LOSS PREV',
      judul: 'OPS, VOID & WASTE RADAR',
      subjudul: 'Shift Readiness, POS Audit & Inventory Loss',
      icon: Package,
      statusLabel: voidCount > 0 ? `${voidCount} VOID TERDETEKSI` : 'AUDIT BERSIH',
      statusLevel: voidCount > 0 ? 'warning' : 'optimal',
      metrik: [
        {
          label: 'SHIFT KASIR CABANG',
          nilai: t ? `${buka} Buka • ${belumBuka} Belum Buka` : 'Memuat...',
          sorot: belumBuka === 0 ? 'good' : 'warn',
        },
        {
          label: 'VOID POS HARI INI',
          nilai: t ? (voidCount > 0 ? `${voidCount} struk (${fmtRpSingkat(voidRp)})` : '0 Void (Bersih)') : '-',
          sorot: voidCount > 0 ? 'warn' : 'good',
        },
        {
          label: 'EST. RUGI WASTE (30H)',
          nilai: t ? `${fmtRpSingkat(wasteRp)} (${t.waste?.totalLaporan30Hari ?? 0} lap)` : 'Memuat...',
          sorot: wasteRp > 500_000 ? 'warn' : 'normal',
        },
        {
          label: 'BAHAN WASTE TERTINGGI',
          nilai: topWaste ? `${topWaste.nama} (${topWaste.totalQty} ${topWaste.satuan})` : 'Terkendali',
          sorot: 'normal',
        },
      ],
      contohPertanyaan: [
        'Analisis laporan waste bahan baku & kerugian tertinggi',
        'Cabang mana yang belum buka & ada transaksi void hari ini?',
      ],
    }
  }

  // Default: HRD & Customer Experience (Review)
  const onTimePct = t?.persenOnTime ?? 100
  const hadirTotal = t?.kehadiranTotal ?? 0
  const telatCount = t?.kehadiranTelat ?? 0
  const cutiCount = t?.stafCutiIzin?.length ?? 0
  const rating = t?.review?.ratingRataRata ?? 4.8
  const totalUlasan = t?.review?.totalUlasan ?? 0
  const komplainCount = t?.review?.ulasanNegatifTerbaru?.length ?? 0

  return {
    kode: 'DIV-04 // WORKFORCE & REVIEW',
    judul: 'HRD & CUSTOMER SENTIMENT',
    subjudul: 'Live Attendance & Google Review Radar',
    icon: Users,
    statusLabel: telatCount > 0 ? `${telatCount} KRU TERLAMBAT` : `ON-TIME ${onTimePct}%`,
    statusLevel: telatCount > 3 ? 'warning' : 'optimal',
    metrik: [
      {
        label: 'KEHADIRAN KRU OUTLET',
        nilai: t ? `${onTimePct}% On-Time (${hadirTotal} clock-in)` : 'Memuat...',
        sorot: onTimePct >= 90 ? 'good' : 'warn',
      },
      {
        label: 'TERLAMBAT / IZIN CUTI',
        nilai: t ? `${telatCount} Telat • ${cutiCount} Izin/Cuti` : 'Memuat...',
        sorot: telatCount > 0 ? 'warn' : 'good',
      },
      {
        label: 'RATING GOOGLE MAPS',
        nilai: t ? `${rating} ⭐ (${totalUlasan} ulasan)` : '4.8 ⭐',
        sorot: 'good',
      },
      {
        label: 'ULASAN KRITIS TERBARU',
        nilai: t ? (komplainCount > 0 ? `${komplainCount} komplain perlu cek` : '0 komplain kritis') : '-',
        sorot: komplainCount > 0 ? 'warn' : 'good',
      },
    ],
    contohPertanyaan: [
      'Siapa saja kru cabang yang terlambat atau izin hari ini?',
      'Tampilkan ulasan negatif pelanggan terbaru di Google Review',
    ],
  }
}

interface AgentNodeCardProps {
  meja?: MejaKantor | null
  profilFallback: Profil
  telemetri?: TelemetriHariIni | null
  terpilih: boolean
  onPilih: (profil: Profil, pesanAwal?: string) => void
}

export default function AgentNodeCard({
  meja,
  profilFallback,
  telemetri,
  terpilih,
  onPilih,
}: AgentNodeCardProps) {
  const profil = meja?.profil ?? profilFallback
  const vis = bangunVisualDivisi(profil, telemetri)
  const IconComponent = vis.icon

  const badgeStyle =
    vis.statusLevel === 'critical'
      ? 'text-red-300 border-red-500/60 bg-red-950/60'
      : vis.statusLevel === 'warning'
        ? 'text-amber-300 border-amber-500/50 bg-amber-950/60'
        : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60'

  const StatusIcon = vis.statusLevel === 'optimal' ? CheckCircle2 : AlertTriangle

  const handleTanyaJarvis = (pertanyaan?: string) => {
    mainkanSuaraHud('engage')
    const defaultPrompt = vis.contohPertanyaan[0] || `Analisis data terbaru divisi ${vis.judul}`
    // Semua diarahkan ke 1 J.A.R.V.I.S. tunggal (profil 'ceo') yang memiliki akses ke seluruh divisi
    onPilih('ceo', pertanyaan || defaultPrompt)
  }

  return (
    <div
      className={`relative group rounded-xl p-3 sm:p-3.5 transition-all duration-300 backdrop-blur-md border ${
        terpilih
          ? 'bg-cyan-950/45 border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
          : 'bg-zinc-950/80 border-cyan-500/25 hover:border-cyan-400/55 hover:bg-zinc-900/85 hover:shadow-[0_0_18px_rgba(6,182,212,0.18)]'
      }`}
    >
      {/* Reticle Corners */}
      <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400/70 pointer-events-none" />
      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400/70 pointer-events-none" />
      <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400/70 pointer-events-none" />
      <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/70 pointer-events-none" />

      {/* Header Card: Division Code & Live Telemetry Status */}
      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/15 pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span className="font-mono-hud text-[9px] sm:text-[10px] tracking-widest text-cyan-300 font-bold uppercase truncate">
            {vis.kode}
          </span>
        </div>

        <div
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono-hud uppercase tracking-wider border shrink-0 ${badgeStyle}`}
        >
          <StatusIcon className="w-2.5 h-2.5" />
          <span>{vis.statusLabel}</span>
        </div>
      </div>

      {/* Main Title */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-950/70 border border-cyan-500/35 text-cyan-300 group-hover:scale-105 transition-transform shrink-0">
          <IconComponent className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-hud text-xs sm:text-sm font-bold text-white tracking-wider group-hover:text-cyan-300 transition-colors truncate">
            {vis.judul}
          </h3>
          <p className="font-mono-hud text-[9px] sm:text-[10px] text-cyan-400/75 truncate">
            {vis.subjudul}
          </p>
        </div>
      </div>

      {/* Live 4-Row Division Telemetry Readout */}
      <div className="space-y-1 bg-black/60 rounded-lg p-2 border border-cyan-500/15 font-mono-hud">
        {vis.metrik.map((m, idx) => {
          const warnaNilai =
            m.sorot === 'crit'
              ? 'text-red-400 font-bold'
              : m.sorot === 'warn'
                ? 'text-amber-300 font-semibold'
                : m.sorot === 'good'
                  ? 'text-emerald-300 font-semibold'
                  : 'text-cyan-200'
          return (
            <div key={idx} className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
              <span className="text-zinc-400 truncate">{m.label}</span>
              <span className={`truncate max-w-[165px] text-right ${warnaNilai}`}>{m.nilai}</span>
            </div>
          )
        })}
      </div>

      {/* Quick Ask Jarvis Chips */}
      <div className="mt-2 pt-1.5 border-t border-cyan-500/15 flex flex-col gap-1">
        {vis.contohPertanyaan.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleTanyaJarvis(q)
            }}
            className="w-full text-left font-mono-hud text-[9px] sm:text-[10px] px-2 py-1 rounded bg-cyan-950/35 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-500/25 hover:border-cyan-400 transition-all cursor-pointer truncate flex items-center gap-1"
            title={q}
          >
            <Sparkles className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            <span className="truncate">{q}</span>
          </button>
        ))}
      </div>

      {/* Analyze Division via J.A.R.V.I.S. Button */}
      <button
        type="button"
        onClick={() => handleTanyaJarvis()}
        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg font-hud text-[10px] tracking-wider uppercase font-bold transition-all cursor-pointer bg-gradient-to-r from-cyan-600/75 to-blue-600/75 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)] border border-cyan-400/40"
      >
        <Radio className="w-3 h-3 animate-pulse" />
        <span>ANALISIS DIVISI VIA J.A.R.V.I.S.</span>
      </button>
    </div>
  )
}
