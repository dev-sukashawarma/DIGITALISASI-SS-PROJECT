// apps/admin-dashboard/src/app/dashboard/owner/closing-hub/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileCheck,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  Building2,
  Store,
  HeartHandshake,
  TrendingUp,
  RefreshCw,
  Lock,
  Eye,
  ShieldCheck,
  Package,
  ShoppingCart,
  Users,
  Tags,
  Banknote
} from 'lucide-react'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@suka/auth'
import { PageHeader } from '@/components/ui'
import { rupiah } from '@/lib/format'
import { DIVISION_FULL_REPORTS, OUTLETS_19_DATA } from './divisionReportsData'
import { exportDivisionToExcel, exportMasterConsolidatedToExcel } from './eomExcelExporter'
import { exportDivisionToPdf, exportMasterConsolidatedToPdf } from './eomPdfExporter'


interface EomPeriod {
  id: string
  bulan: number
  tahun: number
  cut_off_at: string
  status: 'open' | 'all_verified' | 'finalized'
  finalized_at: string | null
  finalized_by: string | null
}

interface EomSubmission {
  id: string
  period_id: string
  divisi: string
  app_source: string
  judul_dokumen: string
  status: 'draft' | 'verified' | 'rejected'
  ringkasan_data: Record<string, any>
  dokumen_url: string | null
  catatan: string | null
  nama_pic: string
  role_pic: string
  verified_at: string
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const DIVISIONS_CONFIG = [
  {
    key: 'kasir_outlet',
    name: 'Operasional Kasir & Kas Toko',
    appSource: 'apps/finance (Audit Kasir)',
    docTitle: 'Berita Acara Rekapitulasi Kasir & Kas Toko',
    icon: Store,
    picRole: 'Finance Admin / SPV Kasir',
    color: 'from-amber-500 to-orange-600',
    description: 'Rekap shift blind close, variance uang fisik, setoran bank 19 cabang, dan nota kas kecil laci kasir.',
    mockSummary: {
      'Total Shift Terdata': '570 Shift',
      'Total Setoran Bank': 'Rp 542.150.000',
      'Selisih Kas (Variance)': 'Rp 0 (Matched)',
      'Kas Kecil Kasir Terpakai': 'Rp 8.420.000',
    }
  },
  {
    key: 'kitchen_stok',
    name: 'Kitchen & Gudang (Stok Opname)',
    appSource: 'apps/stok & distribusi',
    docTitle: 'Berita Acara Stock Opname & Kerugian Stok',
    icon: Package,
    picRole: 'SPV Kitchen / Gudang',
    color: 'from-blue-600 to-indigo-700',
    description: 'Hasil opname fisik serentak 19 outlet + gudang, kerugian shrinkage (Rp), dan kerugian food waste (Rp).',
    mockSummary: {
      'Nilai Stok Fisik Akhir': 'Rp 148.600.000',
      'Kerugian Waste (Bahan Rusak)': 'Rp 4.250.000',
      'Selisih Stok (Shrinkage)': 'Rp 2.180.000',
      'Status Surat Jalan': '100% Selesai (0 Pending)',
    }
  },
  {
    key: 'purchasing',
    name: 'Purchasing & Tagihan Supplier',
    appSource: 'apps/finance (Pengadaan)',
    docTitle: 'Berita Acara Pembelian & Hutang Dagang',
    icon: ShoppingCart,
    picRole: 'Purchasing Lead',
    color: 'from-cyan-600 to-teal-700',
    description: 'Matching 3-way PO-GRN-Invoice, tagihan supplier jatuh tempo (AP aging), dan deviasi harga bahan pokok.',
    mockSummary: {
      'Total Pembelian (PO)': 'Rp 215.300.000',
      'Invoice Lunas': 'Rp 160.000.000',
      'Hutang Jatuh Tempo': 'Rp 55.300.000',
      'Deviasi Harga Pokok': '+1.2% (Daging Ayam)',
    }
  },
  {
    key: 'hr_payroll',
    name: 'HR & Payroll Karyawan',
    appSource: 'apps/HR & absensi',
    docTitle: 'Berita Acara Absensi, Bonus & Register Gaji',
    icon: Users,
    picRole: 'Admin HR / Head of People',
    color: 'from-emerald-600 to-green-700',
    description: 'Rekap absensi tuntas (sakit, izin, alpha), lembur tervalidasi, bonus omzet kru outlet, dan payroll final.',
    mockSummary: {
      'Total Karyawan Aktif': '94 Kru & Staf',
      'Tingkat Kehadiran': '98.4%',
      'Bonus Omzet Kru': 'Rp 18.450.000',
      'Total Beban Gaji (Payroll)': 'Rp 138.200.000',
    }
  },
  {
    key: 'marcom',
    name: 'Marketing & Komunikasi (Marcom)',
    appSource: 'apps/marcom',
    docTitle: 'Berita Acara Biaya Iklan & Promosi',
    icon: Tags,
    picRole: 'Marcom Lead',
    color: 'from-fuchsia-600 to-pink-700',
    description: 'Realisasi biaya iklan berbayar (Meta & TikTok Ads), honorarium endorsement/KOL, dan cetak materi promosi POSM.',
    mockSummary: {
      'Ad Spend Meta & TikTok': 'Rp 14.500.000',
      'Honorarium Influencer/KOL': 'Rp 7.000.000',
      'Cetak POSM & Kemasan': 'Rp 4.200.000',
      'Sales Uplift Aggregator': '+14.8% MoM',
    }
  },
  {
    key: 'finance_akuntansi',
    name: 'Finance & Rekonsiliasi Bank',
    appSource: 'apps/finance (Rekonsiliasi)',
    docTitle: 'Berita Acara Rekonsiliasi Bank & Agregator',
    icon: Banknote,
    picRole: 'Finance Controller / Lead',
    color: 'from-rose-600 to-red-700',
    description: 'Rekonsiliasi rekening koran 100%, selisih pencairan online food (GoFood, Grab, Shopee, TikTok), dan OPEX kantor pusat.',
    mockSummary: {
      'Rekonsiliasi Bank': '100% Cocok (0 Selisih)',
      'Gross Sales Aggregator': 'Rp 210.400.000',
      'Net Cair ke Rekening': 'Rp 168.320.000 (Pot. 20%)',
      'OPEX Kantor Pusat': 'Rp 38.450.000',
    }
  },
]

export default function EomClosingHubPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<EomPeriod | null>(null)
  const [submissions, setSubmissions] = useState<Record<string, EomSubmission>>({})
  const [activeModalDoc, setActiveModalDoc] = useState<any | null>(null)
  const [activeConsolidationTab, setActiveConsolidationTab] = useState<'global' | 'internal' | 'external'>('global')
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  // Fetch EOM Closing Data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Coba ambil data periode dari Supabase
      const { data: periodData, error: periodErr } = await supabase
        .from('eom_closing_periods')
        .select('*')
        .eq('bulan', month)
        .eq('tahun', year)
        .maybeSingle()

      if (periodErr) {
        // Jika tabel belum dieksekusi di database Supabase, aktifkan mode demo interaktif
        console.warn('EOM database table not yet applied, running in interactive simulation mode:', periodErr.message)
        setIsDemoMode(true)
        setPeriod({
          id: 'demo-period',
          bulan: month,
          tahun: year,
          cut_off_at: new Date(year, month, 0, 23, 59, 59).toISOString(),
          status: 'open',
          finalized_at: null,
          finalized_by: null,
        })

        // Sediakan sampel data: 3 divisi terverifikasi, 3 pending untuk pengujian interaktif
        setSubmissions((prev) => {
          if (Object.keys(prev).length > 0) return prev
          return {
            kasir_outlet: {
              id: 'demo-1',
              period_id: 'demo-period',
              divisi: 'kasir_outlet',
              app_source: 'apps/finance',
              judul_dokumen: 'Berita Acara Rekapitulasi Kasir & Kas Toko',
              status: 'verified',
              ringkasan_data: DIVISIONS_CONFIG[0].mockSummary,
              dokumen_url: null,
              catatan: 'Seluruh setoran 19 outlet telah diverifikasi cocok dengan rekening penampung.',
              nama_pic: 'Fajar Nugraha',
              role_pic: 'SPV Kasir & Finance',
              verified_at: new Date(year, month - 1, 1, 14, 20).toISOString(),
            },
            kitchen_stok: {
              id: 'demo-2',
              period_id: 'demo-period',
              divisi: 'kitchen_stok',
              app_source: 'apps/stok',
              judul_dokumen: 'Berita Acara Stock Opname & Kerugian Stok',
              status: 'verified',
              ringkasan_data: DIVISIONS_CONFIG[1].mockSummary,
              dokumen_url: null,
              catatan: 'Stock opname serentak selesai tgl 31 malam. Waste terkendali di bawah batas toleransi 1%.',
              nama_pic: 'Budi Santoso',
              role_pic: 'SPV Kitchen & Logistik',
              verified_at: new Date(year, month - 1, 2, 11, 45).toISOString(),
            },
            hr_payroll: {
              id: 'demo-3',
              period_id: 'demo-period',
              divisi: 'hr_payroll',
              app_source: 'apps/HR',
              judul_dokumen: 'Berita Acara Absensi, Bonus & Register Gaji',
              status: 'verified',
              ringkasan_data: DIVISIONS_CONFIG[3].mockSummary,
              dokumen_url: null,
              catatan: 'Absensi 94 staf tuntas. Slip gaji telah di-review bersama SPV masing-masing outlet.',
              nama_pic: 'Sarah Melinda',
              role_pic: 'Admin HR',
              verified_at: new Date(year, month - 1, 2, 17, 30).toISOString(),
            },
          }
        })
        return
      }

      setIsDemoMode(false)
      setPeriod(periodData || null)

      // 2. Ambil data submisi nyata jika tabel sudah ada
      if (periodData) {
        const { data: subsData, error: subsErr } = await supabase
          .from('eom_closing_submissions')
          .select('*')
          .eq('period_id', periodData.id)

        if (subsErr) throw subsErr

        const map: Record<string, EomSubmission> = {}
        subsData?.forEach((sub: EomSubmission) => {
          map[sub.divisi] = sub
        })
        setSubmissions(map)
      } else {
        setSubmissions({})
      }
    } catch (err: any) {
      console.error('Error fetching EOM closing data:', err)
      toast.error('Gagal memuat data closing: ' + (err.message || 'Error'))
    } finally {
      setLoading(false)
    }
  }, [month, year, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Hitung jumlah verified
  const verifiedCount = useMemo(() => {
    return Object.values(submissions).filter((s) => s.status === 'verified').length
  }, [submissions])

  const allVerified = verifiedCount >= 6
  const isFinalized = period?.status === 'finalized'

  // Handler: Verifikasi Dokumen Divisi
  const handleVerifyDivision = async (config: typeof DIVISIONS_CONFIG[0]) => {
    if (isDemoMode) {
      setSubmissions((prev) => ({
        ...prev,
        [config.key]: {
          id: 'demo-' + config.key,
          period_id: period?.id || 'demo-period',
          divisi: config.key,
          app_source: config.appSource,
          judul_dokumen: config.docTitle,
          status: 'verified',
          ringkasan_data: config.mockSummary,
          dokumen_url: null,
          catatan: 'Diverifikasi langsung melalui EOM Closing Hub (Simulasi Pengujian).',
          nama_pic: 'Super Admin',
          role_pic: 'Owner / Admin',
          verified_at: new Date().toISOString(),
        }
      }))
      toast.success(`[Simulasi] Berhasil memverifikasi dokumen: ${config.name}`)
      return
    }

    try {
      const { error } = await supabase.rpc('submit_eom_verification', {
        p_bulan: month,
        p_tahun: year,
        p_divisi: config.key,
        p_app_source: config.appSource,
        p_judul_dokumen: config.docTitle,
        p_ringkasan_data: config.mockSummary,
        p_catatan: `Diverifikasi via EOM Closing Hub Admin pada ${new Date().toLocaleDateString('id-ID')}`
      })

      if (error) throw error

      toast.success(`Berhasil memverifikasi dokumen: ${config.name}`)
      fetchData()
    } catch (err: any) {
      toast.error('Gagal memverifikasi: ' + (err.message || 'Error'))
    }
  }

  // Handler: Finalisasi Konsolidasi Akhir Bulan
  const handleFinalizeReport = async () => {
    if (!allVerified) {
      toast.error('Belum semua divisi terverifikasi (minimal 6 divisi)!')
      return
    }

    if (!confirm('Apakah Anda yakin ingin menerbitkan dan mengunci Laporan Konsolidasi Akhir Bulan ini? Data buku akan difinalisasi.')) {
      return
    }

    if (isDemoMode) {
      setPeriod((prev) => prev ? { ...prev, status: 'finalized', finalized_at: new Date().toISOString() } : null)
      toast.success('Selamat! [Simulasi] Laporan Konsolidasi Akhir Bulan berhasil diterbitkan & dikunci permanen.')
      return
    }

    setIsFinalizing(true)
    try {
      const { error } = await supabase.rpc('finalize_eom_closing', {
        p_bulan: month,
        p_tahun: year
      })

      if (error) throw error

      toast.success('Selamat! Laporan Konsolidasi Akhir Bulan berhasil diterbitkan & dikunci.')
      fetchData()
    } catch (err: any) {
      toast.error('Gagal finalisasi laporan: ' + (err.message || 'Error'))
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Period Filter */}
      <PageHeader
        title="EOM Closing HUB"
        description="Pusat kontrol verifikasi penutupan buku akhir bulan 6 divisi & penerbitan Master Report konsolidasi"
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-bold bg-white text-suka-brown outline-none focus:border-suka-orange shadow-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-bold bg-white text-suka-brown outline-none focus:border-suka-orange shadow-sm"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-white rounded-xl border border-suka-gray-200 hover:bg-suka-cream/30 text-suka-brown transition-colors shadow-sm"
            title="Muat Ulang Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </PageHeader>

      {/* Mode Simulasi Banner */}
      {isDemoMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-extrabold uppercase text-[10px] shrink-0">
              MODE SIMULASI INTERAKTIF
            </span>
            <span className="text-amber-800 text-[11px]">
              Anda dapat menguji klik tombol <b>Verif</b>, membuka modal Berita Acara, dan menerbitkan Master Report. Untuk mengaktifkan sinkronisasi database live permanen, jalankan file SQL migrasi di Supabase SQL Editor.
            </span>
          </div>
        </div>
      )}

      {/* 2. Banner Status & Golden Rules Closing */}
      <div className="bg-gradient-to-r from-suka-brown via-amber-900 to-suka-brown text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <FileCheck size={240} />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isFinalized
                  ? 'bg-emerald-500 text-white'
                  : allVerified
                  ? 'bg-amber-400 text-suka-brown'
                  : 'bg-white/20 text-white'
              }`}>
                {isFinalized ? '🔒 FINALIZED / TERKUNCI' : allVerified ? '⭐ SIAP DITERBITKAN' : '⏳ DALAM PENGUMPULAN DATA'}
              </span>
              <span className="text-white/60 text-xs">|</span>
              <span className="text-xs font-medium text-amber-200 flex items-center gap-1">
                <Clock size={13} />
                Hard Deadline: Tanggal 5 Pukul 17:00 WIB
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Tutup Buku Periode {MONTHS[month - 1]} {year}
            </h2>
            <p className="text-white/80 text-xs max-w-2xl leading-relaxed">
              Setiap aplikasi satelit meng-generate dokumen Berita Acara (BA) resmi. Setelah diverifikasi PIC masing-masing aplikasi, status kartu akan berubah menjadi terverifikasi secara real-time.
            </p>
          </div>

          {/* Progress Box */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4 min-w-[240px] text-center md:text-right shrink-0">
            <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
              Status Verifikasi Divisi
            </div>
            <div className="text-3xl font-black mt-1">
              <span className={verifiedCount === 6 ? 'text-emerald-400' : 'text-amber-400'}>
                {verifiedCount}
              </span>
              <span className="text-white/40"> / 6 Divisi</span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full transition-all duration-500 ${
                  verifiedCount === 6 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ width: `${(verifiedCount / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Grid 6 Kartu Divisi */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-suka-brown flex items-center gap-2">
            <ShieldCheck size={18} className="text-suka-orange" />
            Checklist & Verifikasi 6 Divisi
          </h3>
          <span className="text-xs text-suka-gray-500">
            {allVerified ? 'Semua divisi sudah tuntas' : `Masih menunggu ${6 - verifiedCount} divisi lagi`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DIVISIONS_CONFIG.map((config, index) => {
            const Icon = config.icon
            const sub = submissions[config.key]
            const isVerified = sub?.status === 'verified'

            return (
              <div
                key={config.key}
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm ${
                  isVerified
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10'
                    : 'border-suka-gray-200 hover:border-suka-orange/40'
                }`}
              >
                {/* Header Kartu */}
                <div className="p-5 border-b border-suka-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${config.color} text-white flex items-center justify-center shadow-sm`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase text-suka-orange tracking-wider">
                          Divisi 0{index + 1}
                        </div>
                        <h4 className="text-sm font-extrabold text-suka-ink leading-tight">
                          {config.name}
                        </h4>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isVerified ? (
                        <>
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          VERIFIED
                        </>
                      ) : (
                        <>
                          <Clock size={11} className="text-amber-600 animate-pulse" />
                          PENDING
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-[11px] text-suka-gray-500 leading-relaxed mb-3">
                    {config.description}
                  </div>

                  <div className="bg-suka-cream/30 rounded-xl p-2.5 space-y-1 text-[11px]">
                    <div className="flex justify-between text-suka-gray-600">
                      <span className="text-suka-gray-400">Aplikasi Sumber:</span>
                      <span className="font-mono font-semibold text-suka-brown">{config.appSource}</span>
                    </div>
                    <div className="flex justify-between text-suka-gray-600">
                      <span className="text-suka-gray-400">Wewenang PIC:</span>
                      <span className="font-semibold text-suka-brown">{config.picRole}</span>
                    </div>
                  </div>
                </div>

                {/* Body: Ringkasan Data & Status Verifikator */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {isVerified ? (
                    <div className="space-y-3">
                      <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                        <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                          Diverifikasi Oleh:
                        </div>
                        <div className="text-xs font-extrabold text-suka-ink mt-0.5">
                          {sub.nama_pic || 'PIC Divisi'} ({sub.role_pic || 'SPV'})
                        </div>
                        <div className="text-[10px] text-suka-gray-500 mt-0.5">
                          {new Date(sub.verified_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })} WIB
                        </div>
                      </div>

                      {/* Cuplikan Angka */}
                      <div className="space-y-1 text-xs">
                        {Object.entries(sub.ringkasan_data || config.mockSummary).slice(0, 2).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-suka-gray-600">
                            <span className="text-suka-gray-400">{k}:</span>
                            <span className="font-bold text-suka-ink">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                      <div className="text-xs font-bold text-suka-brown">
                        Menunggu Verifikasi PIC
                      </div>
                      <p className="text-[11px] text-suka-gray-400 max-w-[220px] mx-auto">
                        PIC belum memverifikasi dokumen Berita Acara di {config.appSource}.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setActiveModalDoc({
                          config,
                          submission: sub,
                        })
                      }
                      className="flex-1 py-2 px-2.5 bg-white border border-suka-gray-200 hover:bg-suka-cream/30 text-suka-brown rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                    >
                      <Eye size={13} className="text-suka-orange" />
                      Detail BA
                    </button>

                    <button
                      onClick={() => {
                        toast.info(`Men-generate Dokumen PDF Resmi (${config.name})...`)
                        try {
                          exportDivisionToPdf(config.key, MONTHS[month - 1], year)
                          toast.success(`Laporan PDF ${config.name} (19 Outlet) berhasil diunduh!`)
                        } catch (err) {
                          console.error(err)
                          toast.error('Gagal mengunduh PDF laporan')
                        }
                      }}
                      title="Download Laporan Resmi PDF (Termasuk Lampiran 19 Outlet Lengkap)"
                      className="py-2 px-2.5 bg-white border border-suka-gray-200 hover:bg-red-50 text-red-700 hover:border-red-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                    >
                      <Printer size={13} />
                      PDF
                    </button>

                    <button
                      onClick={() => {
                        toast.info(`Menyiapkan File Excel (${config.name})...`)
                        try {
                          exportDivisionToExcel(config.key, MONTHS[month - 1], year)
                          toast.success(`Workbook Excel ${config.name} (2 Sheet) berhasil diunduh!`)
                        } catch (err) {
                          console.error(err)
                          toast.error('Gagal mengunduh file Excel')
                        }
                      }}
                      title="Download Laporan Lengkap Excel (2 Sheet: BA + 19 Outlet)"
                      className="py-2 px-2.5 bg-white border border-suka-gray-200 hover:bg-emerald-50 text-emerald-700 hover:border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                    >
                      <Download size={13} />
                      Excel
                    </button>

                    {!isVerified && !isFinalized && (
                      <button
                        onClick={() => handleVerifyDivision(config)}
                        title="Bypass verifikasi dari Admin Dashboard"
                        className="py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                      >
                        <CheckCircle2 size={13} />
                        Verif
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 4. Master Action Bar (Penerbitan Laporan Konsolidasi) */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isFinalized
          ? 'bg-emerald-50 border-emerald-200'
          : allVerified
          ? 'bg-amber-50/80 border-amber-200'
          : 'bg-white border-suka-gray-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold text-suka-ink flex items-center gap-2">
              <FileCheck size={20} className={allVerified ? 'text-emerald-600' : 'text-suka-gray-400'} />
              Penerbitan Laporan Konsolidasi Akhir Bulan (Master Report)
            </h4>
            <p className="text-xs text-suka-gray-500 max-w-2xl leading-relaxed">
              {isFinalized
                ? 'Laporan konsolidasi periode ini sudah difinalisasi dan dikunci secara permanen. Seluruh data transaksi terkunci.'
                : allVerified
                ? 'Semua 6 divisi sudah terverifikasi! Anda dapat menerbitkan dan mengunci Laporan Konsolidasi 3 Tab (Global, Internal, External).'
                : `Tombol penerbitan otomatis aktif setelah seluruh 6 divisi terverifikasi oleh PIC masing-masing (masih kurang ${6 - verifiedCount} divisi).`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isFinalized ? (
              <button
                disabled={!allVerified || isFinalizing}
                onClick={handleFinalizeReport}
                className={`px-5 py-3 rounded-xl text-xs font-black tracking-wide flex items-center gap-2 transition-all shadow-md ${
                  allVerified
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                    : 'bg-suka-gray-200 text-suka-gray-400 cursor-not-allowed'
                }`}
              >
                <Lock size={15} />
                {isFinalizing ? 'Memfinalisasi...' : 'TERBITKAN & KUNCI MASTER REPORT'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Status: Terkunci Permanen
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Tampilan Laporan Konsolidasi (3 Tab: Global, Internal, External) */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-suka-gray-200 bg-suka-cream/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-suka-brown flex items-center gap-2">
              <TrendingUp size={18} className="text-suka-orange" />
              Laporan Laba Rugi Konsolidasi F&B ({MONTHS[month - 1]} {year})
            </h3>
            <p className="text-xs text-suka-gray-500 mt-0.5">
              Pemisahan 3 pilar: Konsolidasi Global, Outlet Internal (Pusat), dan Outlet External (Mitra).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toast.info('Men-generate Dokumen PDF Konsolidasi Master...')
                try {
                  exportMasterConsolidatedToPdf(MONTHS[month - 1], year)
                  toast.success('Laporan Konsolidasi Master PDF (3 Pilar + 19 Outlet) berhasil diunduh!')
                } catch (err) {
                  console.error(err)
                  toast.error('Gagal mengunduh PDF Master')
                }
              }}
              className="px-3 py-2 bg-white border border-suka-gray-200 hover:bg-suka-cream/30 text-suka-brown rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer size={13} className="text-suka-orange" />
              Cetak PDF Master
            </button>
            <button
              onClick={() => {
                toast.info('Men-generate File Excel Konsolidasi Master...')
                try {
                  exportMasterConsolidatedToExcel(MONTHS[month - 1], year)
                  toast.success('Workbook Excel Konsolidasi Master (2 Sheet) berhasil diunduh!')
                } catch (err) {
                  console.error(err)
                  toast.error('Gagal mengunduh Excel Master')
                }
              }}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download size={13} />
              Ekspor Excel Master
            </button>
          </div>

        </div>

        {/* Tab Selector */}
        <div className="border-b border-suka-gray-200 px-6 flex gap-8">
          <button
            onClick={() => setActiveConsolidationTab('global')}
            className={`py-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
              activeConsolidationTab === 'global'
                ? 'border-suka-orange text-suka-orange'
                : 'border-transparent text-suka-gray-400 hover:text-suka-brown'
            }`}
          >
            <Building2 size={15} />
            Tab 1: Global (Total Perusahaan)
          </button>
          <button
            onClick={() => setActiveConsolidationTab('internal')}
            className={`py-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
              activeConsolidationTab === 'internal'
                ? 'border-suka-orange text-suka-orange'
                : 'border-transparent text-suka-gray-400 hover:text-suka-brown'
            }`}
          >
            <Store size={15} />
            Tab 2: Outlet Internal (Pusat)
          </button>
          <button
            onClick={() => setActiveConsolidationTab('external')}
            className={`py-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
              activeConsolidationTab === 'external'
                ? 'border-suka-orange text-suka-orange'
                : 'border-transparent text-suka-gray-400 hover:text-suka-brown'
            }`}
          >
            <HeartHandshake size={15} />
            Tab 3: Outlet External (Mitra)
          </button>
        </div>

        {/* Tab Content Display */}
        <div className="p-6">
          <ConsolidationTableView tab={activeConsolidationTab} />
        </div>
      </div>

      {/* 6. Modal Pop-up: Dokumen Resmi & Laporan Lengkap Divisi */}
      {activeModalDoc && (() => {
        const fullReport = DIVISION_FULL_REPORTS[activeModalDoc.config.key]
        const docNumber = `${fullReport?.codePrefix || 'BA/SS'}/${year}/${String(month).padStart(2, '0')}`

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-suka-gray-300 animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Top Bar (Non-Printable) */}
              <div className="px-6 py-4 bg-suka-brown text-white flex items-center justify-between no-print border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-suka-orange flex items-center justify-center font-bold text-white shadow-sm">
                    SS
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      Dokumen Resmi Laporan Divisi: {activeModalDoc.config.name}
                    </h3>
                    <p className="text-[11px] text-amber-200/90 font-mono">
                      No: {docNumber} | Periode: {MONTHS[month - 1]} {year}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      toast.info(`Men-generate Dokumen PDF Resmi (${activeModalDoc.config.name})...`)
                      try {
                        exportDivisionToPdf(activeModalDoc.config.key, MONTHS[month - 1], year)
                        toast.success(`Dokumen PDF Resmi Berita Acara & 19 Outlet berhasil diunduh!`)
                      } catch (err) {
                        console.error(err)
                        toast.error('Gagal mengunduh file PDF')
                      }
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Printer size={13} />
                    Cetak / Unduh PDF
                  </button>
                  <button
                    onClick={() => {
                      toast.info(`Menyiapkan File Excel (${activeModalDoc.config.name})...`)
                      try {
                        exportDivisionToExcel(activeModalDoc.config.key, MONTHS[month - 1], year)
                        toast.success(`Workbook Excel (2 Sheet + 19 Outlet) berhasil diunduh!`)
                      } catch (err) {
                        console.error(err)
                        toast.error('Gagal mengunduh file Excel')
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Download size={13} />
                    Ekspor Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => setActiveModalDoc(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors ml-2"
                  >
                    ✕
                  </button>
                </div>

              </div>

              {/* Printable Document Body */}
              <div id="printable-division-report" className="p-8 overflow-y-auto flex-1 space-y-6 text-suka-ink bg-white font-sans">
                {/* Official Letterhead (KOP SURAT) */}
                <div className="border-b-2 border-suka-brown pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div className="space-y-1">
                    <div className="text-xl font-black text-suka-brown tracking-tight">
                      SUKA SHAWARMA INDONESIA
                    </div>
                    <div className="text-xs font-extrabold text-suka-orange uppercase tracking-wider">
                      PT SUKA KULINER NUSANTARA — DIVISI AUDIT & KEUANGAN
                    </div>
                    <div className="text-[11px] text-suka-gray-500">
                      Jl. Pajajaran No. 45, Bogor • Telp: (0251) 832-1234 • Email: finance@sukashawarma.com
                    </div>
                  </div>

                  <div className="text-left sm:text-right space-y-1 text-xs">
                    <div className="inline-block px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-extrabold uppercase text-[10px] tracking-wider border border-emerald-300">
                      {activeModalDoc.submission?.status === 'verified' ? 'RESMI: VERIFIED & LOCKED' : 'DRAFT LAPORAN'}
                    </div>
                    <div className="font-mono text-suka-brown font-bold text-xs">
                      No: {docNumber}
                    </div>
                    <div className="text-suka-gray-500 text-[11px]">
                      Cut-off: 30/31 {MONTHS[month - 1]} {year} 23:59 WIB
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center py-2 space-y-1">
                  <h2 className="text-base sm:text-lg font-black uppercase text-suka-brown tracking-wide">
                    {fullReport?.title || activeModalDoc.config.docTitle}
                  </h2>
                  <p className="text-xs text-suka-gray-600 max-w-2xl mx-auto">
                    {fullReport?.subtitle || activeModalDoc.config.description}
                  </p>
                </div>

                {/* Meta Audit Box */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-suka-cream/30 border border-suka-gray-200 rounded-xl p-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-suka-gray-400 uppercase block">Aplikasi Sumber</span>
                    <span className="font-semibold text-suka-brown">{activeModalDoc.config.appSource}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-suka-gray-400 uppercase block">Penanggung Jawab (PIC)</span>
                    <span className="font-bold text-suka-ink">{activeModalDoc.submission?.nama_pic || activeModalDoc.config.picRole}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-suka-gray-400 uppercase block">Wewenang / Jabatan</span>
                    <span className="font-medium text-suka-gray-700">{activeModalDoc.submission?.role_pic || fullReport?.verifiedByRole}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-suka-gray-400 uppercase block">Waktu Verifikasi</span>
                    <span className="font-mono text-suka-gray-700">
                      {activeModalDoc.submission?.verified_at
                        ? new Date(activeModalDoc.submission.verified_at).toLocaleString('id-ID') + ' WIB'
                        : 'Menunggu Verifikasi'}
                    </span>
                  </div>
                </div>

                {/* Summary KPI Cards */}
                {fullReport?.summaryKpis && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {fullReport.summaryKpis.map((kpi: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${
                          kpi.isHighlight
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-white border-suka-gray-200'
                        }`}
                      >
                        <div className="text-[10px] uppercase font-bold text-suka-gray-500 tracking-wider">
                          {kpi.label}
                        </div>
                        <div className={`text-sm font-black mt-0.5 ${kpi.isHighlight ? 'text-suka-brown' : 'text-suka-ink'}`}>
                          {kpi.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full Tabular Breakdown Table */}
                {fullReport && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-suka-brown tracking-wider">
                        Tabel Data Rinci & Rekapitulasi:
                      </h4>
                      <span className="text-[11px] text-suka-gray-400">
                        Total {fullReport.rows.length} Baris Data
                      </span>
                    </div>

                    <div className="border border-suka-gray-200 rounded-xl overflow-x-auto shadow-sm">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-suka-brown text-white">
                            {fullReport.columns.map((col: any) => (
                              <th
                                key={col.key}
                                className={`py-2.5 px-3 font-bold border-r border-white/10 last:border-r-0 ${
                                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                }`}
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-suka-gray-100 font-medium">
                          {fullReport.rows.map((row: any, rIdx: number) => (
                            <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-suka-cream/10'}>
                              {fullReport.columns.map((col: any) => {
                                const val = row[col.key]
                                return (
                                  <td
                                    key={col.key}
                                    className={`py-2 px-3 border-r border-suka-gray-100 last:border-r-0 ${
                                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                    } ${col.isBold ? 'font-bold text-suka-ink' : 'text-suka-gray-700'}`}
                                  >
                                    {col.isCurrency && typeof val === 'number' ? rupiah(val) : String(val ?? '-')}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Lampiran I: Breakdown Detail Per Cabang Outlet (19 Cabang) */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase text-suka-brown tracking-wider flex items-center gap-1.5">
                      <Store size={14} className="text-suka-orange" />
                      Lampiran I: Rekapitulasi Detail Per Cabang Outlet (19 Cabang)
                    </h4>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      19/19 Cabang Verified (100%)
                    </span>
                  </div>

                  <div className="border border-suka-gray-200 rounded-xl overflow-x-auto shadow-sm max-h-72">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-800 text-white">
                        <tr>
                          <th className="py-2 px-2 text-center w-8">No</th>
                          <th className="py-2 px-3 text-left">Nama Cabang Outlet</th>
                          <th className="py-2 px-2.5 text-center">Tipe</th>
                          <th className="py-2 px-3 text-right">Omzet POS</th>
                          <th className="py-2 px-3 text-right">Setoran Bank</th>
                          <th className="py-2 px-2.5 text-right">Kas Kecil</th>
                          <th className="py-2 px-3 text-right">Stok Fisik</th>
                          <th className="py-2 px-2.5 text-right">Waste + Shrink</th>
                          <th className="py-2 px-2 text-center">Kru</th>
                          <th className="py-2 px-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-suka-gray-100 font-medium text-[11px]">
                        {OUTLETS_19_DATA.map((o, idx) => (
                          <tr key={o.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                            <td className="py-1.5 px-2 text-center text-suka-gray-400">{o.no}</td>
                            <td className="py-1.5 px-3 font-bold text-suka-ink">{o.name}</td>
                            <td className="py-1.5 px-2.5 text-center text-suka-gray-500">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                o.isInternal ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}>
                                {o.isInternal ? 'Internal' : 'Mitra'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-suka-ink">{rupiah(o.grossPos)}</td>
                            <td className="py-1.5 px-3 text-right text-emerald-700 font-semibold">{rupiah(o.bankDeposit)}</td>
                            <td className="py-1.5 px-2.5 text-right text-suka-gray-600">{rupiah(o.pettyCash)}</td>
                            <td className="py-1.5 px-3 text-right text-suka-gray-700">{rupiah(o.stockAsset)}</td>
                            <td className="py-1.5 px-2.5 text-right text-rose-600">{rupiah(o.wasteRp + o.shrinkageRp)}</td>
                            <td className="py-1.5 px-2 text-center text-suka-gray-600">{o.crewCount}</td>
                            <td className="py-1.5 px-2.5 text-center text-emerald-600 font-bold">100%</td>
                          </tr>
                        ))}
                        {/* Baris Total */}
                        <tr className="bg-amber-100/80 font-black text-amber-950 border-t-2 border-amber-300">
                          <td colSpan={3} className="py-2 px-3 text-left">
                            TOTAL KONSOLIDASI (19 OUTLET)
                          </td>
                          <td className="py-2 px-3 text-right">
                            {rupiah(OUTLETS_19_DATA.reduce((a, b) => a + b.grossPos, 0))}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-800">
                            {rupiah(OUTLETS_19_DATA.reduce((a, b) => a + b.bankDeposit, 0))}
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            {rupiah(OUTLETS_19_DATA.reduce((a, b) => a + b.pettyCash, 0))}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {rupiah(OUTLETS_19_DATA.reduce((a, b) => a + b.stockAsset, 0))}
                          </td>
                          <td className="py-2 px-2.5 text-right text-rose-700">
                            {rupiah(OUTLETS_19_DATA.reduce((a, b) => a + (b.wasteRp + b.shrinkageRp), 0))}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {OUTLETS_19_DATA.reduce((a, b) => a + b.crewCount, 0)}
                          </td>
                          <td className="py-2 px-2.5 text-center text-emerald-800">
                            100% CLOSED
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Catatan PIC */}
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 text-xs">
                  <span className="font-bold text-amber-900 block mb-1">Catatan Tambahan Lapangan & Verifikasi:</span>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    {activeModalDoc.submission?.catatan || fullReport?.notesDefault}
                  </p>
                </div>

                {/* Pernyataan Legal Berita Acara */}
                <div className="text-[11px] text-suka-gray-600 italic bg-suka-gray-50 border border-suka-gray-200 rounded-xl p-3 leading-relaxed">
                  "Dengan diterbitkannya Berita Acara ini, pihak-pihak bertanda tangan di bawah menyatakan bahwa data operasional, mutasi stok, serta transaksi keuangan yang tercantum di atas adalah benar, sah, dan telah dicocokkan dengan bukti fisik maupun log sistem tanpa ada yang disembunyikan."
                </div>

                {/* Lembar Tanda Tangan 3 Pihak */}
                <div className="pt-4 border-t border-suka-gray-200 grid grid-cols-3 gap-6 text-center text-xs">
                  <div className="space-y-12">
                    <div className="text-[11px] font-bold text-suka-gray-500 uppercase">
                      Disusun Oleh ({fullReport?.preparedByRole || 'PIC Divisi'})
                    </div>
                    <div>
                      <div className="font-bold text-suka-ink border-b border-suka-gray-400 inline-block px-4 pb-1">
                        {activeModalDoc.submission?.nama_pic || 'Staff Pelaksana'}
                      </div>
                      <div className="text-[10px] text-suka-gray-400 mt-0.5">Staf Operasional / PIC</div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="text-[11px] font-bold text-suka-gray-500 uppercase">
                      Diverifikasi Oleh ({fullReport?.verifiedByRole || 'SPV Divisi'})
                    </div>
                    <div>
                      <div className="font-bold text-suka-ink border-b border-suka-gray-400 inline-block px-4 pb-1">
                        {activeModalDoc.submission?.nama_pic ? activeModalDoc.submission.nama_pic : 'Supervisor Terkait'}
                      </div>
                      <div className="text-[10px] text-suka-gray-400 mt-0.5">SPV / Koordinator Divisi</div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="text-[11px] font-bold text-suka-gray-500 uppercase">
                      Disetujui Oleh (Direksi / Owner)
                    </div>
                    <div>
                      <div className="font-bold text-suka-ink border-b border-suka-gray-400 inline-block px-4 pb-1">
                        H. Manajemen Suka Shawarma
                      </div>
                      <div className="text-[10px] text-suka-gray-400 mt-0.5">Finance Director / Owner</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Non-Printable) */}
              <div className="p-4 border-t border-suka-gray-200 bg-suka-cream/20 flex flex-wrap justify-between items-center gap-3 no-print shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      toast.info(`Men-generate Dokumen PDF Resmi (${activeModalDoc.config.name})...`)
                      try {
                        exportDivisionToPdf(activeModalDoc.config.key, MONTHS[month - 1], year)
                        toast.success(`Dokumen PDF Resmi Berita Acara & 19 Outlet berhasil diunduh!`)
                      } catch (err) {
                        console.error(err)
                        toast.error('Gagal mengunduh file PDF')
                      }
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Printer size={14} />
                    Cetak / Unduh PDF Resmi
                  </button>
                  <button
                    onClick={() => {
                      toast.info(`Menyiapkan File Excel (${activeModalDoc.config.name})...`)
                      try {
                        exportDivisionToExcel(activeModalDoc.config.key, MONTHS[month - 1], year)
                        toast.success(`Workbook Excel ${activeModalDoc.config.name} (2 Sheet) berhasil diunduh!`)
                      } catch (err) {
                        console.error(err)
                        toast.error('Gagal mengunduh file Excel')
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Download size={14} />
                    Ekspor Excel (.xlsx)
                  </button>
                </div>


                <button
                  onClick={() => setActiveModalDoc(null)}
                  className="px-6 py-2 bg-suka-brown hover:bg-suka-brown/90 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Tutup Laporan
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// Sub-komponen Tampilan Tabel Konsolidasi Laba Rugi 3 Pilar
function ConsolidationTableView({ tab }: { tab: 'global' | 'internal' | 'external' }) {
  // Mock Data Proporsional Sesuai Skenario
  const data = useMemo(() => {
    if (tab === 'global') {
      return {
        title: 'Konsolidasi Seluruh Jaringan (19 Outlet + Kantor Pusat)',
        grossSales: 620500000,
        discountsAndFee: 48500000,
        netRevenue: 572000000,
        cogs: 234520000, // 41%
        storeOpex: 137280000, // 24%
        hoOpex: 45760000, // 8%
        netProfit: 154440000, // 27%
      }
    } else if (tab === 'internal') {
      return {
        title: 'Konsolidasi Outlet Internal / Milik Pusat (12 Cabang)',
        grossSales: 395000000,
        discountsAndFee: 30800000,
        netRevenue: 364200000,
        cogs: 149322000, // 41%
        storeOpex: 87408000, // 24%
        hoOpex: 45760000, // Seluruh HO Opex dibebankan ke internal
        netProfit: 81710000, // 22.4%
      }
    } else {
      return {
        title: 'Konsolidasi Outlet External / Mitra Kemitraan (7 Cabang)',
        grossSales: 225500000,
        discountsAndFee: 17700000,
        netRevenue: 207800000,
        cogs: 85198000, // 41%
        storeOpex: 49872000, // 24%
        hoOpex: 0, // Tidak dibebani overhead pusat
        netProfit: 72730000, // Laba Bersih yang dibagi hasil ke mitra
      }
    }
  }, [tab])

  const grossProfit = data.netRevenue - data.cogs
  const grossProfitMargin = ((grossProfit / data.netRevenue) * 100).toFixed(1)
  const storeMargin = grossProfit - data.storeOpex
  const netMargin = ((data.netProfit / data.netRevenue) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="bg-suka-cream/20 p-4 rounded-xl border border-suka-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-suka-orange">
            Entitas Laporan:
          </span>
          <h4 className="text-sm font-extrabold text-suka-ink">{data.title}</h4>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-suka-gray-400 block text-[10px]">Net Margin %</span>
            <span className="font-extrabold text-emerald-700">{netMargin}%</span>
          </div>
          <div>
            <span className="text-suka-gray-400 block text-[10px]">Gross Margin %</span>
            <span className="font-extrabold text-suka-ink">{grossProfitMargin}%</span>
          </div>
        </div>
      </div>

      <div className="border border-suka-gray-200 rounded-2xl overflow-hidden text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-suka-brown text-white text-left">
              <th className="py-3 px-4 font-bold">Komponen Keuangan F&B</th>
              <th className="py-3 px-4 text-right font-bold">Nominal (Rp)</th>
              <th className="py-3 px-4 text-right font-bold">% Terhadap Net Rev</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            <tr className="bg-suka-cream/10">
              <td className="py-2.5 px-4 font-bold text-suka-ink">[+] Gross Sales (Omzet Kotor)</td>
              <td className="py-2.5 px-4 text-right font-bold text-suka-ink">{rupiah(data.grossSales)}</td>
              <td className="py-2.5 px-4 text-right text-suka-gray-500">-</td>
            </tr>
            <tr>
              <td className="py-2.5 px-4 pl-8 text-rose-700">[-] Diskon, Voucher & Komisi Aggregator</td>
              <td className="py-2.5 px-4 text-right text-rose-700">({rupiah(data.discountsAndFee)})</td>
              <td className="py-2.5 px-4 text-right text-rose-700">
                {((data.discountsAndFee / data.netRevenue) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="bg-emerald-50/40 font-bold border-t border-b border-emerald-200">
              <td className="py-3 px-4 text-emerald-900">(=) NET REVENUE (Pendapatan Bersih)</td>
              <td className="py-3 px-4 text-right text-emerald-900">{rupiah(data.netRevenue)}</td>
              <td className="py-3 px-4 text-right text-emerald-900">100.0%</td>
            </tr>

            {/* COGS */}
            <tr>
              <td className="py-2.5 px-4 text-suka-ink font-semibold">
                [-] TOTAL COGS / HPP (Bahan Pokok + Kemasan + Waste)
              </td>
              <td className="py-2.5 px-4 text-right font-semibold text-rose-700">({rupiah(data.cogs)})</td>
              <td className="py-2.5 px-4 text-right text-suka-gray-600">
                {((data.cogs / data.netRevenue) * 100).toFixed(1)}%
              </td>
            </tr>

            <tr className="bg-suka-cream/30 font-bold">
              <td className="py-2.5 px-4 text-suka-brown">(=) LABA KOTOR (GROSS PROFIT)</td>
              <td className="py-2.5 px-4 text-right text-suka-brown">{rupiah(grossProfit)}</td>
              <td className="py-2.5 px-4 text-right text-suka-brown">{grossProfitMargin}%</td>
            </tr>

            {/* Store Opex */}
            <tr>
              <td className="py-2.5 px-4 text-suka-ink font-semibold">
                [-] STORE OPEX (Gaji Kru, Listrik, Gas, Kas Kecil, Sewa Toko)
              </td>
              <td className="py-2.5 px-4 text-right font-semibold text-rose-700">
                ({rupiah(data.storeOpex)})
              </td>
              <td className="py-2.5 px-4 text-right text-suka-gray-600">
                {((data.storeOpex / data.netRevenue) * 100).toFixed(1)}%
              </td>
            </tr>

            <tr className="bg-teal-50/50 font-bold">
              <td className="py-2.5 px-4 text-teal-900">(=) KONTRIBUSI LABA OUTLET (STORE MARGIN)</td>
              <td className="py-2.5 px-4 text-right text-teal-900">{rupiah(storeMargin)}</td>
              <td className="py-2.5 px-4 text-right text-teal-900">
                {((storeMargin / data.netRevenue) * 100).toFixed(1)}%
              </td>
            </tr>

            {/* HO Opex */}
            {data.hoOpex > 0 && (
              <tr>
                <td className="py-2.5 px-4 text-suka-ink font-semibold">
                  [-] HEAD OFFICE OVERHEAD & MARKETING (Gaji Pusat, Ads, Server)
                </td>
                <td className="py-2.5 px-4 text-right font-semibold text-rose-700">
                  ({rupiah(data.hoOpex)})
                </td>
                <td className="py-2.5 px-4 text-right text-suka-gray-600">
                  {((data.hoOpex / data.netRevenue) * 100).toFixed(1)}%
                </td>
              </tr>
            )}

            {/* Net Operating Profit */}
            <tr className="bg-emerald-600 text-white font-extrabold text-sm border-t-2 border-emerald-800">
              <td className="py-3 px-4">
                {tab === 'external' ? '(=) LABA BERSIH DIBAGIKAN KE MITRA' : '(=) NET OPERATING PROFIT (EBITDA)'}
              </td>
              <td className="py-3 px-4 text-right">{rupiah(data.netProfit)}</td>
              <td className="py-3 px-4 text-right">{netMargin}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
