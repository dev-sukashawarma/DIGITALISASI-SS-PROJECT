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

export interface BarisMetrik {
  label: string
  nilai: string
  sorot?: 'normal' | 'good' | 'warn' | 'crit'
}

export interface AksiCepatDivisi {
  label: string
  query: string
}

export interface DivisiVisual {
  kode: string
  judul: string
  subjudul: string
  icon: typeof TrendingUp
  statusLabel: string
  statusLevel: 'optimal' | 'warning' | 'critical'
  progressLabel: string
  progressPersen: number
  metrik: BarisMetrik[]
  aksiCepat: AksiCepatDivisi[]
  namaAksiUtama: string
}

function bangunVisualDivisi(
  profil: string,
  t: TelemetriHariIni | null | undefined,
  modeWaktu: 'kemarin' | 'hari_ini' = 'kemarin'
): DivisiVisual {
  const p = profil.toLowerCase()
  const isKemarin = modeWaktu === 'kemarin'

  if (p === 'ceo' || p === 'sales') {
    const omzetHariIni = t?.omzetTotal ?? 0
    const orderHariIni = t?.totalOrder ?? 0
    const omzetKemarin = t?.ringkasanKemarin?.omzetTotal ?? 0
    const orderKemarin = t?.ringkasanKemarin?.totalOrder ?? 0
    const aktifCount = isKemarin
      ? (t?.ringkasanKemarin?.outletsAktifTransaksi?.length ?? 0)
      : (t?.outletsAktifTransaksi?.length ?? 0)
    const totalOut = t?.totalOutletAktif ?? 0
    const top1 = isKemarin
      ? (t?.ringkasanKemarin?.outletsAktifTransaksi?.[0] || t?.outletsAktifTransaksi?.[0])
      : (t?.outletsAktifTransaksi?.[0] || t?.ringkasanKemarin?.outletsAktifTransaksi?.[0])
    const topMenu1 = isKemarin
      ? (t?.topMenuKemarin?.[0] || t?.ringkasanKemarin?.topMenu?.[0] || t?.topMenu?.[0])
      : (t?.topMenu?.[0] || t?.topMenuKemarin?.[0])

    const pctOutletAktif =
      totalOut > 0
        ? Math.min(100, Math.round((aktifCount / totalOut) * 100))
        : omzetKemarin > 0
          ? 100
          : 0

    return {
      kode: `DIV-01 // SALES & POS (${isKemarin ? 'H-1' : 'LIVE'})`,
      judul: 'SALES & OUTLET NETWORK',
      subjudul: isKemarin ? 'Closing Kemarin & Peringkat Cabang' : 'Real-Time POS Revenue & Leaderboard',
      icon: TrendingUp,
      statusLabel: t ? `${aktifCount}/${totalOut} CABANG AKTIF` : 'SYNCING POS...',
      statusLevel: 'optimal',
      progressLabel: `PARTISIPASI CABANG (${pctOutletAktif}%)`,
      progressPersen: pctOutletAktif,
      metrik: isKemarin
        ? [
            {
              label: 'OMZET KEMARIN (H-1)',
              nilai: t ? `${fmtRpSingkat(omzetKemarin)} (${orderKemarin} struk)` : 'Memuat...',
              sorot: omzetKemarin > 0 ? 'good' : 'normal',
            },
            {
              label: 'RATA-RATA STRUK (AOV)',
              nilai: t ? fmtRpSingkat(t.ringkasanKemarin?.aov || t.aov || 0) : '-',
              sorot: 'normal',
            },
            {
              label: 'TOP #1 CABANG (H-1)',
              nilai: top1 ? `${top1.nama.replace(/^SUKA SHAWARMA\s+/i, '')} (${fmtRpSingkat(top1.omzet)})` : '-',
              sorot: 'good',
            },
            {
              label: 'MENU TERLARIS (H-1)',
              nilai: topMenu1 ? `${topMenu1.nama} (${topMenu1.qty} porsi)` : `${fmtRpSingkat(omzetHariIni)} (Live)`,
              sorot: 'normal',
            },
          ]
        : [
            {
              label: 'OMZET LIVE HARI INI',
              nilai: t ? `${fmtRpSingkat(omzetHariIni)} (${orderHariIni} struk)` : 'Memuat...',
              sorot: omzetHariIni > 0 ? 'good' : 'normal',
            },
            {
              label: 'CLOSING KEMARIN (H-1)',
              nilai: t ? `${fmtRpSingkat(omzetKemarin)} (${orderKemarin} struk)` : 'Memuat...',
              sorot: 'normal',
            },
            {
              label: 'RATA-RATA STRUK (AOV)',
              nilai: t ? fmtRpSingkat(t.aov || t.ringkasanKemarin?.aov || 0) : '-',
              sorot: 'normal',
            },
            {
              label: 'TOP #1 CABANG LIVE',
              nilai: top1 ? `${top1.nama.replace(/^SUKA SHAWARMA\s+/i, '')} (${fmtRpSingkat(top1.omzet)})` : '-',
              sorot: 'good',
            },
          ],
      aksiCepat: isKemarin
        ? [
            {
              label: '⚡ Evaluasi Sales H-1',
              query: 'Buat laporan evaluasi komprehensif kemarin (H-1) dari modul penjualan dan outlet network.',
            },
            {
              label: '🏆 Menu Laris & Cabang 0 Tx',
              query: 'Apa saja menu paling laris kemarin dan cabang mana yang nol transaksi?',
            },
          ]
        : [
            {
              label: '📊 Peringkat Omzet Live',
              query: 'Tampilkan peringkat omzet seluruh cabang live hari ini beserta menu terlaris.',
            },
            {
              label: '📈 Komparasi Hari Ini vs Kemarin',
              query: 'Bandingkan omzet berjalan hari ini dengan penutupan kemarin.',
            },
          ],
      namaAksiUtama: 'ANALISIS SALES',
    }
  }

  if (p === 'finance') {
    const opexHariIni = t?.finance?.pengeluaranHariIni?.totalNominal ?? 0
    const opexHariIniTx = t?.finance?.pengeluaranHariIni?.jumlahTransaksi ?? 0
    const opexKemarin = t?.finance?.pengeluaranKemarin?.totalNominal ?? 0
    const opexKemarinTx = t?.finance?.pengeluaranKemarin?.jumlahTransaksi ?? 0
    const setoranHariIni = t?.finance?.setoranKas?.inputHariIni?.totalNominal ?? 0
    const fisikKasKemarin = t?.finance?.setoranKas?.tutupShiftKemarin?.totalFisikKas ?? 0
    const sudahDirekapKemarin = t?.finance?.setoranKas?.tutupShiftKemarin?.sudahDirekap ?? 0
    const belumDirekapKemarin = t?.finance?.setoranKas?.tutupShiftKemarin?.belumDirekap ?? 0
    const utangTotal = t?.finance?.utangPo?.totalUtang ?? 0
    const overdue = t?.finance?.utangPo?.totalLewatJatuhTempo ?? 0

    const pctPoSehat =
      utangTotal > 0 ? Math.max(0, Math.min(100, Math.round(((utangTotal - overdue) / utangTotal) * 100))) : 100

    return {
      kode: `DIV-02 // TREASURY (${isKemarin ? 'H-1' : 'LIVE'})`,
      judul: 'FINANCE & RECONCILIATION',
      subjudul: isKemarin ? 'OPEX Kemarin, Kas Shift & Liabilitas PO' : 'Live Cash Flow, OPEX & Liabilitas PO',
      icon: DollarSign,
      statusLabel: overdue > 0 ? 'PO OVERDUE ALERT' : 'TREASURY SEHAT',
      statusLevel: overdue > 0 ? 'critical' : belumDirekapKemarin > 0 ? 'warning' : 'optimal',
      progressLabel: `RASIO PO BELUM JATUH TEMPO (${pctPoSehat}%)`,
      progressPersen: pctPoSehat,
      metrik: isKemarin
        ? [
            {
              label: 'OPEX / KAS KECIL (H-1)',
              nilai: t ? `${fmtRpSingkat(opexKemarin)} (${opexKemarinTx} tx)` : 'Memuat...',
              sorot: 'normal',
            },
            {
              label: 'KAS TUTUP SHIFT (H-1)',
              nilai: t
                ? `${fmtRpSingkat(fisikKasKemarin)} (${sudahDirekapKemarin} rekap/${belumDirekapKemarin} blm)`
                : 'Memuat...',
              sorot: belumDirekapKemarin > 0 ? 'warn' : 'good',
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
          ]
        : [
            {
              label: 'OPEX LIVE HARI INI',
              nilai: t ? `${fmtRpSingkat(opexHariIni)} (${opexHariIniTx} tx)` : 'Memuat...',
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
      aksiCepat: isKemarin
        ? [
            {
              label: '💸 Rekap OPEX & Kas Kemarin',
              query: 'Rincikan pengeluaran OPEX kemarin, kas fisik tutup shift, dan selisih kasir.',
            },
            {
              label: '⚠️ Cek Utang PO Overdue',
              query: 'Rincikan utang PO supplier yang sudah lewat jatuh tempo dan total liabilitas.',
            },
          ]
        : [
            {
              label: '💰 OPEX & Setoran Live',
              query: 'Bagaimana rincian pengeluaran OPEX & setoran kas live hari ini?',
            },
            {
              label: '⚠️ Tagihan PO Hari Ini',
              query: 'Rincikan utang PO supplier yang jatuh tempo hari ini atau minggu ini.',
            },
          ],
      namaAksiUtama: 'AUDIT TREASURY',
    }
  }

  if (p === 'gudang') {
    const buka = t?.statusBuka?.totalBuka ?? 0
    const belumBuka = t?.statusBuka?.totalBelumBuka ?? 0
    const totalCabang = buka + belumBuka
    const closedKemarin = t?.statusBuka?.shiftKemarinClosedCount ?? t?.finance?.setoranKas?.tutupShiftKemarin?.jumlahOutletClosed ?? 0
    const pctShift = isKemarin
      ? (totalCabang > 0 ? Math.min(100, Math.round((closedKemarin / totalCabang) * 100)) : 100)
      : (totalCabang > 0 ? Math.min(100, Math.round((buka / totalCabang) * 100)) : 100)
    const voidCount = isKemarin
      ? (t?.voidOrder?.totalVoidKemarin ?? 0)
      : (t?.voidOrder?.totalVoidHariIni ?? 0)
    const voidRp = isKemarin
      ? (t?.voidOrder?.totalNilaiVoidKemarin ?? 0)
      : (t?.voidOrder?.totalNilaiVoidHariIni ?? 0)
    const wasteRp = t?.waste?.totalEstKerugianRp ?? 0
    const topWaste = t?.waste?.topBahan?.[0]

    return {
      kode: `DIV-03 // OPS & LOSS PREV (${isKemarin ? 'H-1' : 'LIVE'})`,
      judul: 'OPS, VOID & WASTE RADAR',
      subjudul: isKemarin ? 'Closing Shift, Void & Audit Waste' : 'Kesiapan Cabang, Void & Waste Live',
      icon: Package,
      statusLabel: voidCount > 0 ? `${voidCount} VOID TERCATAT` : 'AUDIT BERSIH',
      statusLevel: voidCount > 0 ? 'warning' : 'optimal',
      progressLabel: isKemarin
        ? `TUTUP SHIFT KEMARIN (${pctShift}%)`
        : `CABANG BUKA OPERASIONAL (${pctShift}%)`,
      progressPersen: pctShift,
      metrik: [
        {
          label: isKemarin ? 'SHIFT CLOSED KEMARIN' : 'SHIFT KASIR CABANG',
          nilai: t
            ? isKemarin
              ? `${closedKemarin}/${totalCabang} Cabang Closed`
              : `${buka} Buka • ${belumBuka} Belum Buka`
            : 'Memuat...',
          sorot: isKemarin ? 'good' : belumBuka === 0 ? 'good' : 'warn',
        },
        {
          label: isKemarin ? 'VOID POS KEMARIN (H-1)' : 'VOID POS HARI INI',
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
      aksiCepat: isKemarin
        ? [
            {
              label: '🥬 Laporan Bahan Baku Waste',
              query: 'Analisis laporan bahan baku waste tertinggi dan rekap tutup shift kemarin.',
            },
            {
              label: '🚨 Investigasi Void POS',
              query: 'Cek transaksi void kasir kemarin, cabang mana yang mencatat void atau selisih shift?',
            },
          ]
        : [
            {
              label: '🏬 Status Buka Cabang',
              query: 'Cabang mana yang belum buka & apakah ada transaksi void hari ini?',
            },
            {
              label: '🥬 Pantau Kerugian Waste',
              query: 'Analisis laporan waste bahan baku dan estimasi kerugian tertinggi bulan ini.',
            },
          ],
      namaAksiUtama: 'INSPEKSI OPS & WASTE',
    }
  }

  // Default: HRD & Customer Experience (Review)
  const onTimePct = isKemarin ? (t?.hrdKemarin?.persenOnTime ?? 100) : (t?.persenOnTime ?? 100)
  const hadirTotal = isKemarin ? (t?.hrdKemarin?.kehadiranTotal ?? 0) : (t?.kehadiranTotal ?? 0)
  const telatCount = isKemarin ? (t?.hrdKemarin?.kehadiranTelat ?? 0) : (t?.kehadiranTelat ?? 0)
  const cutiCount = isKemarin ? (t?.hrdKemarin?.stafCutiIzin?.length ?? 0) : (t?.stafCutiIzin?.length ?? 0)
  const rating = t?.review?.ratingRataRata ?? 4.8
  const totalUlasan = t?.review?.totalUlasan ?? 0
  const komplainCount = t?.review?.ulasanNegatifTerbaru?.length ?? 0

  return {
    kode: `DIV-04 // WORKFORCE & REVIEW (${isKemarin ? 'H-1' : 'LIVE'})`,
    judul: 'HRD & CUSTOMER SENTIMENT',
    subjudul: isKemarin ? 'Presensi Kru & Sentimen Google Review' : 'Live Presensi & Sentimen Google Review',
    icon: Users,
    statusLabel: telatCount > 0 ? `${telatCount} TELAT (${isKemarin ? 'H-1' : 'LIVE'})` : `ON-TIME ${onTimePct}%`,
    statusLevel: telatCount > 3 ? 'warning' : 'optimal',
    progressLabel: `DISIPLIN PRESENSI (${onTimePct}% ON-TIME)`,
    progressPersen: Math.max(0, Math.min(100, onTimePct)),
    metrik: [
      {
        label: isKemarin ? 'PRESENSI KRU (H-1)' : 'PRESENSI KRU HARI INI',
        nilai: t ? `${onTimePct}% On-Time (${hadirTotal} clock-in)` : 'Memuat...',
        sorot: onTimePct >= 90 ? 'good' : 'warn',
      },
      {
        label: isKemarin ? 'TELAT / CUTI KEMARIN' : 'TERLAMBAT / IZIN CUTI',
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
    aksiCepat: isKemarin
      ? [
          {
            label: '⏱️ Rekap Keterlambatan Kru',
            query: 'Siapa saja kru cabang yang terlambat atau izin/cuti kemarin?',
          },
          {
            label: '⭐ Komplain Google Review',
            query: 'Tampilkan ulasan negatif pelanggan terbaru di Google Review dan keluhan utamanya.',
          },
        ]
      : [
          {
            label: '👥 Presensi Roster Shift',
            query: 'Siapa saja kru cabang yang terlambat atau belum presensi hari ini?',
          },
          {
            label: '⭐ Sentimen Pelanggan Live',
            query: 'Bagaimana rating Google Maps dan feedback kepuasan pelanggan hari ini?',
          },
        ],
    namaAksiUtama: 'EVALUASI HRD & REVIEW',
  }
}

interface AgentNodeCardProps {
  meja?: MejaKantor | null
  profilFallback: Profil
  telemetri?: TelemetriHariIni | null
  modeWaktu?: 'kemarin' | 'hari_ini'
  terpilih: boolean
  onPilih: (profil: Profil, pesanAwal?: string) => void
  className?: string
}

export default function AgentNodeCard({
  meja,
  profilFallback,
  telemetri,
  modeWaktu = 'kemarin',
  terpilih,
  onPilih,
  className,
}: AgentNodeCardProps) {
  const profil = meja?.profil ?? profilFallback
  const vis = bangunVisualDivisi(profil, telemetri, modeWaktu)
  const IconComponent = vis.icon

  // Semantic Status Styling (Mengikuti kaidah Coherence: Status color = severity, not decoration)
  const badgeStyle =
    vis.statusLevel === 'critical'
      ? 'text-red-300 border-red-500/60 bg-red-950/70'
      : vis.statusLevel === 'warning'
        ? 'text-amber-300 border-amber-500/50 bg-amber-950/70'
        : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/70'

  const StatusIcon = vis.statusLevel === 'optimal' ? CheckCircle2 : AlertTriangle

  const handleTanyaJarvis = (pertanyaan?: string) => {
    mainkanSuaraHud('engage')
    const defaultPrompt = vis.aksiCepat[0]?.query || `Analisis data terbaru divisi ${vis.judul}`
    onPilih('ceo', pertanyaan || defaultPrompt)
  }

  return (
    <div
      className={`relative group rounded-xl p-3 sm:p-3.5 transition-all duration-300 backdrop-blur-xl border flex flex-col justify-between ${
        terpilih
          ? 'bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400/70 shadow-[0_0_24px_rgba(6,182,212,0.28)]'
          : 'bg-zinc-950/80 border-cyan-500/20 hover:border-cyan-400/50 hover:bg-zinc-900/80 hover:shadow-[0_4px_24px_rgba(6,182,212,0.12)]'
      } ${className || ''}`}
    >
      {/* Reticle Corners (Unified Cyan/Teal HUD language) */}
      <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none" />
      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
      <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none" />
      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none" />

      {/* Header Card: Division Code & Live Telemetry Severity Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/15 pb-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <span className="font-mono-hud text-xs tracking-wider text-cyan-300 font-bold uppercase truncate">
            {vis.kode}
          </span>
        </div>

        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono-hud uppercase tracking-wider border shrink-0 font-semibold ${badgeStyle}`}
        >
          <StatusIcon className="w-3 h-3" />
          <span>{vis.statusLabel}</span>
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="p-2 rounded-lg border bg-cyan-950/60 border-cyan-500/30 text-cyan-300 group-hover:scale-105 group-hover:border-cyan-400 transition-all shrink-0">
          <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-hud text-xs sm:text-sm font-bold text-white tracking-wider group-hover:text-cyan-200 transition-colors truncate">
            {vis.judul}
          </h3>
          <p className="font-mono-hud text-xs text-zinc-400 truncate">
            {vis.subjudul}
          </p>
        </div>
      </div>

      {/* Division Telemetry Progress Bar */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between font-mono-hud text-[11px] text-zinc-400 mb-1">
          <span className="truncate">{vis.progressLabel}</span>
          <span className="font-bold text-cyan-300">{vis.progressPersen}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-cyan-500/15">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-400 transition-all duration-700"
            style={{ width: `${Math.max(4, vis.progressPersen)}%` }}
          />
        </div>
      </div>

      {/* Live 4-Row Division Telemetry Readout */}
      <div className="space-y-1.5 bg-black/50 rounded-xl p-2.5 border border-cyan-500/15 font-mono-hud">
        {vis.metrik.map((m, idx) => {
          const warnaNilai =
            m.sorot === 'crit'
              ? 'text-red-400 font-bold'
              : m.sorot === 'warn'
                ? 'text-amber-300 font-semibold'
                : m.sorot === 'good'
                  ? 'text-emerald-300 font-semibold'
                  : 'text-cyan-100'
          return (
            <div key={idx} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400 shrink-0 text-[11px]">{m.label}</span>
              <span className={`truncate text-right ${warnaNilai}`}>{m.nilai}</span>
            </div>
          )
        })}
      </div>

      {/* Quick Action Prompt Chips (Non-truncating, Action-Oriented Microcopy) */}
      <div className="mt-2.5 pt-2 border-t border-cyan-500/15 flex flex-col gap-1.5">
        {vis.aksiCepat.map((aksi, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleTanyaJarvis(aksi.query)
            }}
            className="w-full text-left font-mono-hud text-xs px-2.5 py-1.5 rounded-lg border border-cyan-500/15 bg-cyan-950/30 hover:bg-cyan-900/50 hover:border-cyan-400/60 text-cyan-200 transition-all cursor-pointer flex items-center justify-between gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
            title={aksi.query}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="font-medium truncate">{aksi.label}</span>
            </div>
            <span className="text-[10px] text-cyan-400/60 uppercase font-hud shrink-0">&gt;&gt;</span>
          </button>
        ))}
      </div>

      {/* Contextual Division Action Button */}
      <button
        type="button"
        onClick={() => handleTanyaJarvis()}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-hud text-xs tracking-wider uppercase font-bold transition-all cursor-pointer bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/35 shadow-[0_0_16px_rgba(6,182,212,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-200" />
        <span>{vis.namaAksiUtama}</span>
      </button>
    </div>
  )
}
