'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Store,
  Users,
  Calendar,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Edit2,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  X,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  Receipt,
  Copy,
} from 'lucide-react'
import {
  MonthlyBudgetMatrix,
  OutletBudgetSummary,
  upsertOutletBudget,
  getMonthlyBudgetMatrix,
  copyPreviousMonthBudgets,
} from '@/app/actions/budgets'
import { triggerSyncHistoricalOpex } from '@/app/actions/sync'
import ImportExcelModal from '@/components/dashboard/ImportExcelModal'
import OpexView from '@/components/dashboard/OpexView'
import type { OpexSummary } from '@/app/actions/opex'

interface BudgetMatrixViewProps {
  initialData: MonthlyBudgetMatrix
  initialOpexSummary: OpexSummary
  outlets: Array<{ id: string; name: string; type?: string }>
  userRole: string
  initialTab?: 'matrix' | 'opex'
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function BudgetMatrixView({
  initialData,
  initialOpexSummary,
  outlets,
  userRole,
  initialTab = 'matrix',
}: BudgetMatrixViewProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'opex'>(initialTab)
  const [data, setData] = useState<MonthlyBudgetMatrix>(initialData)
  const [selectedMonth, setSelectedMonth] = useState<number>(initialData.periodMonth)
  const [selectedYear, setSelectedYear] = useState<number>(initialData.periodYear)
  const [isLoadingPeriod, setIsLoadingPeriod] = useState<boolean>(false)
  const [isCopying, setIsCopying] = useState<boolean>(false)
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'MITRA' | 'INTERNAL'>('ALL')
  const [editingOutlet, setEditingOutlet] = useState<OutletBudgetSummary | null>(null)
  const [editBudgetVal, setEditBudgetVal] = useState<string>('0')
  const [editKolVal, setEditKolVal] = useState<string>('0')
  const [editNotes, setEditNotes] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isSyncingOpex, setIsSyncingOpex] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    text: string
    isError?: boolean
  } | null>(null)
  const [syncOpexResult, setSyncOpexResult] = useState<{
    message: string
    isError?: boolean
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const openEditModal = (outlet: OutletBudgetSummary) => {
    setEditingOutlet(outlet)
    setEditBudgetVal(outlet.targetBudget.toString())
    setEditKolVal(outlet.targetKolCount.toString())
    setEditNotes(outlet.notes || '')
    setErrorMessage('')
  }

  const handlePeriodChange = async (newMonth: number, newYear: number) => {
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    setIsLoadingPeriod(true)
    setStatusMessage(null)
    try {
      const matrix = await getMonthlyBudgetMatrix(newMonth, newYear)
      setData(matrix)
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Gagal memuat matriks budget untuk periode yang dipilih.',
        isError: true,
      })
    } finally {
      setIsLoadingPeriod(false)
    }
  }

  const handleCopyPreviousMonth = async () => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    const prevMonthName = MONTH_NAMES[prevMonth - 1]

    if (
      !confirm(
        `Salin semua target budget dan kuota KOL dari ${prevMonthName} ${prevYear} ke ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}?`
      )
    ) {
      return
    }

    setIsCopying(true)
    setStatusMessage(null)
    try {
      const res = await copyPreviousMonthBudgets(selectedMonth, selectedYear)
      if (res?.success) {
        setStatusMessage({
          text: `Berhasil menyalin target budget bulanan dari ${prevMonthName} ${prevYear}! Total: ${res.copiedCount} cabang diperbarui.`,
        })
        const matrix = await getMonthlyBudgetMatrix(selectedMonth, selectedYear)
        setData(matrix)
      } else {
        setStatusMessage({
          text: res?.error || 'Gagal menyalin target budget.',
          isError: true,
        })
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Terjadi kesalahan sistem saat menyalin target budget.',
        isError: true,
      })
    } finally {
      setIsCopying(false)
    }
  }

  const handleSyncOpex = async () => {
    setIsSyncingOpex(true)
    setSyncOpexResult(null)
    try {
      const res = await triggerSyncHistoricalOpex()
      if (res?.success) {
        setSyncOpexResult({
          message: `Berhasil sinkronisasi ke OPEX Finance (mulai September 2026)! Total: ${res.totalProcessed} data diproses (${res.syncedEndorsements} endorsement, ${res.syncedAds} ads).`,
        })
      } else {
        setSyncOpexResult({
          message: res?.error || 'Gagal melakukan sinkronisasi ke OPEX Finance.',
          isError: true,
        })
      }
    } catch (err: any) {
      setSyncOpexResult({
        message: err?.message || 'Terjadi kesalahan sistem saat sinkronisasi.',
        isError: true,
      })
    } finally {
      setIsSyncingOpex(false)
    }
  }

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOutlet) return
    setErrorMessage('')

    const targetBudget = parseFloat(editBudgetVal.replace(/[^0-9.]/g, '')) || 0
    const targetKol = parseInt(editKolVal, 10) || 0

    startTransition(async () => {
      const res = await upsertOutletBudget(
        editingOutlet.outletId,
        selectedMonth,
        selectedYear,
        targetBudget,
        targetKol,
        editNotes
      )

      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setEditingOutlet(null)
        try {
          const matrix = await getMonthlyBudgetMatrix(selectedMonth, selectedYear)
          setData(matrix)
          setStatusMessage({
            text: `Target budget bulanan untuk ${editingOutlet.outletName} periode ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} berhasil disimpan!`,
          })
        } catch {
          // Matrix re-load fallback
        }
      }
    })
  }

  const renderOutletTable = (
    title: string,
    badgeText: string,
    badgeColor: string,
    summary: {
      targetBudget: number
      totalRealizedCost: number
      remainingBudget: number
      targetKolCount: number
      actualKolCount: number
      outlets: OutletBudgetSummary[]
    }
  ) => {
    return (
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        <div className="p-5 bg-[#FAF8F5] border-b border-[#EFE8DE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="font-extrabold text-[#1A1715] text-base sm:text-lg">{title}</h3>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${badgeColor}`}>
              {badgeText} ({summary.outlets.length} Cabang)
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            <span className="text-stone-500">
              Target: <strong className="text-stone-900">{formatRupiah(summary.targetBudget)}</strong>
            </span>
            <span className="text-[#D9480F]">
              Realisasi: <strong>{formatRupiah(summary.totalRealizedCost)}</strong>
            </span>
            <span className={summary.remainingBudget >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
              Sisa: <strong>{formatRupiah(summary.remainingBudget)}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE] sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">No</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Nama Cabang</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div>Target Budget Bulanan</div>
                  <div className="text-[9px] text-stone-400 font-medium normal-case tracking-normal">Pagu / Bulan</div>
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div>Rate Card</div>
                  <div className="text-[9px] text-stone-400 font-medium normal-case tracking-normal">Biaya KOL</div>
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div>HPP Menu</div>
                  <div className="text-[9px] text-stone-400 font-medium normal-case tracking-normal">Konsumsi Menu</div>
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div>Total Realisasi</div>
                  <div className="text-[9px] text-[#D9480F] font-bold normal-case tracking-normal">Biaya Terpakai (▲)</div>
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div>Sisa Budget</div>
                  <div className="text-[9px] text-stone-400 font-medium normal-case tracking-normal">Pagu - Terpakai (▼)</div>
                </th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">
                  <div>Target KOL Bulanan</div>
                  <div className="text-[9px] text-stone-400 font-medium normal-case tracking-normal">Kuota / Bulan</div>
                </th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Realisasi KOL</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Capaian %</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 z-20 bg-[#FAF8F5] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {summary.outlets.map((item, idx) => {
                const isOverBudget = item.remainingBudget < 0
                return (
                  <tr key={item.outletId} className="group hover:bg-amber-50/30 transition-colors">
                    <td className="py-3.5 px-4 text-stone-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-[#1A1715]">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-stone-400" />
                        <span>{item.outletName}</span>
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-stone-500 font-normal italic mt-0.5">
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900">
                      <div>{formatRupiah(item.targetBudget)}</div>
                      {item.targetBudget === 0 && (
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="text-[10px] text-[#D9480F] hover:underline font-sans font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          + Atur Target
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-stone-600">
                      {formatRupiah(item.realizedRateCard)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-stone-600">
                      {formatRupiah(item.realizedHpp)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-[#D9480F]">
                      {formatRupiah(item.totalRealizedCost)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-bold ${
                        isOverBudget ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      <div>{formatRupiah(item.remainingBudget)}</div>
                      {item.targetBudget === 0 && item.totalRealizedCost > 0 && (
                        <div className="text-[9px] text-rose-500 font-sans font-normal italic">
                          (Tanpa pagu budget)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-stone-700">
                      {item.targetKolCount}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono font-bold text-[#1A1715]">{item.actualKolCount}</span>
                      <span className="text-[10px] text-stone-400 ml-1">
                        ({item.visitedKolCount} visit, {item.postedKolCount} post)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {item.targetBudget === 0 ? (
                          <span className="text-[10px] text-stone-400 font-medium italic">-</span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              item.budgetAchievementRate > 100
                                ? 'bg-rose-100 text-rose-800'
                                : item.budgetAchievementRate >= 80
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.budgetAchievementRate}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right sticky right-0 z-10 bg-white group-hover:bg-amber-50/30 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-stone-400 hover:text-[#D9480F] hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Target Budget Cabang"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-[#FAF8F5] border-t-2 border-[#EFE8DE] font-bold text-stone-900">
              <tr>
                <td colSpan={2} className="py-3 px-4 uppercase text-[11px] tracking-wider">
                  Total {title}
                </td>
                <td className="py-3 px-4 text-right font-mono">{formatRupiah(summary.targetBudget)}</td>
                <td colSpan={2}></td>
                <td className="py-3 px-4 text-right font-mono text-[#D9480F]">
                  {formatRupiah(summary.totalRealizedCost)}
                </td>
                <td
                  className={`py-3 px-4 text-right font-mono ${
                    summary.remainingBudget >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {formatRupiah(summary.remainingBudget)}
                </td>
                <td className="py-3 px-4 text-center font-mono">{summary.targetKolCount}</td>
                <td className="py-3 px-4 text-center font-mono">{summary.actualKolCount}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Tab Navigation: Matriks Budget vs OPEX & Pengeluaran Marcom */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Manajemen Anggaran & Biaya Marcom</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Budget & OPEX Marcom
          </h1>
        </div>

        <div className="flex items-center gap-1.5 p-1.5 bg-[#EFE8DE]/70 rounded-2xl border border-[#EFE8DE] shadow-xs">
          <Link
            href="/dashboard/budget"
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-white text-[#1A1715] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-[#D9480F]" />
            <span>Matriks Budget Outlet</span>
          </Link>
          <Link
            href="/dashboard/budget/opex"
            onClick={() => setActiveTab('opex')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'opex'
                ? 'bg-white text-[#1A1715] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-[#D9480F]" />
            <span>OPEX & Pengeluaran Marcom</span>
          </Link>
        </div>
      </div>

      {activeTab === 'opex' ? (
        <OpexView
          initialSummary={initialOpexSummary}
          outlets={outlets}
          userRole={userRole}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Alokasi Budget & Kuota KOL Bulanan</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
                Matriks Budget Outlet Bulanan ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                Monitoring komparasi target pagu anggaran bulanan vs realisasi biaya riil (Rate Card Cash + HPP Menu) untuk cabang Mitra & Internal.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Periode Selector Bulanan */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-[#EFE8DE] shadow-2xs">
                <Calendar className="w-4 h-4 text-[#D9480F]" />
                <select
                  value={selectedMonth}
                  onChange={(e) => handlePeriodChange(parseInt(e.target.value, 10), selectedYear)}
                  disabled={isLoadingPeriod}
                  className="bg-transparent text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => handlePeriodChange(selectedMonth, parseInt(e.target.value, 10))}
                  disabled={isLoadingPeriod}
                  className="bg-transparent text-xs font-bold text-stone-800 focus:outline-none cursor-pointer border-l border-[#EFE8DE] pl-2"
                >
                  {[2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                {isLoadingPeriod && (
                  <RefreshCw className="w-3.5 h-3.5 text-[#D9480F] animate-spin ml-1" />
                )}
              </div>

              {/* Tombol Salin Target dari Bulan Lalu */}
              <button
                type="button"
                onClick={handleCopyPreviousMonth}
                disabled={isCopying || isLoadingPeriod}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200/80 text-stone-700 border border-stone-200/80 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Salin target budget dan kuota KOL dari bulan sebelumnya"
              >
                <Copy className="w-3.5 h-3.5 text-stone-500" />
                <span>{isCopying ? 'Menyalin...' : 'Salin Bulan Lalu'}</span>
              </button>

              <div className="flex items-center gap-1.5 p-1 bg-[#EFE8DE]/60 rounded-xl border border-[#EFE8DE]">
                <button
                  onClick={() => setActiveCategory('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === 'ALL' ? 'bg-white text-[#1A1715] shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setActiveCategory('MITRA')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === 'MITRA' ? 'bg-purple-700 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Mitra
                </button>
                <button
                  onClick={() => setActiveCategory('INTERNAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === 'INTERNAL' ? 'bg-amber-700 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Internal
                </button>
              </div>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title="Import Excel spreadsheet Marcom"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import</span>
              </button>

              <button
                onClick={handleSyncOpex}
                disabled={isSyncingOpex}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                title="Sinkronisasi seluruh pengeluaran (Endorsement, Ongkir, Ads) ke OPEX Finance & Admin Dashboard"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${isSyncingOpex ? 'animate-spin' : ''}`} />
                <span>{isSyncingOpex ? 'Menyinkronkan...' : 'Sync OPEX'}</span>
              </button>
            </div>
          </div>

          {/* Notifikasi Status Aksi (Copy/Save) */}
          {statusMessage && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                statusMessage.isError
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.isError ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                )}
                <span className="font-medium">{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Banner Peringatan Target Kosong */}
          {data.grandTotal.targetBudget === 0 && data.grandTotal.targetKolCount === 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <div className="text-xs">
                  <span className="font-bold">Target Belum Ditetapkan: </span>
                  Target budget bulanan untuk periode <span className="font-bold underline">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span> masih kosong.
                  Anda dapat menyalin target dari bulan sebelumnya atau mengatur target per cabang di tabel bawah.
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyPreviousMonth}
                disabled={isCopying || isLoadingPeriod}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isCopying ? 'Menyalin...' : `Salin Target dari ${MONTH_NAMES[(selectedMonth === 1 ? 12 : selectedMonth - 1) - 1]}`}</span>
              </button>
            </div>
          )}

          {/* Notifikasi Hasil Sinkronisasi OPEX */}
          {syncOpexResult && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                syncOpexResult.isError
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {syncOpexResult.isError ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                )}
                <span className="font-medium">{syncOpexResult.message}</span>
              </div>
              <button
                onClick={() => setSyncOpexResult(null)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* KPI Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Total Target Budget */}
            <div className="p-5 rounded-3xl bg-white border border-[#EFE8DE] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Target Budget Bulanan
                </div>
                <div className="text-xl font-extrabold font-mono text-[#1A1715]">
                  {formatRupiah(data.grandTotal.targetBudget)}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  Target {data.grandTotal.targetKolCount} KOL ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
                </div>
              </div>
            </div>

            {/* Total Realisasi Biaya */}
            <div className="p-5 rounded-3xl bg-white border border-[#EFE8DE] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Realisasi Biaya Bulan Ini
                </div>
                <div className="text-xl font-extrabold font-mono text-[#D9480F]">
                  {formatRupiah(data.grandTotal.totalRealizedCost)}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  Ratecard + HPP ({MONTH_NAMES[selectedMonth - 1]})
                </div>
              </div>
            </div>

            {/* Sisa Budget */}
            <div className="p-5 rounded-3xl bg-white border border-[#EFE8DE] shadow-xs flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  data.grandTotal.remainingBudget >= 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Sisa Budget Bulan Ini
                </div>
                <div
                  className={`text-xl font-extrabold font-mono ${
                    data.grandTotal.remainingBudget >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {formatRupiah(data.grandTotal.remainingBudget)}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  {data.grandTotal.remainingBudget >= 0 ? '✅ Masih dalam batas budget' : '⚠️ Melebihi alokasi target'}
                </div>
              </div>
            </div>

            {/* Realisasi KOL */}
            <div className="p-5 rounded-3xl bg-white border border-[#EFE8DE] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Realisasi KOL ({MONTH_NAMES[selectedMonth - 1]})
                </div>
                <div className="text-xl font-extrabold font-mono text-[#1A1715]">
                  {data.grandTotal.actualKolCount}{' '}
                  <span className="text-xs text-stone-400 font-sans">/ {data.grandTotal.targetKolCount} KOL</span>
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  {data.grandTotal.targetKolCount > 0
                    ? `${Math.round((data.grandTotal.actualKolCount / data.grandTotal.targetKolCount) * 100)}% kuota tercapai`
                    : '0% kuota'}
                </div>
              </div>
            </div>
          </div>

      {/* Tables Section */}
      <div className="space-y-6">
        {(activeCategory === 'ALL' || activeCategory === 'MITRA') &&
          renderOutletTable(
            'Outlet Kemitraan (Mitra)',
            'Mitra',
            'bg-purple-100 text-purple-800',
            data.mitraSummary
          )}

        {(activeCategory === 'ALL' || activeCategory === 'INTERNAL') &&
          renderOutletTable(
            'Outlet Milik Sendiri (Internal / Non-Mitra)',
            'Internal Pusat',
            'bg-amber-100 text-amber-800',
            data.internalSummary
          )}
      </div>

      {/* MODAL: EDIT BUDGET OUTLET */}
      {editingOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1715] text-base">
                    Atur Budget Bulanan - {editingOutlet.outletName}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Periode: {MONTH_NAMES[selectedMonth - 1]} {selectedYear} ({editingOutlet.outletType})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingOutlet(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="p-5 sm:p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Target Pagu Budget Bulanan (Rp) *
                </label>
                <p className="text-[11px] text-stone-500 mb-1.5">
                  Pagu anggaran marketing cabang khusus untuk bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
                </p>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editBudgetVal}
                  onChange={(e) => setEditBudgetVal(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Target Kuota KOL Bulanan (Orang) *
                </label>
                <p className="text-[11px] text-stone-500 mb-1.5">
                  Target kuota KOL di cabang ini pada bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
                </p>
                <input
                  type="number"
                  min="0"
                  value={editKolVal}
                  onChange={(e) => setEditKolVal(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Catatan Alokasi (Opsional)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Tambahan dana campaign opening"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setEditingOutlet(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Budget Bulanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* Import Excel Modal */}
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  )
}
