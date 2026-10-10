// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
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
  Users,
  Pencil,
  ChevronRight,
  Search,
  Sparkles
} from 'lucide-react'
import { Button } from '@suka/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import { useExpenses } from '@/hooks/useExpenses'
import { useHRPayroll } from '@/hooks/useHRPayroll'
import { useOutlets } from '@/hooks/useOutlets'
import { useRole } from '@/components/layout/RoleContext'
import { ExpenseFormModal } from '@/components/ExpenseFormModal'
import { BulkImportModal } from '@/components/BulkImportModal'
import { OpexCardDetailModals, type OpexModalType } from '@/components/OpexCardDetailModals'
import { deleteTransactionAction } from '@/app/actions/expenses'
import { CATEGORY_META, isSalaryCategory, PENGELUARAN_CATEGORIES } from '@/lib/expenseCategories'
import { rupiah } from '@/lib/format'
import { isExcludedOutlet } from '@/lib/outletFilters'
import { generateOpexReportPDF } from '@/utils/opexPdfGenerator'
import { BUKU_KAS_PARAMS } from '@/lib/bukuKasLink'
import { calculateDateRangeProrata } from '@/lib/opexDateRangeProrata'

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c

function matchesCategory(category: string | undefined | null, selected: string) {
  if (selected === 'all') return true
  if (!category) return selected === 'lainnya'
  if (category === selected) return true
  if (category.toLowerCase() === selected.toLowerCase()) return true
  if (labelOf(category).toLowerCase() === labelOf(selected).toLowerCase()) return true
  return false
}

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

export default function InputPengeluaranPage() {
  const { role, outletId: userOutletId } = useRole()
  const isAdmin = role === 'ADMIN' || role === 'OWNER'
  const { data: outlets = [] } = useOutlets()
  const queryClient = useQueryClient()

  const searchParams = useSearchParams()
  const paramFrom = searchParams.get(BUKU_KAS_PARAMS.from)
  const paramTo = searchParams.get(BUKU_KAS_PARAMS.to)
  const paramOutlet = searchParams.get(BUKU_KAS_PARAMS.outlet)

  type PresetType = 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'last_30_days' | 'custom'
  const [activePreset, setActivePreset] = useState<PresetType>(() => (paramFrom || paramTo) ? 'custom' : 'today')
  const [startDate, setStartDate] = useState(() => paramFrom || getToday())
  const [endDate, setEndDate] = useState(() => paramTo || getToday())
  const [target, setTarget] = useState<string>(() => {
    if (paramOutlet) {
      if (paramOutlet === 'ffffffff-ffff-ffff-ffff-ffffffffffff') return 'PUSAT'
      return paramOutlet
    }
    return 'all'
  })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null)
  const [activeDetailModal, setActiveDetailModal] = useState<OpexModalType>(null)

  // Delete and Edit transaction state
  const [deletingTx, setDeletingTx] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingTx, setEditingTx] = useState<any | null>(null)

  // Table filters: category & search query
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const isPusat = target === 'PUSAT'
  const isAllOutlets = target === 'ALL_OUTLETS'

  const [sourceFilter, setSourceFilter] = useState<'all' | 'monthly' | 'petty_cash'>('all')

  const filter = useMemo(() => ({
    from: startDate,
    to: endDate,
    outletId: (isPusat || isAllOutlets) ? 'all' : target,
    source: sourceFilter
  }), [startDate, endDate, target, isPusat, isAllOutlets, sourceFilter])

  const { rows: expenseRows = [], loading: expensesLoading, error: expensesError, refetch: refetchExpenses } = useExpenses(filter)

  const hrPayrollFilter = useMemo(() => ({
    from: startDate,
    to: endDate,
    outletId: target
  }), [startDate, endDate, target])
  const { data: hrPayroll } = useHRPayroll(hrPayrollFilter)

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
        outlet_id: r.outlet_id,
        recipient_name: r.recipient_name ?? '-',
        division: r.division ?? (r.scope === 'pusat' ? 'General' : '-'),
        description: r.description,
        amount: r.amount,
        type: 'expense',
        receipt_url: r.receipt_url || null,
        isTopup: false,
        raw_description: r.raw_description || r.description,
        raw_category: r.raw_category || r.category,
        scope: r.scope,
        source: r.source || 'monthly'
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
      if (isSalaryCategory(t.category)) {
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

  // Prorata calculation based on current date filter (starts / ends)
  const prorataInfo = useMemo(() => calculateDateRangeProrata(startDate, endDate), [startDate, endDate])

  const hasHrPayroll = Boolean(hrPayroll && hrPayroll.totalStaff > 0 && hrPayroll.totalSalary > 0)

  // Prorated Salary according to the date range filter
  const displaySalary = useMemo(() => {
    if (!hasHrPayroll) return summary.salary
    if (!prorataInfo.isProrated) return hrPayroll!.totalSalary
    return Math.round(hrPayroll!.totalSalary * prorataInfo.ratio)
  }, [hasHrPayroll, hrPayroll, summary.salary, prorataInfo])

  const displayBasicSalary = useMemo(() => {
    if (!hasHrPayroll || !hrPayroll?.basicSalary) return 0
    if (!prorataInfo.isProrated) return hrPayroll.basicSalary
    return Math.round(hrPayroll.basicSalary * prorataInfo.ratio)
  }, [hasHrPayroll, hrPayroll, prorataInfo])

  const totalCombinedOpex = displaySalary + summary.nonSalary

  // Operational breakdown for details modal (Category & Outlet)
  const operationalBreakdown = useMemo(() => {
    const categoryMap = new Map<string, {
      category: string
      label: string
      count: number
      totalAmount: number
      color?: string
      icon?: any
    }>()

    const outletMap = new Map<string, {
      outletName: string
      count: number
      totalAmount: number
    }>()

    let nonSalaryCount = 0

    allTransactions.forEach(t => {
      if (isSalaryCategory(t.category)) return
      nonSalaryCount++
      const amt = Number(t.amount || 0)

      // By category
      const meta = CATEGORY_META[t.category as keyof typeof CATEGORY_META]
      const catKey = t.category || 'lainnya'
      let catItem = categoryMap.get(catKey)
      if (!catItem) {
        catItem = {
          category: catKey,
          label: meta?.label || labelOf(catKey),
          count: 0,
          totalAmount: 0,
          color: meta?.color || '#f59e0b',
          icon: meta?.icon
        }
        categoryMap.set(catKey, catItem)
      }
      catItem.count++
      catItem.totalAmount += amt

      // By outlet
      const outKey = t.outlet_name || 'Lainnya'
      let outItem = outletMap.get(outKey)
      if (!outItem) {
        outItem = {
          outletName: outKey,
          count: 0,
          totalAmount: 0
        }
        outletMap.set(outKey, outItem)
      }
      outItem.count++
      outItem.totalAmount += amt
    })

    const categories = Array.from(categoryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    const outlets = Array.from(outletMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)

    return {
      categories,
      outlets,
      count: nonSalaryCount
    }
  }, [allTransactions])

  // Available categories for filter dropdown with counts
  const availableCategories = useMemo(() => {
    const catMap = new Map<string, { value: string; label: string; count: number }>()

    allTransactions.forEach(tx => {
      const rawCat = tx.category || 'lainnya'
      const label = labelOf(rawCat)
      const existing = catMap.get(label)
      if (existing) {
        existing.count++
      } else {
        catMap.set(label, {
          value: rawCat,
          label,
          count: 1
        })
      }
    })

    const present = Array.from(catMap.values()).sort((a, b) => a.label.localeCompare(b.label))

    const others = (PENGELUARAN_CATEGORIES as readonly string[])
      .filter(catKey => !catMap.has(labelOf(catKey)))
      .map(catKey => ({
        value: catKey,
        label: labelOf(catKey),
        count: 0
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return { present, others }
  }, [allTransactions])

  // Filtered transactions based on selected category & search query
  const displayedTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      const matchCat = matchesCategory(tx.category, selectedCategory)
      if (!matchCat) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const desc = (tx.description || '').toLowerCase()
      const outlet = (tx.outlet_name || '').toLowerCase()
      const recipient = (tx.recipient_name || '').toLowerCase()
      const division = (tx.division || '').toLowerCase()
      const catLabel = labelOf(tx.category).toLowerCase()

      return desc.includes(q) || outlet.includes(q) || recipient.includes(q) || division.includes(q) || catLabel.includes(q)
    })
  }, [allTransactions, selectedCategory, searchQuery])

  // Total amount of currently displayed transactions in table
  const displayedTotalOpex = useMemo(() => {
    return displayedTransactions.reduce((acc, tx) => acc + Number(tx.amount || 0), 0)
  }, [displayedTransactions])

  // Category counts and totals for quick badges
  const categoryFilterStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {}
    allTransactions.forEach(tx => {
      const k = tx.category || 'lainnya'
      if (!stats[k]) stats[k] = { count: 0, total: 0 }
      stats[k].count++
      stats[k].total += Number(tx.amount || 0)
    })
    return stats
  }, [allTransactions])

  const validOutlets = useMemo(() => {
    return outlets.filter(o => !isExcludedOutlet(o))
  }, [outlets])

  const selectOptions = useMemo(() => [
    { label: 'Semua Unit (Cabang & Pusat)', value: 'all' },
    { label: 'Semua Outlet (Khusus Cabang)', value: 'ALL_OUTLETS' },
    ...(isAdmin ? [{ label: 'Kantor Pusat (OPEX Pusat)', value: 'PUSAT' }] : []),
    ...validOutlets.map(o => ({ label: o.name, value: o.id }))
  ], [isAdmin, validOutlets])

  const loading = expensesLoading

  // Export to Excel handler using ExcelJS
  const handleExportExcel = async () => {
    if (displayedTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor pada filter ini.')
      return
    }

    try {
      const ExcelJS = (await import('exceljs')).default
      const { saveAs } = await import('file-saver')
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Laporan OPEX')

      worksheet.mergeCells('A1:J1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = 'Laporan Pengeluaran OPEX - SukaShawarma'
      titleCell.font = { size: 14, bold: true }

      worksheet.getCell('A3').value = `Periode: ${startDate} s/d ${endDate}${selectedCategory !== 'all' ? ` | Kategori: ${labelOf(selectedCategory)}` : ''}`
      worksheet.getCell('A3').font = { bold: true }

      const headers = ['No', 'Tanggal', 'Unit / Cabang', 'Sumber Biaya', 'Nama Pemohon', 'Divisi', 'Kategori', 'Keterangan', 'Bukti Nota', 'Nominal Pengeluaran (Rp)']
      const headerRow = worksheet.getRow(5)
      headerRow.values = headers
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
      })

      let curIdx = 6
      displayedTransactions.forEach((r, idx) => {
        const row = worksheet.getRow(curIdx)
        row.values = [
          idx + 1,
          r.date,
          r.outlet_name,
          r.source === 'petty_cash' ? 'Kasir POS' : 'Transfer Bulanan',
          r.recipient_name || '-',
          r.division || '-',
          labelOf(r.category),
          r.description || '-',
          r.receipt_url ? 'Ada Struk' : '-',
          r.amount
        ]
        row.getCell(10).numFmt = 'Rp #,##0'
        curIdx++
      })

      const totalRow = worksheet.getRow(curIdx)
      totalRow.values = ['TOTAL', '', '', '', '', '', '', '', '', displayedTotalOpex]
      totalRow.font = { bold: true }
      totalRow.getCell(10).numFmt = 'Rp #,##0'

      worksheet.columns.forEach(col => { col.width = 16 })
      worksheet.getColumn(8).width = 30
      worksheet.getColumn(6).width = 24

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Laporan_OPEX_${startDate}_${endDate}.xlsx`)
      toast.success(`Berhasil mengunduh ${displayedTransactions.length} baris transaksi ke file Excel!`)
    } catch (e: any) {
      toast.error('Gagal mengekspor file: ' + e.message)
    }
  }

  // Export to CSV handler
  const handleExportCSV = () => {
    if (displayedTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor pada filter ini.')
      return
    }

    try {
      const headers = ['No', 'Tanggal', 'Unit / Cabang', 'Sumber Biaya', 'Nama Pemohon', 'Divisi', 'Kategori', 'Keterangan', 'Bukti Nota', 'Nominal Pengeluaran (Rp)']
      const rows = displayedTransactions.map((r, idx) => [
        idx + 1,
        `"${r.date}"`,
        `"${(r.outlet_name || '').replace(/"/g, '""')}"`,
        `"${r.source === 'petty_cash' ? 'Kasir POS' : 'Transfer Bulanan'}"`,
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
        '',
        displayedTotalOpex
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

      toast.success(`Berhasil mengunduh ${displayedTransactions.length} baris transaksi ke file CSV!`)
    } catch (e: any) {
      toast.error('Gagal mengekspor file CSV: ' + e.message)
    }
  }

  // Export to PDF handler with Admin, Finance, and Director signatures
  const handleExportPDF = async () => {
    if (displayedTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor ke PDF pada filter ini.')
      return
    }

    try {
      toast.info('Menyiapkan dokumen PDF OPEX...')
      const targetOption = selectOptions.find(o => o.value === target)
      const targetLabel = targetOption ? targetOption.label : 'Semua Unit'
      const categorySuffix = selectedCategory !== 'all' ? ` - Kategori: ${labelOf(selectedCategory)}` : ''

      await generateOpexReportPDF({
        startDate,
        endDate,
        targetLabel: `${targetLabel}${categorySuffix}`,
        items: displayedTransactions.map(t => ({
          date: t.date,
          outlet_name: t.outlet_name,
          recipient_name: t.recipient_name,
          division: t.division,
          category: t.category,
          category_label: labelOf(t.category),
          description: `${t.source === 'petty_cash' ? '[Kasir POS] ' : ''}${t.description || ''}`,
          amount: t.amount,
          receipt_url: t.receipt_url
        })),
        totalAmount: displayedTotalOpex
      })
      toast.success('Laporan PDF OPEX berhasil diunduh!')
    } catch (e: any) {
      console.error('PDF export error:', e)
      toast.error('Gagal membuat file PDF: ' + (e?.message || 'Error'))
    }
  }

  // Quick preset handlers
  const setPreset = (preset: PresetType) => {
    setActivePreset(preset)
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
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 border-rose-500 text-rose-600 hover:bg-rose-50 bg-white cursor-pointer shadow-2xs text-xs px-3 py-2 h-9"
            title="Download Laporan Resmi OPEX ke format PDF dengan tanda tangan Admin, Finance, dan Direktur"
          >
            <FileText size={15} />
            <span>Export PDF</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 border-emerald-500 text-emerald-600 hover:bg-emerald-50 bg-white cursor-pointer text-xs px-3 py-2 h-9"
          >
            <Download size={15} />
            <span>Export Excel</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50 bg-white cursor-pointer text-xs px-3 py-2 h-9"
          >
            <FileText size={15} />
            <span>Export CSV</span>
          </Button>

          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 border-suka-orange text-suka-orange hover:bg-suka-orange/10 bg-white cursor-pointer text-xs px-3 py-2 h-9"
            >
              <UploadCloud size={15} />
              <span>Import CSV</span>
            </Button>
          )}

          <Button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1.5 bg-suka-orange hover:bg-amber-600 text-white font-bold cursor-pointer text-xs px-3.5 py-2 h-9 shadow-xs"
          >
            <Plus size={15} />
            <span>Catat Pengeluaran</span>
          </Button>
        </div>
      </PageHeader>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-suka-gray-200 shadow-xs flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Outlet Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-600 shrink-0">
            Outlet:
          </span>
          <div className="w-56 sm:w-64">
            <TargetCombobox
              value={target}
              onChange={setTarget}
              options={selectOptions}
              icon={null}
              className="w-full text-xs"
            />
          </div>
        </div>

        <div className="h-6 w-px bg-suka-gray-200 hidden sm:block" />

        {/* Date Presets Pills */}
        <div className="flex items-center gap-1 bg-suka-gray-100/90 p-1 rounded-xl border border-suka-gray-200/60 shrink-0 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setPreset('today')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activePreset === 'today'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setPreset('last_7_days')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activePreset === 'last_7_days'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => setPreset('this_month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activePreset === 'this_month'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => setPreset('last_month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activePreset === 'last_month'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Bulan Lalu
          </button>
          <button
            type="button"
            onClick={() => setPreset('last_30_days')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activePreset === 'last_30_days'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            30 Hari
          </button>
          <button
            type="button"
            onClick={() => setPreset('custom')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activePreset === 'custom'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Datepicker (Only shown in Custom preset, directly adjacent) */}
        {activePreset === 'custom' && (
          <>
            <div className="h-6 w-px bg-suka-gray-200 hidden md:block" />
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1 shrink-0">
                <Calendar size={14} className="text-suka-orange" />
                Tanggal:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs font-semibold border border-suka-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-suka-brown outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange shadow-2xs"
                />
                <span className="text-xs text-gray-400 font-bold px-0.5">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs font-semibold border border-suka-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-suka-brown outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange shadow-2xs"
                />
              </div>
            </div>
          </>
        )}

        <div className="h-6 w-px bg-suka-gray-200 hidden md:block" />

        {/* Filter Sumber Biaya OPEX */}
        <div className="flex items-center gap-1 bg-suka-gray-100/90 p-1 rounded-xl border border-suka-gray-200/60 shrink-0">
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              sourceFilter === 'all'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Semua OPEX
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('monthly')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              sourceFilter === 'monthly'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Buku Kas Bulanan
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('petty_cash')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              sourceFilter === 'petty_cash'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Kas Kecil POS
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {expensesError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-xl shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Gagal Memuat Data Pengeluaran</h4>
              <p className="text-xs text-rose-700 mt-0.5">{expensesError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetchExpenses()}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* SUMMARY STATS (PURE OPEX) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* 1. Gaji & Payroll */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 flex-wrap min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <Users size={14} className="shrink-0" />
                  <span>Gaji & Payroll</span>
                </div>
                {hrPayroll?.status === 'draft' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Draft HR ({hrPayroll.draftCount} staff)
                  </span>
                )}
                {hrPayroll?.status === 'finalized' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Sudah Difinalisasi
                  </span>
                )}
                {hrPayroll?.status === 'partial' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {hrPayroll.finalizedCount} Final · {hrPayroll.draftCount} Draft
                  </span>
                )}
                {hasHrPayroll && prorataInfo.isProrated && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300/70 shadow-2xs"
                    title={`Prorata ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari periode payroll (${(prorataInfo.ratio * 100).toFixed(1)}%)`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{prorataInfo.label}</span>
                  </span>
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                PAY
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-2 tracking-tight truncate" title={rupiah(displaySalary)}>
              {rupiah(displaySalary)}
            </div>

            <div className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
              {hasHrPayroll ? (
                <span>
                  Total THP HR ({hrPayroll!.crewCount ?? hrPayroll!.totalStaff} staf)
                  {Boolean(hrPayroll!.managerAllocation && hrPayroll!.managerAllocation > 0) && (
                    <span className="text-[10px] text-indigo-600 font-bold ml-1.5" title={`Termasuk alokasi beban AM & RM: ${rupiah(hrPayroll!.managerAllocation)}`}>
                      • Termasuk AM/RM
                    </span>
                  )}
                  {prorataInfo.isProrated && (
                    <span className="text-[10px] text-amber-700 font-bold ml-1.5" title="Nilai acuan payroll sebulan penuh sebelum prorata">
                      • Baseline 1 bln: {rupiah(hrPayroll!.totalSalary)}
                    </span>
                  )}
                  {Boolean(displayBasicSalary > 0) && (
                    <span className="text-[10px] text-indigo-600 font-bold ml-1.5" title={prorataInfo.isProrated ? "Gaji Pokok Prorata" : "Total Gaji Pokok Murni"}>
                      • Gapok: {rupiah(displayBasicSalary)}
                    </span>
                  )}
                  {summary.salary > 0 && summary.salary !== displaySalary && (
                    <span className="text-[10px] text-gray-400 font-normal ml-1">
                      • Kas: {rupiah(summary.salary)}
                    </span>
                  )}
                </span>
              ) : (
                'Beban gaji crew & kantor'
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveDetailModal('salary')}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-[10px] text-gray-400 font-medium">
              {hasHrPayroll && prorataInfo.isProrated ? `Prorata ${prorataInfo.overlapDays} Hari` : 'Breakdown Staf'}
            </span>
          </div>
        </div>

        {/* 2. Operasional Outlet & Pusat */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1 truncate">
                <Store size={14} className="shrink-0" />
                <span className="truncate">Operasional Outlet & Pusat</span>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">
                OPEX
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-black text-amber-700 mt-2 tracking-tight truncate" title={rupiah(summary.nonSalary)}>
              {rupiah(summary.nonSalary)}
            </div>

            <div className="text-[11px] text-gray-400 font-semibold mt-0.5 truncate">
              Listrik, wifi, operasional ({operationalBreakdown.count} transaksi)
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveDetailModal('operational')}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors cursor-pointer group"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-[10px] text-gray-400 font-medium">Per Kategori & Cabang</span>
          </div>
        </div>

        {/* 3. Total OPEX (Kas / Gabungan) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5 flex-wrap min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <ArrowUpRight size={14} className="shrink-0" />
                  <span>Total OPEX</span>
                </div>
                {hasHrPayroll && prorataInfo.isProrated && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 shadow-2xs"
                    title="Termasuk beban gaji prorata sesuai rentang filter"
                  >
                    <Sparkles className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>Prorata Gaji</span>
                  </span>
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                OUT
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-black text-rose-700 mt-2 tracking-tight truncate" title={rupiah(totalCombinedOpex)}>
              {rupiah(totalCombinedOpex)}
            </div>

            <div className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
              <span>Gaji{hasHrPayroll && prorataInfo.isProrated ? ' (Prorata)' : ''}: {rupiah(displaySalary)}</span>
              <span className="text-gray-400 mx-1">+</span>
              <span>Opex: {rupiah(summary.nonSalary)}</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveDetailModal('total')}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer group"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-[10px] text-gray-400 font-medium">Rumus & Akumulasi</span>
          </div>
        </div>
      </div>

      {/* TABLE DATA */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-suka-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
          <div className="font-extrabold text-suka-brown text-sm flex items-center gap-2 flex-wrap">
            <FileText size={16} className="text-suka-orange shrink-0" />
            <span>Daftar Pengeluaran OPEX</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-suka-orange/10 text-suka-orange border border-suka-orange/20">
              {displayedTransactions.length}
              {displayedTransactions.length !== allTransactions.length && ` / ${allTransactions.length}`}
            </span>
            {selectedCategory !== 'all' && (
              <span className="text-[11px] font-semibold text-gray-500 hidden sm:inline">
                • Kategori: <strong className="text-suka-brown">{labelOf(selectedCategory)}</strong>
              </span>
            )}
          </div>

          {/* Filter Kategori & Pencarian */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filter Kategori Dropdown */}
            <div className="relative flex-1 sm:flex-none min-w-[180px]">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                <Filter size={13} className="text-suka-orange" />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full pl-8 pr-7 py-1.5 border border-suka-gray-200 rounded-xl leading-5 bg-white text-suka-brown font-bold focus:outline-none focus:ring-1 focus:ring-suka-orange focus:border-suka-orange transition-colors text-xs cursor-pointer shadow-2xs"
                title="Filter berdasarkan kategori pengeluaran"
              >
                <option value="all">Semua Kategori ({allTransactions.length})</option>
                {availableCategories.present.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.count})
                  </option>
                ))}
                {availableCategories.others.length > 0 && (
                  <optgroup label="Kategori Lainnya (0 Data)">
                    {availableCategories.others.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label} (0)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Pencarian Keterangan / Pemohon */}
            <div className="relative flex-1 sm:flex-none min-w-[150px] sm:w-48">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                <Search size={13} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pengeluaran..."
                className="block w-full pl-8 pr-7 py-1.5 border border-suka-gray-200 rounded-xl leading-5 bg-white text-suka-brown font-medium placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-suka-orange focus:border-suka-orange transition-colors text-xs shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Tombol Reset Filter */}
            {(selectedCategory !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all')
                  setSearchQuery('')
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl border border-rose-200 transition-all cursor-pointer shrink-0"
                title="Reset semua filter"
              >
                <X size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 font-medium">
            <div className="w-8 h-8 border-3 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Memuat data pengeluaran...
          </div>
        ) : expensesError ? (
          <div className="p-12 text-center text-gray-400">
            <AlertTriangle size={40} className="mx-auto mb-3 text-rose-500 opacity-70" />
            <p className="font-bold text-rose-700">Terjadi Kesalahan Saat Mengambil Data</p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">{expensesError}</p>
            <button
              type="button"
              onClick={() => refetchExpenses()}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
            >
              Muat Ulang Data
            </button>
          </div>
        ) : allTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Wallet size={40} className="mx-auto mb-3 opacity-30 text-suka-orange" />
            <p className="font-bold text-gray-600">Belum ada pengeluaran</p>
            <p className="text-xs text-gray-400 mt-1">Tidak ada catatan pengeluaran OPEX pada filter dan rentang tanggal ini.</p>
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Filter size={40} className="mx-auto mb-3 opacity-30 text-suka-orange" />
            <p className="font-bold text-gray-600">Tidak ada pengeluaran yang cocok</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {selectedCategory !== 'all' && searchQuery
                ? `Tidak ditemukan pengeluaran dengan kategori "${labelOf(selectedCategory)}" dan pencarian "${searchQuery}".`
                : selectedCategory !== 'all'
                ? `Tidak ditemukan pengeluaran dengan kategori "${labelOf(selectedCategory)}".`
                : `Tidak ditemukan pengeluaran yang sesuai dengan pencarian "${searchQuery}".`}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all')
                setSearchQuery('')
              }}
              className="mt-3.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl border border-amber-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <X size={13} />
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse min-w-[960px]">
              <thead className="bg-gray-50 border-b border-suka-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Outlet</th>
                  <th className="px-3 py-3 text-center">Sumber</th>
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
                {displayedTransactions.map((tx) => {
                  const hasReceipt = Boolean(tx.receipt_url)
                  return (
                    <tr key={tx.id} className="hover:bg-amber-50/30 transition-colors font-medium">
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 font-bold">
                        {tx.date}
                      </td>
                      <td className="px-4 py-3.5 text-suka-brown font-bold whitespace-nowrap">
                        {tx.outlet_name}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {tx.source === 'petty_cash' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200" title="Kas Kecil Laci Kasir POS">
                            Kasir POS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200" title="Buku Kas Bulanan / Transfer Bank">
                            Bulanan
                          </span>
                        )}
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
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(tx.category)}
                          title={`Klik untuk filter hanya kategori ${labelOf(tx.category)}`}
                          className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[10px] border border-amber-100 transition-colors cursor-pointer text-left"
                        >
                          {labelOf(tx.category)}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 min-w-[200px] max-w-sm whitespace-normal break-words leading-relaxed" title={tx.description}>
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
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingTx(tx)}
                            title="Edit Transaksi OPEX"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTx(tx)}
                            title="Hapus Transaksi"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {displayedTransactions.length > 0 && (
                <tfoot className="bg-gray-50/90 border-t-2 border-suka-gray-200 text-xs font-bold">
                  <tr>
                    <td colSpan={8} className="px-4 py-3.5 text-right uppercase tracking-wider text-gray-500 font-extrabold">
                      Total Pengeluaran OPEX ({displayedTransactions.length} Transaksi{displayedTransactions.length !== allTransactions.length ? ' Terfilter' : ''}):
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-sm text-rose-600 whitespace-nowrap">
                      -{rupiah(displayedTotalOpex)}
                    </td>
                    <td className="px-3 py-3.5"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* MODAL PREVIEW BUKTI NOTA */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
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
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 rounded-xl p-3 my-4 min-h-0">
              <img
                src={previewReceiptUrl}
                alt="Bukti Nota"
                className="max-h-[60vh] object-contain rounded-lg shadow-xs"
              />
            </div>
            <div className="flex justify-end pt-2 border-t border-gray-100 shrink-0">
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
          isAdmin={isAdmin}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false)
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      )}

      {editingTx && (
        <ExpenseFormModal
          isOpen={Boolean(editingTx)}
          initialData={editingTx}
          outlets={outlets as any}
          isAdmin={isAdmin}
          onClose={() => setEditingTx(null)}
          onSuccess={() => {
            setEditingTx(null)
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      )}

      {isImportOpen && (
        <BulkImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => {
            setIsImportOpen(false)
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      )}

      {/* MODAL RINCIAN DETAIL OPEX */}
      <OpexCardDetailModals
        type={activeDetailModal}
        onClose={() => setActiveDetailModal(null)}
        salaryData={{
          displaySalary,
          hasHrPayroll,
          hrPayroll,
          cashSalary: summary.salary,
          isProrated: hasHrPayroll && prorataInfo.isProrated,
          prorataInfo
        }}
        operationalData={{
          totalNonSalary: summary.nonSalary,
          totalCount: operationalBreakdown.count,
          categories: operationalBreakdown.categories,
          outlets: operationalBreakdown.outlets
        }}
        totalOpexData={{
          totalCombined: totalCombinedOpex,
          displaySalary,
          totalNonSalary: summary.nonSalary,
          isProrated: hasHrPayroll && prorataInfo.isProrated,
          prorataInfo
        }}
      />
    </div>
  )
}
