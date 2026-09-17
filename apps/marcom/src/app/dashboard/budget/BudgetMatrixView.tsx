'use client'

import { useState, useTransition } from 'react'
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
} from 'lucide-react'
import { MonthlyBudgetMatrix, OutletBudgetSummary, upsertOutletBudget } from '@/app/actions/budgets'
import { triggerSyncHistoricalOpex } from '@/app/actions/sync'
import ImportExcelModal from '@/components/dashboard/ImportExcelModal'

interface BudgetMatrixViewProps {
  initialData: MonthlyBudgetMatrix
  userRole: string
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function BudgetMatrixView({ initialData, userRole }: BudgetMatrixViewProps) {
  const [data, setData] = useState<MonthlyBudgetMatrix>(initialData)
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'MITRA' | 'INTERNAL'>('ALL')
  const [editingOutlet, setEditingOutlet] = useState<OutletBudgetSummary | null>(null)
  const [editBudgetVal, setEditBudgetVal] = useState<string>('0')
  const [editKolVal, setEditKolVal] = useState<string>('0')
  const [editNotes, setEditNotes] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isSyncingOpex, setIsSyncingOpex] = useState(false)
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
        data.periodMonth,
        data.periodYear,
        targetBudget,
        targetKol,
        editNotes
      )

      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        // Update local state smoothly
        const updateList = (list: OutletBudgetSummary[]) =>
          list.map((item) =>
            item.outletId === editingOutlet.outletId
              ? {
                  ...item,
                  targetBudget,
                  targetKolCount: targetKol,
                  remainingBudget: targetBudget - item.totalRealizedCost,
                  notes: editNotes,
                  budgetAchievementRate:
                    targetBudget > 0 ? Math.round((item.totalRealizedCost / targetBudget) * 100) : 0,
                  kolAchievementRate:
                    targetKol > 0 ? Math.round((item.actualKolCount / targetKol) * 100) : 0,
                }
              : item
          )

        setData((prev) => {
          const isMitra = editingOutlet.outletType === 'MITRA'
          const updatedMitra = isMitra ? updateList(prev.mitraSummary.outlets) : prev.mitraSummary.outlets
          const updatedInternal = !isMitra ? updateList(prev.internalSummary.outlets) : prev.internalSummary.outlets

          const calc = (arr: OutletBudgetSummary[]) => ({
            targetBudget: arr.reduce((acc, curr) => acc + curr.targetBudget, 0),
            totalRealizedCost: arr.reduce((acc, curr) => acc + curr.totalRealizedCost, 0),
            remainingBudget: arr.reduce((acc, curr) => acc + curr.remainingBudget, 0),
            targetKolCount: arr.reduce((acc, curr) => acc + curr.targetKolCount, 0),
            actualKolCount: arr.reduce((acc, curr) => acc + curr.actualKolCount, 0),
            outlets: arr,
          })

          const newMitra = calc(updatedMitra)
          const newInternal = calc(updatedInternal)

          return {
            ...prev,
            mitraSummary: newMitra,
            internalSummary: newInternal,
            grandTotal: {
              targetBudget: newMitra.targetBudget + newInternal.targetBudget,
              totalRealizedCost: newMitra.totalRealizedCost + newInternal.totalRealizedCost,
              remainingBudget: newMitra.remainingBudget + newInternal.remainingBudget,
              targetKolCount: newMitra.targetKolCount + newInternal.targetKolCount,
              actualKolCount: newMitra.actualKolCount + newInternal.actualKolCount,
            },
          }
        })
        setEditingOutlet(null)
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
                  <div>Target Budget</div>
                  <div className="text-[9px] text-stone-400 font-medium normal-case tracking-normal">Pagu Anggaran</div>
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
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Target KOL</th>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Alokasi Budget & Kuota KOL</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Matriks Budget Outlet ({MONTH_NAMES[data.periodMonth - 1]} {data.periodYear})
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Monitoring komparasi target budget vs realisasi biaya riil (Rate Card Cash + HPP Menu) untuk cabang Mitra & Internal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-[#EFE8DE]/60 rounded-xl border border-[#EFE8DE]">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'ALL' ? 'bg-white text-[#1A1715] shadow-xs' : 'text-stone-600'
              }`}
            >
              Semua Cabang
            </button>
            <button
              onClick={() => setActiveCategory('MITRA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'MITRA' ? 'bg-purple-700 text-white shadow-xs' : 'text-stone-600'
              }`}
            >
              Mitra Saja
            </button>
            <button
              onClick={() => setActiveCategory('INTERNAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'INTERNAL' ? 'bg-amber-700 text-white shadow-xs' : 'text-stone-600'
              }`}
            >
              Internal Saja
            </button>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Import Excel spreadsheet Marcom"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleSyncOpex}
            disabled={isSyncingOpex}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Sinkronisasi seluruh pengeluaran (Endorsement, Ongkir, Ads) ke OPEX Finance & Admin Dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${isSyncingOpex ? 'animate-spin' : ''}`} />
            <span>{isSyncingOpex ? 'Menyinkronkan...' : 'Sync OPEX Finance'}</span>
          </button>
        </div>
      </div>

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
              Total Target Budget
            </div>
            <div className="text-xl font-extrabold font-mono text-[#1A1715]">
              {formatRupiah(data.grandTotal.targetBudget)}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              Target {data.grandTotal.targetKolCount} KOL sebulan
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
              Realisasi Pengeluaran
            </div>
            <div className="text-xl font-extrabold font-mono text-[#D9480F]">
              {formatRupiah(data.grandTotal.totalRealizedCost)}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              Ratecard + HPP Menu yang keluar
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
              Sisa Budget Alokasi
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
              Realisasi KOL Masuk
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
                    Atur Budget {editingOutlet.outletName}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Periode {MONTH_NAMES[data.periodMonth - 1]} {data.periodYear} ({editingOutlet.outletType})
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
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Target Alokasi Budget (Rp) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={editBudgetVal}
                  onChange={(e) => setEditBudgetVal(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Target Kuota KOL (Orang) *
                </label>
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
                  {isPending ? 'Menyimpan...' : 'Simpan Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  )
}
