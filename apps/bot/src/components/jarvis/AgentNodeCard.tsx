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

type TemaWarnaDivisi = 'cyan' | 'amber' | 'emerald' | 'indigo'

interface DivisiVisual {
  kode: string
  judul: string
  subjudul: string
  tema: TemaWarnaDivisi
  icon: typeof TrendingUp
  statusLabel: string
  statusLevel: 'optimal' | 'warning' | 'critical'
  progressLabel: string
  progressPersen: number
  metrik: BarisMetrik[]
  contohPertanyaan: string[]
}

const TEMA_STYLE: Record<
  TemaWarnaDivisi,
  {
    cardSelected: string
    cardIdle: string
    corner: string
    dot: string
    kodeText: string
    iconBox: string
    titleHover: string
    subtitle: string
    barFill: string
    chip: string
    chipIcon: string
    ctaBtn: string
  }
> = {
  cyan: {
    cardSelected:
      'bg-cyan-950/45 border-cyan-400/85 shadow-[0_0_25px_rgba(6,182,212,0.32)] ring-1 ring-cyan-400',
    cardIdle:
      'bg-zinc-950/85 border-cyan-500/25 hover:border-cyan-400/60 hover:bg-zinc-900/85 hover:shadow-[0_0_18px_rgba(6,182,212,0.18)]',
    corner: 'border-cyan-400/75',
    dot: 'bg-cyan-400',
    kodeText: 'text-cyan-300',
    iconBox: 'bg-cyan-950/75 border-cyan-500/40 text-cyan-300',
    titleHover: 'group-hover:text-cyan-300',
    subtitle: 'text-cyan-400/75',
    barFill: 'from-cyan-500 to-sky-400',
    chip: 'bg-cyan-950/35 hover:bg-cyan-900/60 text-cyan-200 border-cyan-500/25 hover:border-cyan-400',
    chipIcon: 'text-cyan-400',
    ctaBtn:
      'from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 border-cyan-400/45 shadow-[0_0_12px_rgba(6,182,212,0.22)]',
  },
  amber: {
    cardSelected:
      'bg-amber-950/40 border-amber-400/85 shadow-[0_0_25px_rgba(245,158,11,0.3)] ring-1 ring-amber-400',
    cardIdle:
      'bg-zinc-950/85 border-amber-500/25 hover:border-amber-400/60 hover:bg-zinc-900/85 hover:shadow-[0_0_18px_rgba(245,158,11,0.16)]',
    corner: 'border-amber-400/75',
    dot: 'bg-amber-400',
    kodeText: 'text-amber-300',
    iconBox: 'bg-amber-950/75 border-amber-500/40 text-amber-300',
    titleHover: 'group-hover:text-amber-300',
    subtitle: 'text-amber-400/75',
    barFill: 'from-amber-500 to-yellow-400',
    chip: 'bg-amber-950/30 hover:bg-amber-900/55 text-amber-100 border-amber-500/25 hover:border-amber-400',
    chipIcon: 'text-amber-400',
    ctaBtn:
      'from-amber-600/80 to-orange-600/80 hover:from-amber-500 hover:to-orange-500 border-amber-400/45 shadow-[0_0_12px_rgba(245,158,11,0.22)]',
  },
  emerald: {
    cardSelected:
      'bg-emerald-950/40 border-emerald-400/85 shadow-[0_0_25px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400',
    cardIdle:
      'bg-zinc-950/85 border-emerald-500/25 hover:border-emerald-400/60 hover:bg-zinc-900/85 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)]',
    corner: 'border-emerald-400/75',
    dot: 'bg-emerald-400',
    kodeText: 'text-emerald-300',
    iconBox: 'bg-emerald-950/75 border-emerald-500/40 text-emerald-300',
    titleHover: 'group-hover:text-emerald-300',
    subtitle: 'text-emerald-400/75',
    barFill: 'from-emerald-500 to-teal-400',
    chip: 'bg-emerald-950/30 hover:bg-emerald-900/55 text-emerald-100 border-emerald-500/25 hover:border-emerald-400',
    chipIcon: 'text-emerald-400',
    ctaBtn:
      'from-emerald-600/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/45 shadow-[0_0_12px_rgba(16,185,129,0.22)]',
  },
  indigo: {
    cardSelected:
      'bg-indigo-950/45 border-indigo-400/85 shadow-[0_0_25px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400',
    cardIdle:
      'bg-zinc-950/85 border-indigo-500/25 hover:border-indigo-400/60 hover:bg-zinc-900/85 hover:shadow-[0_0_18px_rgba(99,102,241,0.16)]',
    corner: 'border-indigo-400/75',
    dot: 'bg-indigo-400',
    kodeText: 'text-indigo-300',
    iconBox: 'bg-indigo-950/75 border-indigo-500/40 text-indigo-300',
    titleHover: 'group-hover:text-indigo-300',
    subtitle: 'text-indigo-400/75',
    barFill: 'from-indigo-500 to-violet-400',
    chip: 'bg-indigo-950/35 hover:bg-indigo-900/55 text-indigo-100 border-indigo-500/25 hover:border-indigo-400',
    chipIcon: 'text-indigo-400',
    ctaBtn:
      'from-indigo-600/80 to-violet-600/80 hover:from-indigo-500 hover:to-violet-500 border-indigo-400/45 shadow-[0_0_12px_rgba(99,102,241,0.22)]',
  },
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
      subjudul: isKemarin ? 'Full Closing Yesterday (H-1) & Leaderboard' : 'Real-Time POS Revenue & Leaderboard',
      tema: 'cyan',
      icon: TrendingUp,
      statusLabel: t ? `${aktifCount}/${totalOut} AKTIF (${isKemarin ? 'H-1' : 'LIVE'})` : 'SYNCING POS...',
      statusLevel: 'optimal',
      progressLabel: `PARTISIPASI CABANG ${isKemarin ? 'KEMARIN' : 'HARI INI'} (${pctOutletAktif}%)`,
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
      contohPertanyaan: isKemarin
        ? [
            'Buat laporan evaluasi komprehensif kemarin dari semua modul aplikasi',
            'Apa saja menu paling laris kemarin dan cabang yang nol transaksi?',
          ]
        : [
            'Tampilkan peringkat omzet seluruh cabang live hari ini',
            'Bandingkan omzet berjalan hari ini dengan penutupan kemarin',
          ],
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
      subjudul: isKemarin ? 'Yesterday OPEX, Shift Cash & PO Liability' : 'Live Cash Flow, OPEX & Supplier Liability',
      tema: 'amber',
      icon: DollarSign,
      statusLabel: overdue > 0 ? 'PO OVERDUE ALERT' : 'TREASURY NOMINAL',
      statusLevel: overdue > 0 ? 'warning' : 'optimal',
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
      contohPertanyaan: isKemarin
        ? [
            'Rincikan pengeluaran OPEX kemarin, kas tutup shift kemarin, & selisih kasir',
            'Rincikan utang PO supplier & yang sudah lewat jatuh tempo',
          ]
        : [
            'Bagaimana rincian pengeluaran OPEX & setoran kas live hari ini?',
            'Rincikan utang PO supplier & yang jatuh tempo',
          ],
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
      subjudul: isKemarin ? 'Yesterday Shift Closing, Void & Waste Audit' : 'Live Shift Readiness, POS Void & Waste',
      tema: 'emerald',
      icon: Package,
      statusLabel: voidCount > 0 ? `${voidCount} VOID (${isKemarin ? 'H-1' : 'LIVE'})` : 'AUDIT BERSIH',
      statusLevel: voidCount > 0 ? 'warning' : 'optimal',
      progressLabel: isKemarin
        ? `REKAP TUTUP SHIFT KEMARIN (${pctShift}%)`
        : `KESIAPAN SHIFT KASIR CABANG (${pctShift}%)`,
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
      contohPertanyaan: isKemarin
        ? [
            'Analisis laporan waste bahan baku & cek transaksi void kemarin',
            'Cabang mana saja yang mencatat void atau selisih shift kemarin?',
          ]
        : [
            'Cabang mana yang belum buka & ada transaksi void hari ini?',
            'Analisis laporan waste bahan baku & kerugian tertinggi',
          ],
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
    subjudul: isKemarin ? 'Yesterday Attendance & Google Review Radar' : 'Live Attendance & Google Review Radar',
    tema: 'indigo',
    icon: Users,
    statusLabel: telatCount > 0 ? `${telatCount} TELAT (${isKemarin ? 'H-1' : 'LIVE'})` : `ON-TIME ${onTimePct}%`,
    statusLevel: telatCount > 3 ? 'warning' : 'optimal',
    progressLabel: `DISIPLIN PRESENSI ${isKemarin ? 'KEMARIN' : 'HARI INI'} (${onTimePct}% ON-TIME)`,
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
    contohPertanyaan: isKemarin
      ? [
          'Siapa saja kru cabang yang terlambat atau izin/cuti kemarin?',
          'Tampilkan ulasan negatif pelanggan terbaru di Google Review',
        ]
      : [
          'Siapa saja kru cabang yang terlambat atau izin hari ini?',
          'Tampilkan ulasan negatif pelanggan terbaru di Google Review',
        ],
  }
}

interface AgentNodeCardProps {
  meja?: MejaKantor | null
  profilFallback: Profil
  telemetri?: TelemetriHariIni | null
  modeWaktu?: 'kemarin' | 'hari_ini'
  terpilih: boolean
  onPilih: (profil: Profil, pesanAwal?: string) => void
}

export default function AgentNodeCard({
  meja,
  profilFallback,
  telemetri,
  modeWaktu = 'kemarin',
  terpilih,
  onPilih,
}: AgentNodeCardProps) {
  const profil = meja?.profil ?? profilFallback
  const vis = bangunVisualDivisi(profil, telemetri, modeWaktu)
  const tema = TEMA_STYLE[vis.tema]
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
        terpilih ? tema.cardSelected : tema.cardIdle
      }`}
    >
      {/* Reticle Corners */}
      <div className={`absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 ${tema.corner} pointer-events-none`} />
      <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 ${tema.corner} pointer-events-none`} />
      <div className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 ${tema.corner} pointer-events-none`} />
      <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 ${tema.corner} pointer-events-none`} />

      {/* Header Card: Division Code & Live Telemetry Status */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full ${tema.dot} animate-ping shrink-0`} />
          <span className={`font-mono-hud text-[9px] sm:text-[10px] tracking-widest ${tema.kodeText} font-bold uppercase truncate`}>
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
        <div className={`p-1.5 sm:p-2 rounded-lg border ${tema.iconBox} group-hover:scale-105 transition-transform shrink-0`}>
          <IconComponent className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`font-hud text-xs sm:text-sm font-bold text-white tracking-wider ${tema.titleHover} transition-colors truncate`}>
            {vis.judul}
          </h3>
          <p className={`font-mono-hud text-[9px] sm:text-[10px] ${tema.subtitle} truncate`}>
            {vis.subjudul}
          </p>
        </div>
      </div>

      {/* Mini Division Telemetry Progress Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between font-mono-hud text-[8px] sm:text-[9px] text-zinc-400 mb-0.5">
          <span className="truncate">{vis.progressLabel}</span>
          <span className={`font-bold ${tema.kodeText}`}>{vis.progressPersen}%</span>
        </div>
        <div className="w-full h-1 rounded-full bg-zinc-900 overflow-hidden border border-white/5">
          <div
            className={`h-full bg-gradient-to-r ${tema.barFill} transition-all duration-700`}
            style={{ width: `${Math.max(4, vis.progressPersen)}%` }}
          />
        </div>
      </div>

      {/* Live 4-Row Division Telemetry Readout */}
      <div className="space-y-1 bg-black/60 rounded-lg p-2 border border-white/10 font-mono-hud">
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
            <div key={idx} className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
              <span className="text-zinc-400 shrink-0">{m.label}</span>
              <span className={`truncate text-right ${warnaNilai}`}>{m.nilai}</span>
            </div>
          )
        })}
      </div>

      {/* Quick Ask Jarvis Chips */}
      <div className="mt-2 pt-1.5 border-t border-white/10 flex flex-col gap-1">
        {vis.contohPertanyaan.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleTanyaJarvis(q)
            }}
            className={`w-full text-left font-mono-hud text-[9px] sm:text-[10px] px-2 py-1 rounded border transition-all cursor-pointer truncate flex items-center gap-1 ${tema.chip}`}
            title={q}
          >
            <Sparkles className={`w-2.5 h-2.5 ${tema.chipIcon} shrink-0`} />
            <span className="truncate">{q}</span>
          </button>
        ))}
      </div>

      {/* Analyze Division via J.A.R.V.I.S. Button */}
      <button
        type="button"
        onClick={() => handleTanyaJarvis()}
        className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg font-hud text-[10px] tracking-wider uppercase font-bold transition-all cursor-pointer bg-gradient-to-r text-white border ${tema.ctaBtn}`}
      >
        <Radio className="w-3 h-3 animate-pulse" />
        <span>ANALISIS DIVISI VIA J.A.R.V.I.S.</span>
      </button>
    </div>
  )
}
