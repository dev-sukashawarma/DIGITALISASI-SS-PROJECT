'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  FileText,
  Download,
  Calendar,
  Store,
  Eye,
  X,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Wallet,
  Clock,
  Receipt,
  Building2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@suka/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { clearPeriodCache } from '@/lib/periodCache'
import { createThrottledRefresher } from '@/lib/realtimeThrottle'
import { PageHeader } from '@/components/ui'
import { TargetCombobox, type TargetOption } from '@/components/TargetCombobox'
import { useExpenses } from '@/hooks/useExpenses'
import { useOutlets } from '@/hooks/useOutlets'
import { useAuth } from '@suka/auth'
import { ManagerOpexDetailModal, type ManagerModalType, type TransactionItem } from '@/components/ManagerOpexDetailModal'
import { CATEGORY_META, isLemburExpense, PENGELUARAN_CATEGORIES } from '@/lib/expenseCategories'
import { rupiah } from '@/lib/format'
import { isExcludedOutlet } from '@/lib/outletFilters'
import { generateOpexReportPDF } from '@/utils/opexPdfGenerator'
import { BUKU_KAS_PARAMS } from '@/lib/bukuKasLink'
import { isMitraOutlet } from '@/lib/outletOwnership'

function formatLastUpdated(dateIso?: string | null) {
  if (!dateIso) return ''
  try {
    const d = new Date(dateIso)
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' WIB'
  } catch {
    return ''
  }
}

const labelOf = (c?: string | null) => (c ? CATEGORY_META[c]?.label ?? c : 'Lainnya')

function matchesCategory(category: string | undefined | null, selected: string) {
  if (selected === 'all') return true
  if (!category) return selected === 'lainnya'
  if (category === selected) return true
  if (category.toLowerCase() === selected.toLowerCase()) return true
  if (labelOf(category).toLowerCase() === labelOf(selected).toLowerCase()) return true
  return false
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getFirstOfMonth(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function getLastOfMonth(d = new Date()) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const lastDay = new Date(y, m, 0).getDate()
  const padM = String(m).padStart(2, '0')
  return `${y}-${padM}-${String(lastDay).padStart(2, '0')}`
}

function getToday(d = new Date()) {
  return formatLocalDate(d)
}

type SortField = 'date' | 'amount' | 'outlet_name' | 'recipient_name' | 'category' | 'source'
type SortDirection = 'asc' | 'desc'
type PresetType = 'yesterday' | 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'custom'

function BukuKasContent() {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const isAreaManager = outletStaff?.role === 'area_manager'
  const { data: rawOutlets = [] } = useOutlets()
  const outlets = useMemo(() => rawOutlets.filter(o => !isExcludedOutlet(o)), [rawOutlets])

  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  // Inisialisasi null untuk cegah React SSR Hydration mismatch
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  useEffect(() => {
    setLastUpdated(new Date().toISOString())
  }, [])

  const [isRefreshing, setIsRefreshing] = useState(false)

  const searchParams = useSearchParams()
  const paramFrom = searchParams.get(BUKU_KAS_PARAMS.from)
  const paramTo = searchParams.get(BUKU_KAS_PARAMS.to)
  const paramOutlet = searchParams.get(BUKU_KAS_PARAMS.outletId) || searchParams.get(BUKU_KAS_PARAMS.outlet)
  const paramSource = searchParams.get(BUKU_KAS_PARAMS.source)
  const paramCategory = searchParams.get(BUKU_KAS_PARAMS.category)

  const [activePreset, setActivePreset] = useState<PresetType>(() => {
    if (!paramFrom && !paramTo) return 'today'
    const today = new Date()
    const todayStr = formatLocalDate(today)
    const yesterdayStr = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
    const firstOfMonthStr = getFirstOfMonth(today)
    if (paramFrom === todayStr && paramTo === todayStr) return 'today'
    if (paramFrom === yesterdayStr && paramTo === yesterdayStr) return 'yesterday'
    if (paramFrom === firstOfMonthStr && paramTo === todayStr) return 'this_month'

    const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
    const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth()
    const padM = String(prevMonth).padStart(2, '0')
    const lastMonthStart = `${prevYear}-${padM}-01`
    const lastDay = new Date(prevYear, prevMonth, 0).getDate()
    const lastMonthEnd = `${prevYear}-${padM}-${String(lastDay).padStart(2, '0')}`
    if (paramFrom === lastMonthStart && paramTo === lastMonthEnd) return 'last_month'

    const past7 = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6))
    if (paramFrom === past7 && paramTo === todayStr) return 'last_7_days'

    return 'custom'
  })

  const [startDate, setStartDate] = useState<string>(() => {
    if (paramFrom) return paramFrom
    return getToday()
  })

  const [endDate, setEndDate] = useState<string>(() => {
    if (paramTo) return paramTo
    return getToday()
  })

  // Sinkronisasi target outlet dengan header layout
  const [target, setTarget] = useState<string>(() => {
    if (paramOutlet && paramOutlet !== 'all') {
      return paramOutlet
    }
    return 'ALL_OUTLETS'
  })

  // Update target jika URL berubah (misal dari GlobalOutletFilter di Header)
  useEffect(() => {
    if (paramOutlet && paramOutlet !== 'all' && paramOutlet !== target) {
      setTarget(paramOutlet)
    } else if ((!paramOutlet || paramOutlet === 'all') && target !== 'ALL_OUTLETS' && target !== 'INTERNAL_OUTLETS' && target !== 'MITRA_OUTLETS') {
      setTarget('ALL_OUTLETS')
    }
  }, [paramOutlet, target])

  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null)
  const [imgLoadError, setImgLoadError] = useState(false)
  const [activeDetailModal, setActiveDetailModal] = useState<ManagerModalType>(null)

  // Table filters & sorting
  const [selectedCategory, setSelectedCategory] = useState<string>(() => paramCategory || 'all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'amount' ? 'desc' : 'asc')
    }
  }

  const isGroupTarget = target === 'INTERNAL_OUTLETS' || target === 'MITRA_OUTLETS'
  const isAllOutlets = target === 'ALL_OUTLETS' || isGroupTarget

  const inTargetGroup = useCallback((outletId: string | null | undefined) => {
    if (!isGroupTarget) return true
    const matched = outlets.find(o => o.id === outletId)
    const isMitra = isMitraOutlet(matched, new Set())
    return target === 'MITRA_OUTLETS' ? isMitra : !isMitra
  }, [isGroupTarget, target, outlets])

  const [sourceFilter, setSourceFilter] = useState<'all' | 'monthly' | 'petty_cash'>(
    () => (paramSource === 'monthly' || paramSource === 'petty_cash' ? paramSource : 'all')
  )

  // Sinkronisasi pilihan target dengan URL SearchParams dua arah
  const handleTargetChange = (val: string) => {
    setTarget(val)
    const params = new URLSearchParams(searchParams.toString())
    if (val === 'ALL_OUTLETS' || val === 'all') {
      params.delete(BUKU_KAS_PARAMS.outletId)
      params.delete(BUKU_KAS_PARAMS.outlet)
    } else {
      params.set(BUKU_KAS_PARAMS.outletId, val)
    }
    router.push(`?${params.toString()}`)
  }

  const filter = useMemo(() => ({
    from: startDate,
    to: endDate,
    outletId: isAllOutlets ? 'all' : target,
    source: sourceFilter
  }), [startDate, endDate, target, isAllOutlets, sourceFilter])

  const { expenses: expenseRows = [], isLoading: expensesLoading } = useExpenses(filter)

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      clearPeriodCache()
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['expenses'] }),
        queryClient.refetchQueries({ queryKey: ['outlets'] }),
      ])
      setLastUpdated(new Date().toISOString())
      toast.success('Data pengeluaran operasional berhasil diperbarui')
    } catch (err) {
      console.error('Failed to refresh data:', err)
      toast.error('Gagal memperbarui data pengeluaran')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Supabase Realtime Listener (Throttled 20s)
  useEffect(() => {
    const refresher = createThrottledRefresher(() => {
      clearPeriodCache()
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['outlets'] })
      setLastUpdated(new Date().toISOString())
    }, 20_000)

    const invalidate = () => refresher.trigger()

    const channel = supabase
      .channel('manager-buku-kas-realtime-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_expenses' }, invalidate)
      .subscribe()

    return () => {
      refresher.dispose()
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  // Pure OPEX Expense Rows (Tanpa Gaji, Tanpa Kantor Pusat)
  const allTransactions: TransactionItem[] = useMemo(() => {
    const list: TransactionItem[] = []

    expenseRows.forEach(r => {
      if (r.scope === 'pusat' || !r.outlet_id) return
      if (isGroupTarget && !inTargetGroup(r.outlet_id)) return
      if (!isAllOutlets && r.outlet_id !== target) return
      
      const isLembur = isLemburExpense(r.category, r.description)
      const effectiveCategory = isLembur ? 'lembur' : (r.category || 'lainnya')

      list.push({
        id: r.id,
        date: r.expense_date || '',
        category: effectiveCategory,
        outlet_name: r.outlet_name ?? 'Outlet',
        outlet_id: r.outlet_id,
        recipient_name: r.recipient_name ?? '-',
        description: r.description ?? '',
        amount: Number(r.amount) || 0,
        receipt_url: r.receipt_url || null,
        source: r.source || 'monthly',
        isLembur
      })
    })

    // Sort descending by date, tie-break by amount descending
    list.sort((a, b) => {
      const cmpDate = (b.date || '').localeCompare(a.date || '')
      if (cmpDate !== 0) return cmpDate
      return (b.amount || 0) - (a.amount || 0)
    })
    return list
  }, [expenseRows, target, isGroupTarget, isAllOutlets, inTargetGroup])

  // Summary OPEX calculation (100% konsisten antara kartu dan tabel)
  const summary = useMemo(() => {
    let lemburTotal = 0
    let lemburCount = 0
    let pettyCashNonLemburTotal = 0
    let pettyCashNonLemburCount = 0
    let monthlyTotal = 0
    let monthlyCount = 0

    allTransactions.forEach(t => {
      const amt = Number(t.amount || 0)
      if (t.isLembur || t.category === 'lembur') {
        lemburTotal += amt
        lemburCount += 1
      } else if (t.source === 'petty_cash') {
        pettyCashNonLemburTotal += amt
        pettyCashNonLemburCount += 1
      } else {
        monthlyTotal += amt
        monthlyCount += 1
      }
    })

    const totalOpex = lemburTotal + pettyCashNonLemburTotal + monthlyTotal

    return {
      lemburTotal,
      lemburCount,
      pettyCashNonLemburTotal,
      pettyCashNonLemburCount,
      monthlyTotal,
      monthlyCount,
      totalOpex,
      count: allTransactions.length
    }
  }, [allTransactions])

  // Transaksi Terfilter untuk Tabel
  const displayedTransactions = useMemo(() => {
    return allTransactions
      .filter(tx => {
        if (!matchesCategory(tx.category, selectedCategory)) return false
        if (sourceFilter !== 'all' && tx.source !== sourceFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const desc = (tx.description || '').toLowerCase()
          const out = (tx.outlet_name || '').toLowerCase()
          const rcp = (tx.recipient_name || '').toLowerCase()
          const cat = (labelOf(tx.category) || '').toLowerCase()
          if (!desc.includes(q) && !out.includes(q) && !rcp.includes(q) && !cat.includes(q)) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => {
        let valA = a[sortField]
        let valB = b[sortField]

        if (sortField === 'amount') {
          return sortDirection === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA)
        }
        if (sortField === 'category') {
          valA = labelOf(valA as string)
          valB = labelOf(valB as string)
        }
        valA = String(valA || '').toLowerCase()
        valB = String(valB || '').toLowerCase()

        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      })
  }, [allTransactions, selectedCategory, sourceFilter, searchQuery, sortField, sortDirection])

  const displayedTotalOpex = useMemo(() => {
    return displayedTransactions.reduce((acc, it) => acc + Number(it.amount || 0), 0)
  }, [displayedTransactions])

  // Opsi Target Outlet (Tanpa Kantor Pusat)
  const selectOptions: TargetOption[] = useMemo(() => {
    if (isAreaManager) {
      const opts: TargetOption[] = [
        { value: 'ALL_OUTLETS', label: 'Semua Cabang Binaan' }
      ]
      outlets.forEach(o => {
        opts.push({ value: o.id, label: o.name })
      })
      return opts
    }

    // RM / Owner / Admin
    const opts: TargetOption[] = [
      { value: 'ALL_OUTLETS', label: 'Semua Cabang Toko' },
      { value: 'INTERNAL_OUTLETS', label: 'Outlet Internal' },
      { value: 'MITRA_OUTLETS', label: 'Outlet Mitra' },
    ]
    outlets.forEach(o => {
      opts.push({ value: o.id, label: o.name })
    })
    return opts
  }, [isAreaManager, outlets])

  const currentTargetLabel = useMemo(() => {
    const found = selectOptions.find(o => o.value === target)
    return found ? found.label : 'Semua Cabang'
  }, [selectOptions, target])

  // Export to Excel handler using ExcelJS
  const handleExportExcel = async () => {
    if (displayedTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor pada filter ini.')
      return
    }

    try {
      const ExcelJS = (await import('exceljs')).default
      const fileSaverModule = await import('file-saver')
      const saveAs = fileSaverModule.default || fileSaverModule.saveAs || (fileSaverModule as any)

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Laporan OPEX')

      worksheet.mergeCells('A1:I1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = 'Laporan Beban Operasional Cabang - SukaShawarma (Manager)'
      titleCell.font = { size: 14, bold: true }

      worksheet.getCell('A3').value = `Periode: ${startDate} s/d ${endDate} | Cabang: ${currentTargetLabel}${selectedCategory !== 'all' ? ` | Kategori: ${labelOf(selectedCategory)}` : ''}`
      worksheet.getCell('A3').font = { bold: true }

      const headers = ['No', 'Tanggal', 'Unit / Cabang', 'Sumber Biaya', 'Nama Pemohon', 'Kategori', 'Keterangan', 'Bukti Nota', 'Nominal Pengeluaran (Rp)']
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
          r.source === 'petty_cash' ? 'Kasir POS' : 'Buku Kas Bulanan',
          r.recipient_name || '-',
          labelOf(r.category),
          r.description || '-',
          r.receipt_url ? 'Ada Struk' : '-',
          r.amount
        ]
        row.getCell(9).numFmt = '"Rp" #,##0'
        curIdx++
      })

      const totalRow = worksheet.getRow(curIdx)
      totalRow.values = ['TOTAL', '', '', '', '', '', '', '', displayedTotalOpex]
      totalRow.font = { bold: true }
      totalRow.getCell(9).numFmt = '"Rp" #,##0'

      worksheet.columns.forEach(col => { col.width = 16 })
      worksheet.getColumn(7).width = 30
      worksheet.getColumn(6).width = 24

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Laporan_OPEX_Manager_${startDate}_${endDate}.xlsx`)
      toast.success(`Berhasil mengunduh ${displayedTransactions.length} baris transaksi ke Excel!`)
    } catch (e: any) {
      toast.error('Gagal mengekspor file: ' + e.message)
    }
  }

  // Export to CSV handler (Safe replace)
  const handleExportCSV = () => {
    if (displayedTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor pada filter ini.')
      return
    }

    try {
      const headers = ['No', 'Tanggal', 'Unit/Cabang', 'Sumber Biaya', 'Nama Pemohon', 'Kategori', 'Keterangan', 'Bukti Nota', 'Nominal (Rp)']
      const rows = displayedTransactions.map((r, idx) => [
        idx + 1,
        `"${r.date}"`,
        `"${(r.outlet_name || '').replace(/"/g, '""')}"`,
        `"${r.source === 'petty_cash' ? 'Kasir POS' : 'Buku Kas Bulanan'}"`,
        `"${(r.recipient_name || '').replace(/"/g, '""')}"`,
        `"${(labelOf(r.category) || '').replace(/"/g, '""')}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        `"${r.receipt_url ? 'Ada Struk' : '-'}"`,
        r.amount
      ])

      const summaryRow = ['TOTAL', '', '', '', '', '', '', '', displayedTotalOpex]

      const csvContent = '\uFEFF' + [
        headers.join(','),
        ...rows.map(e => e.join(',')),
        summaryRow.join(',')
      ].join('\r\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `Laporan_OPEX_Manager_${startDate}_${endDate}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Berhasil mengunduh ${displayedTransactions.length} baris ke CSV!`)
    } catch (e: any) {
      toast.error('Gagal mengekspor file CSV: ' + e.message)
    }
  }

  // Export to PDF handler
  const handleExportPDF = async () => {
    if (displayedTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor ke PDF pada filter ini.')
      return
    }

    try {
      toast.info('Menyiapkan dokumen PDF OPEX...')
      const categorySuffix = selectedCategory !== 'all' ? ` - Kategori: ${labelOf(selectedCategory)}` : ''

      await generateOpexReportPDF({
        startDate,
        endDate,
        targetLabel: `${currentTargetLabel}${categorySuffix}`,
        items: displayedTransactions.map(t => ({
          date: t.date,
          outlet_name: t.outlet_name,
          recipient_name: t.recipient_name || '-',
          division: '-',
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
  const applyPreset = (preset: PresetType) => {
    setActivePreset(preset)
    const today = new Date()

    if (preset === 'today') {
      const t = getToday(today)
      setStartDate(t)
      setEndDate(t)
    } else if (preset === 'yesterday') {
      const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      const yStr = formatLocalDate(y)
      setStartDate(yStr)
      setEndDate(yStr)
    } else if (preset === 'last_7_days') {
      const past7 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
      setStartDate(formatLocalDate(past7))
      setEndDate(getToday(today))
    } else if (preset === 'this_month') {
      setStartDate(getFirstOfMonth(today))
      setEndDate(getToday(today))
    } else if (preset === 'last_month') {
      const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
      const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth()
      const padM = String(prevMonth).padStart(2, '0')
      const lastMonthStart = `${prevYear}-${padM}-01`
      const lastDay = new Date(prevYear, prevMonth, 0).getDate()
      const lastMonthEnd = `${prevYear}-${padM}-${String(lastDay).padStart(2, '0')}`
      setStartDate(lastMonthStart)
      setEndDate(lastMonthEnd)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Kas (OPEX)"
        description="Pencatatan dan rincian beban operasional cabang (Lembur, Kas Kecil POS, dan Beban Bulanan Outlet)."
        icon={Wallet}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 border-rose-500 text-rose-600 hover:bg-rose-50 bg-white cursor-pointer shadow-2xs text-xs px-3 py-2 h-9 rounded-xl font-bold"
            title="Download Laporan Resmi OPEX ke format PDF"
          >
            <FileText size={15} />
            <span>Export PDF</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 border-emerald-500 text-emerald-600 hover:bg-emerald-50 bg-white cursor-pointer text-xs px-3 py-2 h-9 rounded-xl font-bold"
          >
            <Download size={15} />
            <span>Export Excel</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50 bg-white cursor-pointer text-xs px-3 py-2 h-9 rounded-xl font-bold"
          >
            <FileText size={15} />
            <span>Export CSV</span>
          </Button>
        </div>
      </PageHeader>

      {/* STATUS SINKRONISASI REALTIME & REFRESH BUTTON */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border border-suka-gray-200 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-suka-ink/70">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-700">Realtime Sync Aktif</span>
          {lastUpdated && (
            <span className="text-suka-ink/50 text-[11px] hidden sm:inline">
              · Terakhir diperbarui {formatLastUpdated(lastUpdated)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={expensesLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-suka-brown hover:text-suka-ink bg-white hover:bg-suka-gray-50 border border-suka-gray-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Muat ulang data pengeluaran dari database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-suka-orange ${expensesLoading || isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Memuat Ulang...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS: TARGET & TANGGAL */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Target Outlet Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Store size={14} className="text-suka-orange" />
              Cakupan Cabang:
            </span>
            <div className="w-full sm:w-72">
              <TargetCombobox
                value={target}
                options={selectOptions}
                onChange={handleTargetChange}
                placeholder="Pilih cabang..."
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1 bg-suka-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => applyPreset('yesterday')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'yesterday'
                  ? 'bg-white text-suka-orange shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'today'
                  ? 'bg-white text-suka-orange shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_7_days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'last_7_days'
                  ? 'bg-white text-suka-orange shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => applyPreset('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'this_month'
                  ? 'bg-white text-suka-orange shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'last_month'
                  ? 'bg-white text-suka-orange shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bulan Lalu
            </button>
          </div>
        </div>

        {/* Custom Date Pickers */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
              <Calendar size={13} className="text-suka-orange" /> Dari:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setActivePreset('custom')
              }}
              className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-suka-orange/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
              <Calendar size={13} className="text-suka-orange" /> Sampai:
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setActivePreset('custom')
              }}
              className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-suka-orange/20"
            />
          </div>
        </div>
      </div>

      {/* 4 KARTU RINGKASAN OPEX OPERASIONAL (100% BALANCE & INTERAKTIF) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KARTU 1: LEMBUR */}
        <div
          onClick={() => setActiveDetailModal('lembur')}
          className="bg-white p-5 rounded-2xl border border-orange-100 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-orange-900 uppercase tracking-wider">Biaya Lembur</span>
            <Clock size={18} className="text-orange-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-orange-700 mt-2 truncate" title={rupiah(summary.lemburTotal)}>
            {rupiah(summary.lemburTotal)}
          </div>
          <p className="text-[11px] text-orange-600/80 font-medium mt-1">
            {summary.lemburCount} pengajuan · Klik rincian
          </p>
        </div>

        {/* KARTU 2: KAS KECIL POS (NON-LEMBUR) */}
        <div
          onClick={() => setActiveDetailModal('petty_cash')}
          className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Kas Kecil POS</span>
            <Receipt size={18} className="text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 truncate" title={rupiah(summary.pettyCashNonLemburTotal)}>
            {rupiah(summary.pettyCashNonLemburTotal)}
          </div>
          <p className="text-[11px] text-emerald-600/80 font-medium mt-1">
            {summary.pettyCashNonLemburCount} pengeluaran harian kasir · Klik rincian
          </p>
        </div>

        {/* KARTU 3: BIAYA BULANAN OUTLET */}
        <div
          onClick={() => setActiveDetailModal('monthly')}
          className="bg-white p-5 rounded-2xl border border-amber-100 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Bulanan Cabang</span>
            <Building2 size={18} className="text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 truncate" title={rupiah(summary.monthlyTotal)}>
            {rupiah(summary.monthlyTotal)}
          </div>
          <p className="text-[11px] text-amber-600/80 font-medium mt-1">
            {summary.monthlyCount} sewa, PLN, PDAM, wifi · Klik rincian
          </p>
        </div>

        {/* KARTU 4: TOTAL OPEX */}
        <div
          onClick={() => setActiveDetailModal('total')}
          className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-2xs hover:shadow-md hover:border-rose-400 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">Total OPEX Cabang</span>
            <Wallet size={18} className="text-rose-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2 truncate" title={rupiah(summary.totalOpex)}>
            {rupiah(summary.totalOpex)}
          </div>
          <p className="text-[11px] text-rose-600/80 font-medium mt-1">
            {summary.count} total transaksi operasional · Klik rincian
          </p>
        </div>
      </div>

      {/* FILTER & PENCARIAN TRANSAKSI */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari keterangan, cabang, atau pemohon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-suka-orange/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Kategori */}
          <div className="w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-suka-orange/20 cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {PENGELUARAN_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {labelOf(cat)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Sumber Biaya */}
          <div className="w-44">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-suka-orange/20 cursor-pointer"
            >
              <option value="all">Semua Sumber Biaya</option>
              <option value="monthly">Buku Kas Bulanan</option>
              <option value="petty_cash">Kas Kecil POS</option>
            </select>
          </div>
        </div>

        {/* Reset Filter Button */}
        {(selectedCategory !== 'all' || sourceFilter !== 'all' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all')
              setSourceFilter('all')
              setSearchQuery('')
            }}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-2 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
          >
            <X size={14} />
            <span>Reset Filter</span>
          </button>
        )}
      </div>

      {/* TABEL DATA TRANSAKSI OPEX (READ-ONLY) */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-suka-brown">Rincian Transaksi Pengeluaran</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-suka-orange/10 text-suka-orange">
              {displayedTransactions.length} Baris
            </span>
          </div>
          <div className="text-xs font-black text-suka-brown">
            Subtotal: <span className="text-suka-orange font-mono">{rupiah(displayedTotalOpex)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-suka-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-3 cursor-pointer hover:text-suka-orange transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Tanggal</span>
                    {sortField === 'date' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('outlet_name')}
                  className="px-4 py-3 cursor-pointer hover:text-suka-orange transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Cabang</span>
                    {sortField === 'outlet_name' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3">Sumber</th>
                <th
                  onClick={() => handleSort('category')}
                  className="px-4 py-3 cursor-pointer hover:text-suka-orange transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Kategori</span>
                    {sortField === 'category' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3">Keterangan & Pemohon</th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-4 py-3 text-right cursor-pointer hover:text-suka-orange transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Nominal</span>
                    {sortField === 'amount' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Bukti Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expensesLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-suka-orange mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Memuat data transaksi pengeluaran...</p>
                  </td>
                </tr>
              ) : displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-semibold text-gray-600">Tidak ada transaksi ditemukan</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Coba ubah rentang tanggal atau reset filter pencarian di atas.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-suka-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                      {tx.date}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-bold text-gray-900">
                      {tx.outlet_name}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {tx.source === 'petty_cash' ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                          Kasir POS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                          Bulanan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(tx.category)}
                        title={`Filter hanya ${labelOf(tx.category)}`}
                        className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[10px] border border-amber-100 transition-colors cursor-pointer text-left"
                      >
                        {labelOf(tx.category)}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 max-w-sm">
                      <div className="font-medium text-gray-800 break-words line-clamp-2" title={tx.description || ''}>
                        {tx.description || '-'}
                      </div>
                      {tx.recipient_name && tx.recipient_name !== '-' && (
                        <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                          Oleh: {tx.recipient_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap font-black font-mono text-gray-900">
                      {rupiah(tx.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {tx.receipt_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            setImgLoadError(false)
                            setPreviewReceiptUrl(tx.receipt_url || null)
                          }}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PREVIEW FOTO STRUK / BUKTI NOTA */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-suka-orange" />
                <h3 className="font-bold text-sm text-gray-800">Bukti Nota / Struk Pengeluaran</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 rounded-xl p-3 my-4 min-h-[200px]">
              {imgLoadError ? (
                <div className="text-center p-6 text-gray-400">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700 text-xs">Gagal memuat gambar struk</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    URL foto struk mungkin telah kedaluwarsa atau berkas telah dipindahkan.
                  </p>
                  <a
                    href={previewReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-[11px] font-bold text-suka-orange hover:bg-gray-50"
                  >
                    Coba Buka di Tab Baru
                  </a>
                </div>
              ) : (
                <img
                  src={previewReceiptUrl}
                  alt="Bukti Nota"
                  onError={() => setImgLoadError(true)}
                  className="max-h-[60vh] object-contain rounded-lg shadow-xs"
                />
              )}
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

      {/* MODAL DETAIL BREAKDOWN OPEX OPERASIONAL */}
      <ManagerOpexDetailModal
        type={activeDetailModal}
        onClose={() => setActiveDetailModal(null)}
        transactions={allTransactions}
        outletLabel={currentTargetLabel}
        dateRangeLabel={`${startDate} s/d ${endDate}`}
      />
    </div>
  )
}

export default function BukuKasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2 text-suka-brown">
            <Loader2 className="w-8 h-8 animate-spin text-suka-orange" />
            <p className="text-xs font-bold">Memuat Buku Kas (OPEX)...</p>
          </div>
        </div>
      }
    >
      <BukuKasContent />
    </Suspense>
  )
}
