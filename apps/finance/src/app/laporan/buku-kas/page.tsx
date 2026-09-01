// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Wallet,
  FileText,
  UploadCloud,
  ArrowUpRight,
  Download,
  Calendar,
  Filter,
  Store,
  Eye,
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  Users
} from 'lucide-react'
import { Button } from '@suka/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import { useExpenses } from '@/hooks/useExpenses'
import { useOutlets } from '@/hooks/useOutlets'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { ExpenseFormModal } from '@/components/ExpenseFormModal'
import { BulkImportModal } from '@/components/BulkImportModal'
import { deleteTransactionAction } from '@/app/actions/expenses'
import { CATEGORY_META } from '@/lib/expenseCategories'
import { rupiah } from '@/lib/format'
import { isExcludedOutlet } from '@/lib/outletFilters'

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c

function getFirstOfMonth() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function getLastOfMonth() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export default function BukuKasPage() {
  const { isChecker } = useFinanceRole()
  const { data: outlets = [] } = useOutlets()
  const queryClient = useQueryClient()

  // Default: Filter Hari Ini (Today) & Semua Outlet
  const [startDate, setStartDate] = useState(getToday)
  const [endDate, setEndDate] = useState(getToday)
  const [target, setTarget] = useState<string>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null)

  // Delete transaction state
  const [deletingTx, setDeletingTx] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const isPusat = target === 'PUSAT'
  const isAllOutlets = target === 'ALL_OUTLETS'

  const filter = useMemo(() => ({
    from: startDate,
    to: endDate,
    outletId: (isPusat || isAllOutlets) ? 'all' : target,
    source: 'monthly' as const
  }), [startDate, endDate, target, isPusat, isAllOutlets])

  const { rows: expenseRows = [], loading: expensesLoading, error: expensesError } = useExpenses(filter)

  // Pure OPEX Expense Rows
  const allTransactions = useMemo(() => {
    let list: any[] = []

    expenseRows.forEach(r => {
      if (target === 'PUSAT' && r.scope === 'outlet') return
      if (target === 'ALL_OUTLETS' && r.scope === 'pusat') return
      if (target !== 'all' && target !== 'PUSAT' && target !== 'ALL_OUTLETS' && (r.scope === 'pusat' || r.outlet_id !== target)) return
      
      list.push({
        id: r.id,
        date: r.expense_date,
        category: r.category,
        outlet_name: r.outlet_name ?? (r.scope === 'pusat' ? 'Kantor Pusat' : '-'),
        recipient_name: r.recipient_name ?? '-',
        division: r.division ?? (r.scope === 'pusat' ? 'General' : '-'),
        description: r.description,
        amount: r.amount,
        type: 'expense',
        receipt_url: r.receipt_url || null,
        isTopup: false
      })
    })

    // Sort descending by date
    list.sort((a, b) => b.date.localeCompare(a.date))
    return list
  }, [expenseRows, target])

  // Summary OPEX calculation
  const summary = useMemo(() => {
    let totalOpex = 0
    let salary = 0
    let nonSalary = 0
    let pusat = 0
    let outlet = 0

    allTransactions.forEach(t => {
      const amt = Number(t.amount || 0)
      totalOpex += amt
      if (t.category === 'salary') {
        salary += amt
      } else {
        nonSalary += amt
      }
      if (t.outlet_name === 'Kantor Pusat') {
        pusat += amt
      } else {
        outlet += amt
      }
    })

    return {
      totalOpex,
      salary,
      nonSalary,
      pusat,
      outlet,
      count: allTransactions.length
    }
  }, [allTransactions])

  const validOutlets = useMemo(() => {
    return outlets.filter(o => !isExcludedOutlet(o))
  }, [outlets])

  const selectOptions = useMemo(() => [
    { label: '🏢 Semua Unit (Cabang & Pusat)', value: 'all' },
    { label: '🏪 Semua Outlet (Khusus Cabang)', value: 'ALL_OUTLETS' },
    { label: '🏢 Kantor Pusat (OPEX Pusat)', value: 'PUSAT' },
    ...validOutlets.map(o => ({ label: `🏪 ${o.name}`, value: o.id }))
  ], [validOutlets])

  const loading = expensesLoading

  // Export to Excel handler using ExcelJS
  const handleExportExcel = async () => {
    if (allTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor pada rentang tanggal ini.')
      return
    }

    try {
      const ExcelJS = (await import('exceljs')).default
      const { saveAs } = await import('file-saver')
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Laporan OPEX')

      worksheet.mergeCells('A1:I1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = 'Laporan Pengeluaran OPEX - SukaShawarma'
      titleCell.font = { size: 14, bold: true }

      worksheet.getCell('A3').value = `Periode: ${startDate} s/d ${endDate}`
      worksheet.getCell('A3').font = { bold: true }

      const headers = ['No', 'Tanggal', 'Unit / Cabang', 'Nama Pemohon', 'Divisi', 'Kategori', 'Keterangan', 'Bukti Nota', 'Nominal Pengeluaran (Rp)']
      const headerRow = worksheet.getRow(5)
      headerRow.values = headers
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
      })

      let curIdx = 6
      allTransactions.forEach((r, idx) => {
        const row = worksheet.getRow(curIdx)
        row.values = [
          idx + 1,
          r.date,
          r.outlet_name,
          r.recipient_name || '-',
          r.division || '-',
          labelOf(r.category),
          r.description || '-',
          r.receipt_url ? 'Ada Struk' : '-',
          r.amount
        ]
        row.getCell(9).numFmt = 'Rp #,##0'
        curIdx++
      })

      const totalRow = worksheet.getRow(curIdx)
      totalRow.values = ['TOTAL', '', '', '', '', '', '', '', summary.totalOpex]
      totalRow.font = { bold: true }
      totalRow.getCell(9).numFmt = 'Rp #,##0'

      worksheet.columns.forEach(col => { col.width = 16 })
      worksheet.getColumn(7).width = 30
      worksheet.getColumn(5).width = 24

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Laporan_OPEX_${startDate}_${endDate}.xlsx`)
      toast.success(`Berhasil mengunduh ${allTransactions.length} baris transaksi ke file Excel!`)
    } catch (e: any) {
      toast.error('Gagal mengekspor file: ' + e.message)
    }
  }

  // Export to CSV handler
  const handleExportCSV = () => {
    if (allTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor pada rentang tanggal ini.')
      return
    }

    try {
      const headers = ['No', 'Tanggal', 'Unit / Cabang', 'Nama Pemohon', 'Divisi', 'Kategori', 'Keterangan', 'Bukti Nota', 'Nominal Pengeluaran (Rp)']
      const rows = allTransactions.map((r, idx) => [
        idx + 1,
        `"${r.date}"`,
        `"${(r.outlet_name || '').replace(/"/g, '""')}"`,
        `"${(r.recipient_name || '-').replace(/"/g, '""')}"`,
        `"${(r.division || '-').replace(/"/g, '""')}"`,
        `"${labelOf(r.category).replace(/"/g, '""')}"`,
        `"${(r.description || '-').replace(/"/g, '""')}"`,
        `"${r.receipt_url ? 'Ada Struk' : '-'}"`,
        r.amount
      ])

      const summaryRow = [
        'TOTAL',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        summary.totalOpex
      ]

      const csvContent = '\uFEFF' + [
        headers.join(','),
        ...rows.map(e => e.join(',')),
        summaryRow.join(',')
      ].join('\r\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `Laporan_OPEX_${startDate}_${endDate}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Berhasil mengunduh ${allTransactions.length} baris transaksi ke file CSV!`)
    } catch (e: any) {
      toast.error('Gagal mengekspor file CSV: ' + e.message)
    }
  }

  // Quick preset handlers
  const setPreset = (preset: 'today' | 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days') => {
    const today = new Date()
    if (preset === 'today') {
      const t = today.toISOString().slice(0, 10)
      setStartDate(t)
      setEndDate(t)
    } else if (preset === 'this_month') {
      setStartDate(getFirstOfMonth())
      setEndDate(getLastOfMonth())
    } else if (preset === 'last_month') {
      const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
      const m = today.getMonth() === 0 ? 12 : today.getMonth()
      const padM = String(m).padStart(2, '0')
      const start = `${y}-${padM}-01`
      const end = new Date(y, m, 0).toISOString().slice(0, 10)
      setStartDate(start)
      setEndDate(end)
    } else if (preset === 'last_7_days') {
      const past = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      setStartDate(past.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    } else if (preset === 'last_30_days') {
      const past = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      setStartDate(past.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    }
  }

  // Delete transaction handler
  const handleConfirmDelete = async () => {
    if (!deletingTx) return
    setIsDeleting(true)
    try {
      await deleteTransactionAction({ id: deletingTx.id })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Transaksi berhasil dihapus!')
      setDeletingTx(null)
    } catch (err: any) {
      toast.error('Gagal menghapus transaksi: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengeluaran & OPEX"
        description="Pencatatan dan rincian beban operasional (Gaji, Operasional Cabang, dan Beban Kantor Pusat)."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="flex items-center gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 bg-white cursor-pointer"
          >
            <Download size={16} />
            Export Excel
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 bg-white cursor-pointer"
          >
            <FileText size={16} />
            Export CSV
          </Button>

          {isChecker && (
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 border-suka-orange text-suka-orange hover:bg-suka-orange/10 bg-white cursor-pointer"
            >
              <UploadCloud size={16} />
              Import CSV
            </Button>
          )}

          <Button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 bg-suka-orange hover:bg-amber-600 text-white font-bold cursor-pointer"
          >
            <Plus size={16} />
            Catat Pengeluaran
          </Button>
        </div>
      </PageHeader>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Target Outlet Selector */}
          <div className="w-full lg:w-80">
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Store size={14} className="text-suka-orange" />
              Target / Unit Outlet:
            </label>
            <TargetCombobox
              value={target}
              onChange={setTarget}
              options={selectOptions}
              className="w-full"
            />
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 self-end">
            <button
              onClick={() => setPreset('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                startDate === getToday() && endDate === getToday()
                  ? 'bg-suka-orange text-white shadow-sm'
                  : 'bg-suka-gray-100 text-gray-600 hover:bg-suka-gray-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setPreset('last_7_days')}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-suka-gray-100 text-gray-600 hover:bg-suka-gray-200 transition-all"
            >
              7 Hari
            </button>
            <button
              onClick={() => setPreset('this_month')}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-suka-gray-100 text-gray-600 hover:bg-suka-gray-200 transition-all"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPreset('last_month')}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-suka-gray-100 text-gray-600 hover:bg-suka-gray-200 transition-all"
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => setPreset('last_30_days')}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-suka-gray-100 text-gray-600 hover:bg-suka-gray-200 transition-all"
            >
              30 Hari
            </button>
          </div>
        </div>

        {/* Date Inputs */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-suka-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">Rentang Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold border border-suka-gray-200 rounded-xl px-3 py-2 bg-white text-suka-brown outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange"
            />
            <span className="text-xs text-gray-400 font-bold">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold border border-suka-gray-200 rounded-xl px-3 py-2 bg-white text-suka-brown outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange"
            />
          </div>
        </div>
      </div>

      {/* SUMMARY STATS (PURE OPEX) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total OPEX */}
        <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight size={14} /> Total Pengeluaran (OPEX)
            </div>
            <div className="text-2xl font-black text-rose-700 mt-1">
              {rupiah(summary.totalOpex)}
            </div>
            <div className="text-[11px] text-gray-400 font-semibold mt-0.5">
              {summary.count} transaksi operasional
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            OUT
          </div>
        </div>

        {/* Salary */}
        <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
              <Users size={14} /> Gaji & Payroll
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-1">
              {rupiah(summary.salary)}
            </div>
            <div className="text-[11px] text-gray-400 font-semibold mt-0.5">
              Beban gaji crew & kantor
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            PAY
          </div>
        </div>

        {/* Non-Salary OPEX */}
        <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
              <Store size={14} /> Operasional Cabang & Pusat
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {rupiah(summary.nonSalary)}
            </div>
            <div className="text-[11px] text-gray-400 font-semibold mt-0.5">
              Listrik, wifi, bahan, operasional
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            OPEX
          </div>
        </div>
      </div>

      {/* TABLE DATA */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-suka-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="font-extrabold text-suka-brown text-sm flex items-center gap-2">
            <FileText size={16} className="text-suka-orange" />
            Daftar Pengeluaran OPEX ({allTransactions.length})
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 font-medium">
            <div className="w-8 h-8 border-3 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Memuat data pengeluaran...
          </div>
        ) : allTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Wallet size={40} className="mx-auto mb-3 opacity-30 text-suka-orange" />
            <p className="font-bold text-gray-600">Belum ada pengeluaran</p>
            <p className="text-xs text-gray-400 mt-1">Tidak ada catatan pengeluaran OPEX pada filter dan rentang tanggal ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 border-b border-suka-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Unit / Cabang</th>
                  <th className="px-4 py-3">Nama Pemohon</th>
                  <th className="px-4 py-3">Divisi</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-3 py-3 text-center">Bukti Nota</th>
                  <th className="px-5 py-3 text-right">Nominal Pengeluaran (Rp)</th>
                  <th className="px-3 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {allTransactions.map((tx) => {
                  const hasReceipt = Boolean(tx.receipt_url)
                  return (
                    <tr key={tx.id} className="hover:bg-amber-50/30 transition-colors font-medium">
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 font-bold">
                        {tx.date}
                      </td>
                      <td className="px-4 py-3.5 text-suka-brown font-bold whitespace-nowrap">
                        {tx.outlet_name}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold text-gray-900">
                        {tx.recipient_name || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {tx.division && tx.division !== '-' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200">
                            {tx.division}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold text-[10px] border border-amber-100">
                          {labelOf(tx.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 max-w-xs truncate" title={tx.description}>
                        {tx.description || '-'}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {hasReceipt ? (
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptUrl(tx.receipt_url)}
                            title="Klik untuk melihat bukti nota / struk"
                            className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-lg text-[10px] border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Eye size={12} />
                            <span>Lihat Nota</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black whitespace-nowrap text-sm text-rose-600">
                        -{rupiah(tx.amount)}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDeletingTx(tx)}
                          title="Hapus Transaksi"
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PREVIEW BUKTI NOTA */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Bukti Struk / Invoice Pembelian
              </h3>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-gray-50 rounded-xl p-2">
              <img
                src={previewReceiptUrl}
                alt="Bukti Nota"
                className="max-h-[65vh] object-contain rounded-lg shadow-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS TRANSAKSI */}
      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center font-bold">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Hapus Transaksi Ini?</h3>
                <p className="text-xs text-gray-500">Data yang dihapus tidak dapat dipulihkan.</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 text-gray-700 border border-gray-200/60">
              <div className="flex justify-between">
                <span className="text-gray-400">Tanggal:</span>
                <span className="font-semibold">{deletingTx.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Unit / Cabang:</span>
                <span className="font-semibold">{deletingTx.outlet_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Keterangan:</span>
                <span className="font-semibold truncate max-w-[200px]">{deletingTx.description || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Nominal:</span>
                <span className="font-bold text-rose-600">{rupiah(deletingTx.amount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTx(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Ya, Hapus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {isFormOpen && (
        <ExpenseFormModal
          isOpen={isFormOpen}
          outlets={outlets as any}
          isAdmin={isChecker}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false)
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      )}

      {isImportOpen && (
        <BulkImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      )}
    </div>
  )
}
