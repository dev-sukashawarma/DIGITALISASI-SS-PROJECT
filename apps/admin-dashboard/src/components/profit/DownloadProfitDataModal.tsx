'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  FolderArchive,
  Calendar,
  Building2,
  CheckCircle2,
  Search,
  Loader2,
  Layers,
  Sparkles,
  Info
} from 'lucide-react'
import { toast } from 'sonner'
import { presetRange } from '@/lib/period'
import type { PeriodFilterValue } from '@/lib/types'
import { isInScope, mitraOutletIds, SCOPE_LABEL, type ProfitScope } from '@/lib/outletOwnership'
import { isTestOutlet } from '@/lib/outletFilters'
import {
  generateSingleOutletPdfBlob,
  generateConsolidatedPdfBlob,
  generateSingleOutletCsvString,
  generateConsolidatedCsvString,
  createZipBundle,
  downloadBlob,
  formatPeriodeIndo,
  type OutletExportItem,
  type ConsolidatedSummaryData,
  type ExportContext,
} from '@/lib/export/profitExportService'
import { fetchProfitExportData } from '@/lib/export/profitExportFetcher'

interface DownloadProfitDataModalProps {
  isOpen: boolean
  onClose: () => void
  currentFilter: PeriodFilterValue
  outlets: { id: string; name: string; type?: string; is_active?: boolean }[]
  scope: ProfitScope
  mitraInvestments: Record<string, any>
  currentData: {
    outletBreakdown: OutletExportItem[]
    salesRows: any[]
    expenseRows: any[]
    tiktokSettlements: Record<string, any>
    summaryData: ConsolidatedSummaryData
  }
}

type PeriodPreset = 'last_month' | 'this_month' | 'screen' | 'custom'
type OutletSelection = 'all' | 'specific'
type AllOutletsMode = 'consolidated' | 'zip'
type FileFormat = 'pdf' | 'csv' | 'both'

export function DownloadProfitDataModal({
  isOpen,
  onClose,
  currentFilter,
  outlets,
  scope,
  mitraInvestments,
  currentData,
}: DownloadProfitDataModalProps) {
  // 1. State Periode
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('last_month')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  // 2. State Outlet
  const [outletSelection, setOutletSelection] = useState<OutletSelection>('all')
  const [allOutletsMode, setAllOutletsMode] = useState<AllOutletsMode>('consolidated')
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([])
  const [outletSearch, setOutletSearch] = useState<string>('')

  // 3. State Format
  const [fileFormat, setFileFormat] = useState<FileFormat>('pdf')

  // 4. State Progress & Loading
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [progressPct, setProgressPct] = useState<number>(0)
  const [progressText, setProgressText] = useState<string>('')

  // Inisialisasi tanggal saat modal dibuka (default ke 'last_month' sesuai permintaan user)
  useEffect(() => {
    if (isOpen) {
      const lastMonthRange = presetRange('last_month')
      setFromDate(lastMonthRange.from)
      setToDate(lastMonthRange.to)
      setPeriodPreset('last_month')
      setOutletSelection('all')
      setAllOutletsMode('consolidated')
      setFileFormat('pdf')
      setIsDownloading(false)
      setProgressPct(0)
      setProgressText('')
      setOutletSearch('')

      // Pilih semua outlet yang valid secara default untuk mode specific
      const mIds = mitraOutletIds(outlets, mitraInvestments)
      const cutoffDates = new Map<string, string>()
      for (const [id, inv] of Object.entries(mitraInvestments ?? {})) {
        if (inv?.tanggal_mulai) {
          cutoffDates.set(id, inv.tanggal_mulai)
        }
      }
      const validOutlets = outlets.filter(
        o => !isTestOutlet(o) && isInScope(scope, o.id, mIds, lastMonthRange.to, cutoffDates)
      )
      setSelectedOutletIds(validOutlets.map(o => o.id))
    }
  }, [isOpen, outlets, scope, mitraInvestments])

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen || isDownloading) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDownloading, onClose])

  // Mengubah preset periode
  const handleSelectPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset)
    if (preset === 'last_month') {
      const r = presetRange('last_month')
      setFromDate(r.from)
      setToDate(r.to)
    } else if (preset === 'this_month') {
      const r = presetRange('this_month')
      setFromDate(r.from)
      setToDate(r.to)
    } else if (preset === 'screen') {
      setFromDate(currentFilter.from)
      setToDate(currentFilter.to)
    }
  }

  // Filter list outlet untuk multi-select (hanya outlet yang sesuai scope)
  const availableOutlets = useMemo(() => {
    const mIds = mitraOutletIds(outlets, mitraInvestments)
    const cutoffDates = new Map<string, string>()
    for (const [id, inv] of Object.entries(mitraInvestments ?? {})) {
      if (inv?.tanggal_mulai) {
        cutoffDates.set(id, inv.tanggal_mulai)
      }
    }
    const targetDate = toDate || fromDate
    return outlets.filter(
      o => !isTestOutlet(o) && isInScope(scope, o.id, mIds, targetDate, cutoffDates)
    )
  }, [outlets, scope, mitraInvestments, toDate, fromDate])

  const filteredOutletList = useMemo(() => {
    if (!outletSearch.trim()) return availableOutlets
    const q = outletSearch.toLowerCase()
    return availableOutlets.filter(o => o.name.toLowerCase().includes(q))
  }, [availableOutlets, outletSearch])

  const isAllSelected = selectedOutletIds.length === availableOutlets.length
  const handleToggleSelectAllOutlets = () => {
    if (isAllSelected) {
      setSelectedOutletIds([])
    } else {
      setSelectedOutletIds(availableOutlets.map(o => o.id))
    }
  }

  const handleToggleOutlet = (id: string) => {
    setSelectedOutletIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const isSamePeriodAsScreen = fromDate === currentFilter.from && toDate === currentFilter.to

  // Hanya boleh memakai data memori layar jika periode persis sama DAN cakupan outlet layar mencukupi data yang diminta
  const canUseScreenData = useMemo(() => {
    if (!isSamePeriodAsScreen) return false

    if (currentFilter.outletId === 'all') {
      if (outletSelection === 'all') return true
      return (
        selectedOutletIds.length > 0 &&
        selectedOutletIds.every(id => currentData.outletBreakdown.some(o => o.id === id))
      )
    }

    // Layar sedang difilter ke 1 outlet spesifik:
    // Hanya bisa pakai memory jika user memilih mode 'specific' dengan HANYA 1 outlet yang sama persis
    return (
      outletSelection === 'specific' &&
      selectedOutletIds.length === 1 &&
      selectedOutletIds[0] === currentFilter.outletId &&
      currentData.outletBreakdown.some(o => o.id === currentFilter.outletId)
    )
  }, [
    isSamePeriodAsScreen,
    currentFilter.outletId,
    outletSelection,
    selectedOutletIds,
    currentData.outletBreakdown,
  ])

  // ==========================================
  // EKSEKUSI PENARIKAN & PEMBUATAN BERKAS UNDUH
  // ==========================================
  const handleDownload = async () => {
    if (!fromDate || !toDate) {
      toast.error('Harap pilih rentang tanggal laporan terlebih dahulu')
      return
    }

    if (fromDate > toDate) {
      toast.error('Tanggal mulai tidak boleh melebihi tanggal akhir')
      return
    }

    if (outletSelection === 'specific' && selectedOutletIds.length === 0) {
      toast.error('Pilih minimal 1 outlet untuk diunduh')
      return
    }

    setIsDownloading(true)
    setProgressPct(5)
    setProgressText('Menyiapkan data keuangan...')

    const toastId = toast.loading('Sedang memproses penarikan data laporan...')

    try {
      let exportOutletBreakdown: OutletExportItem[]
      let exportSummary: ConsolidatedSummaryData
      let exportSalesRows: any[]
      let exportExpenseRows: any[]
      let exportTiktokSettlements: Record<string, any>

      // 1. Ambil Data (Gunakan memory jika data layar lengkap dan cocok, atau tarik background jika beda)
      if (canUseScreenData) {
        setProgressPct(20)
        setProgressText('Menggunakan data siap pakai dari layar...')
        exportOutletBreakdown = currentData.outletBreakdown
        exportSummary = currentData.summaryData
        exportSalesRows = currentData.salesRows
        exportExpenseRows = currentData.expenseRows
        exportTiktokSettlements = currentData.tiktokSettlements
      } else {
        setProgressPct(15)
        const bgData = await fetchProfitExportData({
          from: fromDate,
          to: toDate,
          scope,
          outlets,
          mitraInvestments,
          onProgress: msg => {
            setProgressText(msg)
          },
        })
        exportOutletBreakdown = bgData.outletBreakdown
        exportSummary = bgData.summaryData
        exportSalesRows = bgData.salesRows
        exportExpenseRows = bgData.expenseRows
        exportTiktokSettlements = bgData.tiktokSettlements
      }

      const exportCtx: ExportContext = {
        salesRows: exportSalesRows,
        expenseRows: exportExpenseRows,
        mitraInvestments,
        tiktokSettlements: exportTiktokSettlements,
        filter: { from: fromDate, to: toDate },
        effectiveFilter: { from: fromDate, to: toDate },
      }

      const scopeTag = SCOPE_LABEL[scope].replace(/\s+/g, '_')
      const periodTag = `${fromDate}_${toDate}`

      // ==========================================
      // KASUS A: SEMUA OUTLET - FILE KONSOLIDASI
      // ==========================================
      if (outletSelection === 'all' && allOutletsMode === 'consolidated') {
        setProgressPct(50)
        setProgressText('Membuat dokumen konsolidasi seluruh outlet...')

        if (fileFormat === 'pdf' || fileFormat === 'both') {
          setProgressPct(70)
          setProgressText('Menyusun PDF resmi konsolidasi...')
          const pdfBlob = await generateConsolidatedPdfBlob(
            exportOutletBreakdown,
            exportSummary,
            scope,
            exportCtx
          )
          downloadBlob(pdfBlob, `Laporan_Laba_Rugi_Konsolidasi_${scopeTag}_${periodTag}.pdf`)
        }

        if (fileFormat === 'csv' || fileFormat === 'both') {
          setProgressPct(90)
          setProgressText('Menyusun CSV konsolidasi...')
          const csvStr = generateConsolidatedCsvString(
            exportOutletBreakdown,
            exportSummary,
            scope,
            exportCtx
          )
          const csvBlob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' })
          downloadBlob(csvBlob, `Laporan_Laba_Rugi_Konsolidasi_${scopeTag}_${periodTag}.csv`)
        }

        setProgressPct(100)
        setProgressText('Unduhan selesai!')
        toast.success('Laporan konsolidasi berhasil diunduh', { id: toastId })
        setTimeout(() => {
          setIsDownloading(false)
          onClose()
        }, 800)
        return
      }

      // ==========================================
      // KASUS B: KUMPULAN BERKAS PER OUTLET (ZIP / SINGLE)
      // ==========================================
      // Tentukan daftar outlet yang akan diproses
      const targetOutlets =
        outletSelection === 'all'
          ? exportOutletBreakdown
          : exportOutletBreakdown.filter(o => selectedOutletIds.includes(o.id))

      if (targetOutlets.length === 0) {
        toast.error('Tidak ada data transaksi untuk outlet yang dipilih pada periode ini', { id: toastId })
        setIsDownloading(false)
        return
      }

      // Jika hanya 1 outlet yang dipilih di mode specific: langsung download file tunggal tanpa ZIP
      if (outletSelection === 'specific' && targetOutlets.length === 1) {
        const item = targetOutlets[0]
        const cleanName = item.name.replace(/^SUKA SHAWARMA\s*/i, '').trim().replace(/[^a-zA-Z0-9]/g, '_')
        setProgressPct(50)
        setProgressText(`Membuat dokumen untuk ${item.name}...`)

        if (fileFormat === 'pdf' || fileFormat === 'both') {
          const pdfBlob = await generateSingleOutletPdfBlob(item, exportCtx)
          downloadBlob(pdfBlob, `Laporan_Laba_Rugi_${cleanName}_${periodTag}.pdf`)
        }

        if (fileFormat === 'csv' || fileFormat === 'both') {
          const csvStr = generateSingleOutletCsvString(item, exportCtx)
          const csvBlob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' })
          downloadBlob(csvBlob, `Laporan_Laba_Rugi_${cleanName}_${periodTag}.csv`)
        }

        setProgressPct(100)
        setProgressText('Unduhan selesai!')
        toast.success(`Laporan ${item.name} berhasil diunduh`, { id: toastId })
        setTimeout(() => {
          setIsDownloading(false)
          onClose()
        }, 800)
        return
      }

      // Jika banyak outlet (All Zip ATAU Specific > 1 outlet): Kemas dalam format ZIP
      const zipFiles: { filename: string; content: Blob | string }[] = []
      const totalOutlets = targetOutlets.length

      for (let i = 0; i < totalOutlets; i++) {
        const item = targetOutlets[i]
        const cleanName = item.name.replace(/^SUKA SHAWARMA\s*/i, '').trim().replace(/[^a-zA-Z0-9]/g, '_')
        const currentNum = i + 1

        const currentPct = 25 + Math.round((i / totalOutlets) * 55)
        setProgressPct(currentPct)
        setProgressText(`Membuat laporan ${item.name} (${currentNum}/${totalOutlets})...`)

        if (fileFormat === 'pdf' || fileFormat === 'both') {
          const pdfBlob = await generateSingleOutletPdfBlob(item, exportCtx)
          zipFiles.push({
            filename: `Laporan_Laba_Rugi_${cleanName}_${periodTag}.pdf`,
            content: pdfBlob,
          })
        }

        if (fileFormat === 'csv' || fileFormat === 'both') {
          const csvStr = generateSingleOutletCsvString(item, exportCtx)
          zipFiles.push({
            filename: `Laporan_Laba_Rugi_${cleanName}_${periodTag}.csv`,
            content: csvStr,
          })
        }
      }

      setProgressPct(85)
      setProgressText('Mengompresi berkas ke dalam ZIP...')

      const zipBlob = await createZipBundle(zipFiles, (pct, msg) => {
        setProgressPct(85 + Math.round((pct / 100) * 12))
        setProgressText(msg)
      })

      const zipFilename =
        outletSelection === 'all'
          ? `Laporan_Laba_Rugi_Seluruh_Outlet_${scopeTag}_${periodTag}.zip`
          : `Laporan_Laba_Rugi_${targetOutlets.length}_Outlet_${scopeTag}_${periodTag}.zip`

      setProgressPct(99)
      setProgressText('Mengunduh arsip ZIP...')
      downloadBlob(zipBlob, zipFilename)

      setProgressPct(100)
      setProgressText('Unduhan ZIP selesai!')
      toast.success(`Berhasil mengunduh arsip ZIP (${zipFiles.length} berkas)`, { id: toastId })
      setTimeout(() => {
        setIsDownloading(false)
        onClose()
      }, 800)
    } catch (err: any) {
      console.error('Error saat download data laba rugi:', err)
      toast.error(err?.message || 'Gagal memproses dan mengunduh laporan laba rugi', { id: toastId })
      setIsDownloading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-suka-ink/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-suka-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-modal-title"
      >
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-suka-gray-100 flex items-center justify-between bg-gradient-to-r from-suka-gray-50 via-white to-amber-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange shadow-2xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 id="download-modal-title" className="text-base sm:text-lg font-black text-suka-ink tracking-tight">
                Tarik & Unduh Laporan Laba Rugi
              </h2>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                Cakupan: <strong className="text-suka-brown">{SCOPE_LABEL[scope]}</strong> · Pilih periode & format ekspor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            aria-label="Tutup modal"
            className="p-2 rounded-xl text-suka-gray-400 hover:text-suka-brown hover:bg-suka-gray-200/60 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* SEKSI 1: RENTANG PERIODE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-suka-ink flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-suka-orange" />
                <span>1. Rentang Periode Laporan</span>
              </label>
              {canUseScreenData ? (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Sesuai Filter Layar (Instan)
                </span>
              ) : isSamePeriodAsScreen ? (
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/70 inline-flex items-center gap-1">
                  Sinkronisasi Latar Belakang
                </span>
              ) : null}
            </div>

            {/* Presets Pintas Cepat */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('last_month')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodPreset === 'last_month'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-suka-gray-50 hover:bg-suka-gray-100 text-suka-brown border-suka-gray-200'
                }`}
              >
                ★ Bulan Lalu
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('this_month')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodPreset === 'this_month'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-suka-gray-50 hover:bg-suka-gray-100 text-suka-brown border-suka-gray-200'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('screen')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodPreset === 'screen'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-suka-gray-50 hover:bg-suka-gray-100 text-suka-brown border-suka-gray-200'
                }`}
              >
                Sesuai Layar
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('custom')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  periodPreset === 'custom'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-suka-gray-50 hover:bg-suka-gray-100 text-suka-brown border-suka-gray-200'
                }`}
              >
                Kustom
              </button>
            </div>

            {/* Input Tanggal Dari & Sampai */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-suka-gray-500 mb-1 block">Dari Tanggal:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => {
                    setFromDate(e.target.value)
                    setPeriodPreset('custom')
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-suka-ink bg-white border border-suka-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-suka-orange/30 focus:border-suka-orange"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-suka-gray-500 mb-1 block">Sampai Tanggal:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => {
                    setToDate(e.target.value)
                    setPeriodPreset('custom')
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-suka-ink bg-white border border-suka-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-suka-orange/30 focus:border-suka-orange"
                />
              </div>
            </div>

            <p className="text-[11px] text-suka-gray-400 font-medium">
              Periode Terpilih: <strong className="text-suka-brown">{formatPeriodeIndo(fromDate, toDate)}</strong>
            </p>
          </div>

          {/* SEKSI 2: PILIHAN OUTLET */}
          <div className="space-y-3 pt-2 border-t border-suka-gray-100">
            <label className="text-xs font-bold uppercase tracking-wider text-suka-ink flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-suka-orange" />
              <span>2. Cakupan Outlet</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Radio: Semua Outlet */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  outletSelection === 'all'
                    ? 'border-suka-orange bg-amber-50/40 ring-2 ring-suka-orange/20 shadow-2xs'
                    : 'border-suka-gray-200 hover:border-suka-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="outletSelection"
                  value="all"
                  checked={outletSelection === 'all'}
                  onChange={() => setOutletSelection('all')}
                  className="mt-0.5 text-suka-orange focus:ring-suka-orange"
                />
                <div>
                  <span className="text-xs font-bold text-suka-ink block">Semua Outlet</span>
                  <span className="text-[11px] text-suka-gray-500 mt-0.5 block leading-relaxed">
                    Sertakan data seluruh outlet yang beroperasi dalam cakupan.
                  </span>
                </div>
              </label>

              {/* Radio: Outlet Tertentu */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  outletSelection === 'specific'
                    ? 'border-suka-orange bg-amber-50/40 ring-2 ring-suka-orange/20 shadow-2xs'
                    : 'border-suka-gray-200 hover:border-suka-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="outletSelection"
                  value="specific"
                  checked={outletSelection === 'specific'}
                  onChange={() => setOutletSelection('specific')}
                  className="mt-0.5 text-suka-orange focus:ring-suka-orange"
                />
                <div>
                  <span className="text-xs font-bold text-suka-ink block">Pilih Outlet Tertentu</span>
                  <span className="text-[11px] text-suka-gray-500 mt-0.5 block leading-relaxed">
                    Pilih satu atau beberapa outlet khusus sesuai kebutuhan.
                  </span>
                </div>
              </label>
            </div>

            {/* Sub-opsi Jika SEMUA OUTLET dipilih */}
            {outletSelection === 'all' && (
              <div className="p-3.5 bg-suka-gray-50/70 rounded-2xl border border-suka-gray-200 space-y-2.5 mt-2 animate-fade-in">
                <span className="text-[11px] font-bold text-suka-ink block">
                  Format Keluaran Data Seluruh Outlet:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      allOutletsMode === 'consolidated'
                        ? 'bg-white border-suka-orange shadow-2xs'
                        : 'bg-white/60 border-suka-gray-200 hover:border-suka-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="allOutletsMode"
                      value="consolidated"
                      checked={allOutletsMode === 'consolidated'}
                      onChange={() => setAllOutletsMode('consolidated')}
                      className="mt-0.5 text-suka-orange focus:ring-suka-orange"
                    />
                    <div>
                      <span className="text-xs font-bold text-suka-ink block flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-suka-orange" />
                        File Konsolidasi Gabungan
                      </span>
                      <span className="text-[10px] text-suka-gray-500 mt-0.5 block">
                        1 Berkas ringkasan eksekutif seluruh outlet & konsolidasi perusahaan.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      allOutletsMode === 'zip'
                        ? 'bg-white border-suka-orange shadow-2xs'
                        : 'bg-white/60 border-suka-gray-200 hover:border-suka-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="allOutletsMode"
                      value="zip"
                      checked={allOutletsMode === 'zip'}
                      onChange={() => setAllOutletsMode('zip')}
                      className="mt-0.5 text-suka-orange focus:ring-suka-orange"
                    />
                    <div>
                      <span className="text-xs font-bold text-suka-ink block flex items-center gap-1.5">
                        <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
                        Arsip ZIP Terpisah Per Outlet
                      </span>
                      <span className="text-[10px] text-suka-gray-500 mt-0.5 block">
                        Berkas laporan individual terpisah untuk setiap outlet dalam 1 file ZIP.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Sub-opsi Jika PILIH OUTLET TERTENTU dipilih */}
            {outletSelection === 'specific' && (
              <div className="p-3.5 bg-suka-gray-50/70 rounded-2xl border border-suka-gray-200 space-y-3 mt-2 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari nama outlet..."
                      value={outletSearch}
                      onChange={e => setOutletSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-suka-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-suka-orange/30 focus:border-suka-orange"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllOutlets}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white border border-suka-gray-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      {isAllSelected ? 'Batal Semua' : 'Pilih Semua'}
                    </button>
                    <span className="text-[11px] font-bold text-suka-gray-500 px-2">
                      {selectedOutletIds.length} terpilih
                    </span>
                  </div>
                </div>

                {/* List Scrollable Checkbox Outlet */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-white p-2 rounded-xl border border-suka-gray-200 divide-y divide-suka-gray-100">
                  {filteredOutletList.map(o => {
                    const isChecked = selectedOutletIds.includes(o.id)
                    const isMitra = o.type === 'mitra' || o.name.toLowerCase().includes('mitra')
                    return (
                      <label
                        key={o.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-suka-gray-50 cursor-pointer transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleOutlet(o.id)}
                            className="rounded text-suka-orange focus:ring-suka-orange"
                          />
                          <span className={`font-semibold ${isChecked ? 'text-suka-ink' : 'text-suka-gray-600'}`}>
                            {o.name}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isMitra
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : o.id === 'ss-online'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isMitra ? 'Mitra' : o.id === 'ss-online' ? 'Online' : 'Pusat'}
                        </span>
                      </label>
                    )
                  })}
                  {filteredOutletList.length === 0 && (
                    <p className="text-center text-xs text-suka-gray-400 py-4">Tidak ada outlet yang cocok.</p>
                  )}
                </div>

                {/* Info Note Cerdas */}
                <div className="text-[11px] text-suka-gray-500 flex items-center gap-1.5 bg-white p-2 rounded-xl border border-suka-gray-200">
                  <Info className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                  <span>
                    {selectedOutletIds.length === 1
                      ? '1 outlet dipilih: Berkas akan langsung diunduh tanpa ZIP.'
                      : selectedOutletIds.length > 1
                        ? `${selectedOutletIds.length} outlet dipilih: Berkas laporan otomatis dikemas dalam 1 arsip ZIP.`
                        : 'Pilih minimal 1 outlet.'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SEKSI 3: FORMAT BERKAS */}
          <div className="space-y-3 pt-2 border-t border-suka-gray-100">
            <label className="text-xs font-bold uppercase tracking-wider text-suka-ink flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-suka-orange" />
              <span>3. Format Berkas Laporan</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  fileFormat === 'pdf'
                    ? 'border-suka-orange bg-amber-50/40 ring-2 ring-suka-orange/20 shadow-2xs'
                    : 'border-suka-gray-200 hover:border-suka-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="fileFormat"
                  value="pdf"
                  checked={fileFormat === 'pdf'}
                  onChange={() => setFileFormat('pdf')}
                  className="mt-0.5 text-suka-orange focus:ring-suka-orange"
                />
                <div>
                  <span className="text-xs font-bold text-suka-ink block flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                    PDF Saja
                  </span>
                  <span className="text-[10px] text-suka-gray-500 mt-0.5 block">Dokumen cetak resmi berlogo.</span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  fileFormat === 'csv'
                    ? 'border-suka-orange bg-amber-50/40 ring-2 ring-suka-orange/20 shadow-2xs'
                    : 'border-suka-gray-200 hover:border-suka-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="fileFormat"
                  value="csv"
                  checked={fileFormat === 'csv'}
                  onChange={() => setFileFormat('csv')}
                  className="mt-0.5 text-suka-orange focus:ring-suka-orange"
                />
                <div>
                  <span className="text-xs font-bold text-suka-ink block flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    CSV Saja
                  </span>
                  <span className="text-[10px] text-suka-gray-500 mt-0.5 block">Tabular untuk Excel / Spreadsheet.</span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  fileFormat === 'both'
                    ? 'border-suka-orange bg-amber-50/40 ring-2 ring-suka-orange/20 shadow-2xs'
                    : 'border-suka-gray-200 hover:border-suka-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="fileFormat"
                  value="both"
                  checked={fileFormat === 'both'}
                  onChange={() => setFileFormat('both')}
                  className="mt-0.5 text-suka-orange focus:ring-suka-orange"
                />
                <div>
                  <span className="text-xs font-bold text-suka-ink block flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Keduanya (PDF & CSV)
                  </span>
                  <span className="text-[10px] text-suka-gray-500 mt-0.5 block">Paket lengkap PDF dan CSV.</span>
                </div>
              </label>
            </div>
          </div>

          {/* PROGRESS BAR SAAT MENGUNDUH */}
          {isDownloading && (
            <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/80 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-suka-orange animate-spin" />
                  <span>{progressText}</span>
                </span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="w-full bg-amber-200/50 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-suka-orange h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 border-t border-suka-gray-100 flex items-center justify-between bg-suka-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="px-4 py-2 text-xs font-bold text-suka-gray-600 hover:text-suka-ink hover:bg-suka-gray-200/60 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || (outletSelection === 'specific' && selectedOutletIds.length === 0)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-suka-orange hover:bg-suka-orange-hover rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Unduhan...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  {outletSelection === 'all' && allOutletsMode === 'consolidated'
                    ? 'Unduh Laporan Konsolidasi'
                    : 'Unduh Berkas Laporan'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
