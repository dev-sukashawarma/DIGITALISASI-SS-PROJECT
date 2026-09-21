'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Calendar,
  Download,
  FileEdit,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Truck,
  Store,
  Printer,
} from 'lucide-react'
import {
  fetchAccessibleOutlets,
  fetchOpnameSessions,
  fetchReconciliationSnapshot,
  type OpnameSessionSummary,
  type ReconciliationSnapshotResponse,
} from '@/app/actions/jurnalMutasi'
import { useOutletScope } from '@/hooks/useOutletScope'
import { exportReconciliationToCsv } from '@/lib/export/exportJurnalMutasi'
import { exportReconciliationToPdf } from '@/lib/export/exportJurnalMutasiPdf'
import { RekonsiliasiTable } from './RekonsiliasiTable'
import { AuditNotesModal } from './AuditNotesModal'

interface JurnalMutasiDashboardProps {
  initialOutletId?: string | null
}

export function JurnalMutasiDashboard({ initialOutletId }: JurnalMutasiDashboardProps) {
  const searchParams = useSearchParams()
  const urlOutletId = searchParams.get('outletId')
  const initialOpnameId = searchParams.get('opnameId')

  const { boundOutlets, selectedOutletId, setSelectedOutletId: syncGlobalOutlet } = useOutletScope()

  // Outlet State
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>(
    boundOutlets && boundOutlets.length > 0 ? boundOutlets : []
  )
  const [outletsLoading, setOutletsLoading] = useState(
    !(boundOutlets && boundOutlets.length > 0)
  )
  const [currentOutletId, setCurrentOutletId] = useState<string>(
    urlOutletId || selectedOutletId || initialOutletId || ''
  )

  // Mode Rekonsiliasi: 'opname_session' vs 'date_range'
  const [mode, setMode] = useState<'opname_session' | 'date_range'>('opname_session')

  // Sesi Opname State
  const [sessions, setSessions] = useState<OpnameSessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [selectedOpnameId, setSelectedOpnameId] = useState<string>(initialOpnameId || '')

  // Date Range State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Reconciliation Snapshot Data State
  const [data, setData] = useState<ReconciliationSnapshotResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Export Loading States
  const [pdfExporting, setPdfExporting] = useState(false)

  // Audit Notes Modal State
  const [showNotesModal, setShowNotesModal] = useState(false)

  // 1. Sinkronisasi boundOutlets dari hook useOutletScope
  useEffect(() => {
    if (boundOutlets && boundOutlets.length > 0) {
      setOutlets(boundOutlets)
      setOutletsLoading(false)
      if (!currentOutletId) {
        setCurrentOutletId(selectedOutletId || boundOutlets[0].id)
      }
    }
  }, [boundOutlets, currentOutletId, selectedOutletId])

  // 2. Sinkronisasi jika user mengganti outlet di Top Navbar (OutletSwitcher)
  useEffect(() => {
    if (selectedOutletId && selectedOutletId !== currentOutletId) {
      setCurrentOutletId(selectedOutletId)
    }
  }, [selectedOutletId, currentOutletId])

  // 3. Pastikan currentOutletId selalu valid di antara daftar outlets
  useEffect(() => {
    if (outlets.length > 0 && !outlets.some((o) => o.id === currentOutletId)) {
      const fallbackId = (selectedOutletId && outlets.some((o) => o.id === selectedOutletId))
        ? selectedOutletId
        : outlets[0].id
      setCurrentOutletId(fallbackId)
    }
  }, [outlets, currentOutletId, selectedOutletId])

  // 4. Fetch Accessible Outlets dari server sebagai sumber verifikasi otoritatif
  useEffect(() => {
    let active = true
    fetchAccessibleOutlets()
      .then((res) => {
        if (active && res && res.length > 0) {
          setOutlets(res)
          setOutletsLoading(false)
          if (!currentOutletId) {
            setCurrentOutletId(res[0].id)
          }
        }
      })
      .catch((err) => {
        if (active) {
          setOutletsLoading(false)
          console.error('Gagal memuat daftar outlet dari server:', err)
        }
      })

    return () => {
      active = false
    }
  }, [])

  // 5. Fetch Sesi Opname ketika outlet berubah
  useEffect(() => {
    let active = true
    if (!currentOutletId) return

    setSessionsLoading(true)
    fetchOpnameSessions(currentOutletId)
      .then((res) => {
        if (active) {
          setSessions(res)
          setSessionsLoading(false)
          if (res.length > 0) {
            const matched = res.find((s) => s.id === initialOpnameId)
            setSelectedOpnameId(matched ? matched.id : res[0].id)
          } else {
            setSelectedOpnameId('')
          }
        }
      })
      .catch((err) => {
        if (active) {
          setSessionsLoading(false)
          console.error('Gagal memuat sesi opname:', err)
        }
      })

    return () => {
      active = false
    }
  }, [currentOutletId, initialOpnameId])

  // 6. Fetch Detail Rekonsiliasi Snapshot
  const loadReconciliationData = useCallback(async () => {
    if (!currentOutletId) return
    if (mode === 'opname_session' && !selectedOpnameId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetchReconciliationSnapshot(currentOutletId, {
        mode,
        opnameId: mode === 'opname_session' ? selectedOpnameId : undefined,
        startDate: mode === 'date_range' ? startDate : undefined,
        endDate: mode === 'date_range' ? endDate : undefined,
      })
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Gagal memuat laporan rekonsiliasi mutasi')
    } finally {
      setLoading(false)
    }
  }, [currentOutletId, mode, selectedOpnameId, startDate, endDate])

  useEffect(() => {
    if (currentOutletId) {
      loadReconciliationData()
    }
  }, [currentOutletId, loadReconciliationData])

  const handleSelectOutlet = (id: string) => {
    setCurrentOutletId(id)
    syncGlobalOutlet(id)
  }

  const handleExportPdf = async () => {
    if (!data) return
    setPdfExporting(true)
    try {
      await exportReconciliationToPdf(data)
    } catch (err) {
      console.error('Gagal mengekspor PDF:', err)
    } finally {
      setPdfExporting(false)
    }
  }

  const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

  return (
    <div className="space-y-5 pb-20">
      {/* ========================================================================= */}
      {/* 1. KONTROL UTAMA: PEMILIH OUTLET, SESI OPNAME, & TOMBOL AKSI EKSPOR      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 border border-suka-brown/10 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Outlet & Title */}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-suka-orange/15 text-suka-orange">
                Audit Persediaan Bahan Baku
              </span>
              <span className="text-xs font-black text-suka-brown/60">
                • {data?.outlet.name || 'Pilih Cabang'}
              </span>
            </div>
            <h2 className="text-xl font-black text-suka-brown tracking-tight mt-1">
              Rekonsiliasi Mutasi & Jurnal Bahan Baku
            </h2>
            <p className="text-xs text-suka-brown/60 font-medium mt-0.5">
              Melacak alur stok: Saldo Awal + Kiriman Masuk - Pemakaian Menu POS - Waste = Stok Sistem vs Fisik Opname.
            </p>
          </div>

          {/* Action Buttons: Ekspor PDF, Excel, Catatan Audit, Refresh */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => loadReconciliationData()}
              disabled={loading}
              className="p-2.5 bg-suka-cream/40 hover:bg-suka-cream text-suka-brown border border-suka-brown/15 rounded-2xl transition-all active:scale-95 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-suka-orange' : ''}`} />
            </button>

            {data && (
              <>
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <FileEdit className="w-4 h-4 text-amber-600" />
                  <span>Catatan Audit</span>
                </button>

                <button
                  onClick={handleExportPdf}
                  disabled={pdfExporting}
                  className="px-4 py-2.5 bg-[#701604] hover:bg-[#8B1E06] text-white rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                >
                  {pdfExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  ) : (
                    <Printer className="w-4 h-4 text-amber-300" />
                  )}
                  <span>Cetak PDF</span>
                </button>

                <button
                  onClick={() => exportReconciliationToCsv(data)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel/CSV</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter Controls: Pilih Outlet & Cut-off Periode */}
        <div className="pt-3 border-t border-suka-brown/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Dropdown Pemilih Outlet */}
          <div className="flex items-center gap-2 bg-suka-cream/30 border border-suka-brown/20 rounded-2xl px-3.5 py-2 w-full md:w-auto">
            <Store className="w-4 h-4 text-suka-orange shrink-0" />
            <label className="text-xs font-black text-suka-brown/70 whitespace-nowrap">Cabang:</label>
            {outletsLoading && outlets.length === 0 ? (
              <span className="text-xs text-suka-brown/40">Memuat cabang...</span>
            ) : (
              <select
                value={currentOutletId}
                onChange={(e) => handleSelectOutlet(e.target.value)}
                className="bg-transparent text-xs font-black text-suka-brown outline-none cursor-pointer flex-1 md:w-56 truncate"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sesi Opname / Date Range */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Switcher */}
            <div className="flex items-center p-1 bg-suka-cream/30 rounded-xl border border-suka-brown/15">
              <button
                onClick={() => setMode('opname_session')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  mode === 'opname_session'
                    ? 'bg-white text-suka-brown shadow-2xs'
                    : 'text-suka-brown/60 hover:text-suka-brown'
                }`}
              >
                Sesi Opname
              </button>
              <button
                onClick={() => setMode('date_range')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  mode === 'date_range'
                    ? 'bg-white text-suka-brown shadow-2xs'
                    : 'text-suka-brown/60 hover:text-suka-brown'
                }`}
              >
                Rentang Tanggal
              </button>
            </div>

            {/* Sesi Opname Select */}
            {mode === 'opname_session' ? (
              sessionsLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-suka-brown/50">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat sesi...
                </div>
              ) : sessions.length === 0 ? (
                <span className="text-xs font-bold text-red-600">Belum ada opname final</span>
              ) : (
                <select
                  value={selectedOpnameId}
                  onChange={(e) => setSelectedOpnameId(e.target.value)}
                  className="px-3 py-2 bg-suka-cream/20 border border-suka-brown/20 rounded-xl text-xs font-bold text-suka-brown outline-none focus:border-suka-orange cursor-pointer"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.tanggal} ({s.tipe}) • Oleh: {s.created_by_name || 'Staff'} ({s.status})
                    </option>
                  ))}
                </select>
              )
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-suka-cream/20 border border-suka-brown/20 rounded-xl px-2.5 py-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-suka-brown/50" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-suka-brown font-bold outline-none text-xs cursor-pointer"
                  />
                </div>
                <span className="text-xs font-bold text-suka-brown/40">s/d</span>
                <div className="flex items-center gap-1.5 bg-suka-cream/20 border border-suka-brown/20 rounded-xl px-2.5 py-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-suka-brown/50" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-suka-brown font-bold outline-none text-xs cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Periode Cut-Off Badge */}
        {data && (
          <div className="p-3 bg-suka-cream/20 rounded-2xl border border-suka-brown/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-suka-brown/60">Periode Audit:</span>
              <span className="font-black text-suka-brown">
                {new Date(data.period.start_date).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-suka-brown/40" />
              <span className="font-black text-suka-brown">
                {new Date(data.period.end_date).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {data.period.opname_sebelumnya && (
                <span className="text-[11px] font-bold text-suka-brown/60">
                  Baseline Saldo Awal: Opname {data.period.opname_sebelumnya.tanggal}
                </span>
              )}
              {data.period.opname_terpilih && data.period.mode === 'date_range' && (
                <span className="text-[11px] font-bold text-suka-orange bg-suka-orange/10 px-2 py-0.5 rounded-md">
                  Fisik Opname: {data.period.opname_terpilih.tanggal} ({data.period.opname_terpilih.tipe})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pending Surat Jalan Alert */}
      {data && data.pending_surat_jalan_count > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-3xl p-4 flex items-center gap-3 text-amber-900 shadow-2xs">
          <Truck className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <span className="font-black">Peringatan Cut-Off Surat Jalan: </span>
            Ada <span className="font-black underline">{data.pending_surat_jalan_count} Surat Jalan</span> yang belum diverifikasi saat opname dilakukan. Jika fisik sudah tiba tapi belum tercatat di sistem, selisih fisik terlihat lebih banyak (surplus semu)!
          </div>
        </div>
      )}

      {/* Saved Audit Note Banner */}
      {data?.audit_note && (
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-4 text-blue-900 text-xs flex items-start gap-3 shadow-2xs">
          <FileEdit className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-black">Catatan Hasil Temuan Audit Manajemen:</span>
            <p className="mt-1 font-medium">{data.audit_note}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-3xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-suka-orange" />
          <p className="text-suka-brown font-black uppercase tracking-wider text-xs">
            Menghitung Jurnal Mutasi & Rincian Pemakaian Menu...
          </p>
          <p className="text-suka-brown/60 text-xs">
            Mengagregasi penerimaan, pesanan menu kasir POS, laporan waste, dan selisih opname.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RINGKASAN VALUASI NOMINAL (MINIMALIST EXECUTIVE SUMMARY)               */}
      {/* ========================================================================= */}
      {!loading && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Saldo Awal */}
            <div className="bg-white p-3.5 rounded-2xl border border-suka-brown/10 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-suka-brown/60">
                1. Saldo Awal
              </span>
              <div className="text-sm sm:text-base font-black text-suka-brown">
                {formatRp(data.totals.total_awal_rp)}
              </div>
              <p className="text-[9px] text-suka-brown/40 font-bold">Stok awal periode</p>
            </div>

            {/* Masuk */}
            <div className="bg-white p-3.5 rounded-2xl border border-suka-brown/10 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                2. Masuk (Inbound)
              </span>
              <div className="text-sm sm:text-base font-black text-emerald-700">
                +{formatRp(data.totals.total_masuk_rp_master)}
              </div>
              <p className="text-[9px] text-emerald-700/60 font-bold">Kiriman & Pembelian</p>
            </div>

            {/* Pemakaian Menu POS */}
            <div className="bg-white p-3.5 rounded-2xl border border-suka-brown/10 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                3. Pemakaian Menu
              </span>
              <div className="text-sm sm:text-base font-black text-blue-700">
                -{formatRp(data.totals.total_pakai_rp)}
              </div>
              <p className="text-[9px] text-blue-700/60 font-bold">Serapan Resep BOM</p>
            </div>

            {/* Waste */}
            <div className="bg-white p-3.5 rounded-2xl border border-suka-brown/10 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-600">
                4. Waste / Rusak
              </span>
              <div className="text-sm sm:text-base font-black text-red-600">
                -{formatRp(data.totals.total_waste_rp)}
              </div>
              <p className="text-[9px] text-red-600/60 font-bold">Laporan kerusakan</p>
            </div>

            {/* Stok Sistem */}
            <div className="bg-white p-3.5 rounded-2xl border border-suka-brown/10 shadow-2xs space-y-0.5 bg-suka-cream/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-suka-brown">
                5. Stok Sistem
              </span>
              <div className="text-sm sm:text-base font-black text-suka-brown">
                {formatRp(data.totals.total_sistem_rp)}
              </div>
              <p className="text-[9px] text-suka-brown/50 font-bold">Saldo Teoretis</p>
            </div>

            {/* Net Selisih */}
            <div
              className={`p-3.5 rounded-2xl border shadow-2xs space-y-0.5 ${
                data.totals.total_selisih_rp < 0
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider">
                6. Net Selisih (Rp)
              </span>
              <div className="text-sm sm:text-base font-black flex items-center gap-1">
                {data.totals.total_selisih_rp < 0 ? (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                )}
                <span>
                  {data.totals.total_selisih_rp > 0 ? '+' : ''}
                  {formatRp(data.totals.total_selisih_rp)}
                </span>
              </div>
              <p className="text-[9px] font-bold">
                {data.totals.total_selisih_rp < 0 ? 'Defisit / Rugi Fisik' : 'Surplus Fisik'}
              </p>
            </div>
          </div>

          {/* Diagnostic quick badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black text-suka-brown/60 uppercase tracking-wider">
                Ringkasan Status:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-suka-cream text-suka-brown">
                {data.items.length} Bahan Terdata
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  data.totals.bahan_berselisih_count > 0
                    ? 'bg-red-100 text-red-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {data.totals.bahan_berselisih_count} Bahan Berselisih
              </span>
              {data.totals.anomali_skala_count > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                  🚨 {data.totals.anomali_skala_count} Salah Input Skala Satuan
                </span>
              )}
            </div>

            <div className="text-[11px] font-bold text-suka-brown/60">
              Tip: Klik baris bahan untuk melihat rincian menu POS pemakai bahan tersebut.
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. TABEL REKONSILIASI LENGKAP DENGAN ACCORDION BREAKDOWN MENU             */}
          {/* ========================================================================= */}
          <RekonsiliasiTable
            outletId={currentOutletId}
            items={data.items}
            startDate={data.period.start_date}
            endDate={data.period.end_date}
            period={data.period}
          />
        </>
      )}

      {/* Audit Notes Modal */}
      {showNotesModal && data?.period.opname_terpilih && (
        <AuditNotesModal
          opnameId={data.period.opname_terpilih.id}
          initialNote={data.audit_note}
          outletName={data.outlet.name}
          opnameTanggal={data.period.opname_terpilih.tanggal}
          onClose={() => setShowNotesModal(false)}
          onSaved={() => {
            setShowNotesModal(false)
            loadReconciliationData()
          }}
        />
      )}
    </div>
  )
}
