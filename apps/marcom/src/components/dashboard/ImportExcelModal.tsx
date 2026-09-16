'use client'

import { useState, useRef } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  Database
} from 'lucide-react'
import { importExcelSpreadsheet, ImportResult } from '@/app/actions/excel-import'

interface ImportExcelModalProps {
  isOpen: boolean
  onClose: () => void
}

const MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
]

export default function ImportExcelModal({ isOpen, onClose }: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [periodMonth, setPeriodMonth] = useState<number>(9)
  const [periodYear, setPeriodYear] = useState<number>(2026)
  const [importBudget, setImportBudget] = useState<boolean>(true)
  const [importEndorsements, setImportEndorsements] = useState<boolean>(true)
  const [importAds, setImportAds] = useState<boolean>(true)
  
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile)
        setResult(null)
      } else {
        alert('Harap pilih file Excel (.xlsx atau .xls)')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0]
      setFile(selected)
      setResult(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setIsLoading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('periodMonth', periodMonth.toString())
    formData.append('periodYear', periodYear.toString())
    formData.append('importBudget', importBudget.toString())
    formData.append('importEndorsements', importEndorsements.toString())
    formData.append('importAds', importAds.toString())

    try {
      const res = await importExcelSpreadsheet(formData)
      setResult(res)
    } catch (err: any) {
      setResult({
        success: false,
        error: err?.message || 'Gagal mengunggah file',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Import Spreadsheet Excel
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  MARCOM SYNC
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Otomatisasi pembacaan sheet Budget, Payment, Event, SS Online & Ads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Result Banner if Completed */}
          {result?.success && result.summary && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Spreadsheet Berhasil Diimpor & Disinkronisasi!</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-slate-900/90 border border-emerald-500/20 p-2.5 rounded-lg">
                  <p className="text-[11px] text-slate-400">Periode</p>
                  <p className="text-sm font-bold text-emerald-300">{result.summary.period}</p>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/20 p-2.5 rounded-lg">
                  <p className="text-[11px] text-slate-400">Outlet & Budget</p>
                  <p className="text-sm font-bold text-white">
                    {result.summary.budgetsUpserted} <span className="text-xs font-normal text-slate-400">target</span>
                  </p>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/20 p-2.5 rounded-lg">
                  <p className="text-[11px] text-slate-400">Endorsements</p>
                  <p className="text-sm font-bold text-white">
                    {result.summary.endorsementsImported} <span className="text-xs font-normal text-slate-400">KOL</span>
                  </p>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/20 p-2.5 rounded-lg">
                  <p className="text-[11px] text-slate-400">Video Posts</p>
                  <p className="text-sm font-bold text-white">
                    {result.summary.postsCreated} <span className="text-xs font-normal text-slate-400">link</span>
                  </p>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/20 p-2.5 rounded-lg">
                  <p className="text-[11px] text-slate-400">Ads Campaigns</p>
                  <p className="text-sm font-bold text-white">
                    {result.summary.adsImported} <span className="text-xs font-normal text-slate-400">iklan</span>
                  </p>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/20 p-2.5 rounded-lg">
                  <p className="text-[11px] text-slate-400">Sheets Terbaca</p>
                  <p className="text-xs font-medium text-slate-300 truncate" title={result.summary.sheetsDetected.join(', ')}>
                    {result.summary.sheetsDetected.length} sheets
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-medium bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
                >
                  Tutup & Lihat Data
                </button>
              </div>
            </div>
          )}

          {result && !result.success && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold">Gagal Mengimpor Excel</p>
                <p className="text-xs text-rose-300/80 mt-1">{result.error}</p>
              </div>
            </div>
          )}

          {!result?.success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : file
                    ? 'border-emerald-500/50 bg-slate-950/40'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-white">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB &bull; Klik untuk ganti file
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-200">
                      Tarik file Excel ke sini, atau <span className="text-emerald-400 underline">pilih file</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Mendukung format .xlsx dari Marcom (cth: SS ENDORSEMENT & EVENT SEPTEMBER2026.xlsx)
                    </p>
                  </div>
                )}
              </div>

              {/* Configuration Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Period Month */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Periode Bulan
                  </label>
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Period Year */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Tahun
                  </label>
                  <select
                    value={periodYear}
                    onChange={(e) => setPeriodYear(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              {/* Module Checkboxes */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Pilih Data yang Akan Diimpor:
                </p>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importBudget}
                      onChange={(e) => setImportBudget(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                    <span>
                      <strong className="text-white">Budget Outlets:</strong> Target alokasi dana & kuota KOL (Mitra & Internal)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importEndorsements}
                      onChange={(e) => setImportEndorsements(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                    <span>
                      <strong className="text-white">Endorsement & Keuangan:</strong> Data Harian, Payment, Menu & HPP, SS Online
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importAds}
                      onChange={(e) => setImportAds(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                    <span>
                      <strong className="text-white">Ads & Paid Traffic:</strong> Akun TikTok/IG (Ads Internal & Ads Mitra)
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!file || isLoading}
                  className={`px-5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                    !file || isLoading
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses & Menyimpan...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Mulai Sinkronisasi
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
