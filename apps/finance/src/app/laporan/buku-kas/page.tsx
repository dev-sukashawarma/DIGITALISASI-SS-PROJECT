// @ts-nocheck
'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
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
  Sparkles,
  Award,
  Briefcase,
  Clock,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { Button } from '@suka/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { clearPeriodCache } from '@/lib/periodCache'
import { createThrottledRefresher } from '@/lib/realtimeThrottle'
import { PageHeader } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import { useExpenses } from '@/hooks/useExpenses'
import { useHRPayroll } from '@/hooks/useHRPayroll'
import { useProratedOpex } from '@/hooks/useProratedOpex'
import { useOutlets } from '@/hooks/useOutlets'
import { useMitraInvestments } from '@/hooks/useMitraInvestments'
import { mitraOutletIds } from '@/lib/outletOwnership'
import { barisPayrollDariHr, gantiPayrollDenganHr, gajiRutinBulananKartu, adaDataHr, ringkasanHrKelompok } from '@/lib/opexDariHr'
import { kartuClosingUntuk } from '@/lib/closing/targetKartuClosing'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { ExpenseFormModal } from '@/components/ExpenseFormModal'
import { BulkImportModal } from '@/components/BulkImportModal'
import { OpexCardDetailModals, type OpexModalType } from '@/components/OpexCardDetailModals'
import { deleteTransactionAction } from '@/app/actions/expenses'
import { CATEGORY_META, isSalaryCategory, isLemburExpense, PENGELUARAN_CATEGORIES } from '@/lib/expenseCategories'
import { rupiah } from '@/lib/format'
import { isExcludedOutlet } from '@/lib/outletFilters'
import { generateOpexReportPDF } from '@/utils/opexPdfGenerator'
import { BUKU_KAS_PARAMS } from '@/lib/bukuKasLink'
import { calculateDateRangeProrata } from '@/lib/opexDateRangeProrata'

function formatLastUpdated(dateIso?: string) {
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

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c

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

export default function BukuKasPage() {
  const { role, isChecker } = useFinanceRole()
  const isAdmin = isChecker
  const { data: outlets = [] } = useOutlets()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toISOString())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const searchParams = useSearchParams()
  const paramFrom = searchParams.get(BUKU_KAS_PARAMS.from)
  const paramTo = searchParams.get(BUKU_KAS_PARAMS.to)
  const paramOutlet = searchParams.get(BUKU_KAS_PARAMS.outlet)
  // Dari tautan "Lihat detail" kartu rincian OPEX Laba Rugi.
  const paramSource = searchParams.get(BUKU_KAS_PARAMS.source)
  const paramCategory = searchParams.get(BUKU_KAS_PARAMS.category)

  type PresetType = 'yesterday' | 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'custom'
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
  const [startDate, setStartDate] = useState(() => paramFrom || getToday())
  const [endDate, setEndDate] = useState(() => paramTo || getToday())

  const todayJakarta = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()), [])
  const isPast = endDate < todayJakarta

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
      setSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc')
    }
  }

  const isPusat = target === 'PUSAT'
  // Kelompok outlet: Internal + Mitra = "Semua Outlet (Khusus Cabang)".
  // Aturan mitra sama dengan Laba Rugi (lib/outletOwnership.ts).
  // 'INTERNAL_PUSAT' = outlet internal + kantor pusat, cakupan yang sama dengan
  // tab Laba Rugi Internal.
  const sertakanPusat = target === 'INTERNAL_PUSAT'
  const isGroupTarget = target === 'INTERNAL_OUTLETS' || target === 'MITRA_OUTLETS' || sertakanPusat
  const isAllOutlets = target === 'ALL_OUTLETS' || isGroupTarget
  const { investments: mitraInvestments } = useMitraInvestments()
  const mitraIds = useMemo(() => mitraOutletIds(outlets as any, mitraInvestments), [outlets, mitraInvestments])
  const inTargetGroup = useCallback((outletId: string | null | undefined) => {
    if (!isGroupTarget) return true
    const isMitra = !!outletId && mitraIds.has(outletId)
    return target === 'MITRA_OUTLETS' ? isMitra : !isMitra
  }, [isGroupTarget, target, mitraIds])

  const [sourceFilter, setSourceFilter] = useState<'all' | 'monthly' | 'petty_cash'>(
    () => (paramSource === 'monthly' || paramSource === 'petty_cash' ? paramSource : 'all'),
  )

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
    outletId: isGroupTarget ? 'ALL_OUTLETS' : target
  }), [startDate, endDate, target, isGroupTarget])
  const { data: hrPayrollData } = useHRPayroll(hrPayrollFilter)
  // Ringkasan HR belum bisa dipecah Internal/Mitra; untuk dua pilihan itu kartu
  // gaji & bonus memakai baris mesin Laba Rugi per outlet (lihat prorataBreakdown).
  const hrPayroll = isGroupTarget ? undefined : hrPayrollData
  // Gaji staf kantor pusat, hanya diambil untuk pilihan Internal + Kantor Pusat.
  const hrPusatFilter = useMemo(() => ({ from: startDate, to: endDate, outletId: 'PUSAT' }), [startDate, endDate])
  const { data: hrPusatData } = useHRPayroll(hrPusatFilter, sertakanPusat)
  // Rincian gaji & bonus untuk modal pada pilihan kelompok (Internal / Mitra / Internal + Pusat):
  // ringkasan HR 'Semua Outlet' dipotong per outlet kelompok, memakai pembagian yang sama dengan kartu.
  const hrPayrollModal = useMemo(() => {
    if (!isGroupTarget) return hrPayroll
    return ringkasanHrKelompok(hrPayrollData, id => inTargetGroup(id), sertakanPusat ? hrPusatData : null) ?? undefined
  }, [isGroupTarget, hrPayroll, hrPayrollData, hrPusatData, sertakanPusat, inTargetGroup])
  const hasHrPayrollModal = Boolean(hrPayrollModal && hrPayrollModal.totalStaff > 0 && hrPayrollModal.totalSalary > 0)

  // Prorata & Realtime OPEX Engine (Single Source of Truth selevel Tab Laba Rugi)
  const prorataFilter = useMemo(() => ({
    from: startDate,
    to: endDate,
    outletId: isPusat ? 'ffffffff-ffff-ffff-ffff-ffffffffffff' : (isAllOutlets ? 'all' : target),
  }), [startDate, endDate, target, isPusat, isAllOutlets])

  const {
    rows: prorataExpenseRows,
    isProrated: isProratedOpex,
    monthInfo: prorataMonthInfo,
    categoryBreakdown: prorataBreakdownSemua,
    loading: prorataLoading,
  } = useProratedOpex({
    filter: prorataFilter,
    rawExpenses: expenseRows,
    outlets,
    enabled: true,
  })

  const prorataBreakdown = useMemo(() => {
    if (!isGroupTarget) return prorataBreakdownSemua
    const info = calculateDateRangeProrata(startDate, endDate)
    // Sumber yang sama dengan Laba Rugi: baris HR per outlet (jumlahnya = kartu
    // "Semua Outlet"), dengan angka mesin prorata sebagai cadangan bila HR kosong.
    const barisGrup = gantiPayrollDenganHr(prorataExpenseRows, barisPayrollDariHr({ hr: hrPayrollData, from: startDate, to: endDate }))
    const jumlah = (...kategori: string[]) => barisGrup
      .filter(r => r.scope === 'outlet' && kategori.includes(r.category) && inTargetGroup(r.outlet_id))
      .reduce((s, r) => s + r.amount, 0)
    const pos = (nominalProrata: number) => ({
      nominalProrata,
      nominalBulanan: info.isProrated && info.ratio > 0 ? Math.round(nominalProrata / info.ratio) : nominalProrata,
      source: 'laba_rugi',
    })
    // Internal + Kantor Pusat: gaji rutin staf kantor ikut, dengan rumus kartu
    // "Kantor Pusat (OPEX Pusat)" yang sama.
    let gajiPusat = 0
    if (sertakanPusat && adaDataHr(hrPusatData)) {
      const bulanan = gajiRutinBulananKartu(hrPusatData, true)
      gajiPusat = info.isProrated ? Math.round(bulanan * info.ratio) : bulanan
    }
    return {
      ...prorataBreakdownSemua,
      gaji_crew_outlet: pos(jumlah('gaji_crew_outlet') + gajiPusat),
      bonus_crew: pos(jumlah('bonus_crew')),
      bonus_area_manager: pos(jumlah('bonus_area_manager')),
      bonus_regional_manager: pos(jumlah('bonus_regional_manager')),
    }
  }, [isGroupTarget, prorataBreakdownSemua, prorataExpenseRows, hrPayrollData, hrPusatData, sertakanPusat, inTargetGroup, startDate, endDate])

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      clearPeriodCache()
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['expenses'] }),
        queryClient.refetchQueries({ queryKey: ['hr_payroll_summary'] }),
        queryClient.refetchQueries({ queryKey: ['prorata-auxiliary-data'] }),
        queryClient.refetchQueries({ queryKey: ['outlets'] }),
      ])
      setLastUpdated(new Date().toISOString())
      toast.success('Memperbarui data OPEX & Pengeluaran dari database...')
    } catch (err) {
      console.error('Failed to refresh data:', err)
      toast.error('Gagal memperbarui data pengeluaran')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Supabase Realtime Listener (Throttled 20s - POS Kasir Burst Safe)
  useEffect(() => {
    const refresher = createThrottledRefresher(() => {
      clearPeriodCache()
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['hr_payroll_summary'] })
      queryClient.invalidateQueries({ queryKey: ['prorata-auxiliary-data'] })
      queryClient.invalidateQueries({ queryKey: ['outlets'] })
      setLastUpdated(new Date().toISOString())
    }, 20_000)
    const invalidate = () => refresher.trigger()

    const channel = supabase
      .channel('buku-kas-opex-realtime-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_expenses' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_records' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_financials' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_outlets' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlets' }, invalidate)
      .subscribe()

    return () => {
      refresher.dispose()
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  // Sewa outlet = biaya TETAP (validasi Finance 14 Okt 2026): pada bulan berjalan
  // dibebankan per hari, sama dengan Laba Rugi. Angka per outlet diambil dari
  // mesin prorata yang sama (baris `prorata-sewa-<outlet>`), supaya kedua halaman
  // tidak bisa berbeda. Bulan yang sudah lewat tidak tersentuh (map kosong).
  const sewaProrata = useMemo(() => {
    const m = new Map<string, number>()
    if (!isProratedOpex) return m
    prorataExpenseRows.forEach(r => {
      if (String(r.id).startsWith('prorata-sewa-') && r.outlet_id) m.set(r.outlet_id, r.amount)
    })
    return m
  }, [isProratedOpex, prorataExpenseRows])

  // Pure OPEX Expense Rows
  const allTransactions = useMemo(() => {
    let list: any[] = []

    const adalahSewa = (c?: string | null) => { const k = (c || '').toLowerCase(); return k === 'sewa' || k === 'sewa_outlet' }
    // Total sewa riil per outlet, untuk membagi angka prorata bila barisnya lebih dari satu.
    const sewaRiil = new Map<string, number>()
    expenseRows.forEach(r => {
      if (r.outlet_id && adalahSewa(r.category) && sewaProrata.has(r.outlet_id)) {
        sewaRiil.set(r.outlet_id, (sewaRiil.get(r.outlet_id) ?? 0) + r.amount)
      }
    })
    const lolosTarget = (r: { scope?: string; outlet_id?: string | null }) => {
      if (target === 'PUSAT' && r.scope === 'outlet') return false
      if (isAllOutlets && r.scope === 'pusat' && !sertakanPusat) return false
      if (isGroupTarget && r.scope !== 'pusat' && !inTargetGroup(r.outlet_id)) return false
      if (target !== 'all' && target !== 'PUSAT' && !isAllOutlets && (r.scope === 'pusat' || r.outlet_id !== target)) return false
      return true
    }
    // Outlet tanpa input sewa bulan ini: mesin memakai nominal bulan lalu. Baris
    // estimasinya ditampilkan juga di sini (tanpa tombol edit/hapus).
    prorataExpenseRows.forEach(r => {
      if (!String(r.id).startsWith('prorata-sewa-') || !r.outlet_id || !isProratedOpex) return
      if ((sewaRiil.get(r.outlet_id) ?? 0) > 0 || !lolosTarget(r)) return
      list.push({
        id: r.id, date: r.expense_date, category: 'sewa_outlet', outlet_name: r.outlet_name ?? '-', outlet_id: r.outlet_id,
        recipient_name: '-', division: '-', description: `${r.description} · estimasi dari nominal bulan lalu`,
        amount: r.amount, type: 'expense', receipt_url: null, isTopup: false,
        raw_description: r.description, raw_category: 'sewa_outlet', scope: r.scope, source: 'monthly', isLembur: false,
        sintetis: true,
      })
    })

    expenseRows.forEach(r => {
      if (!lolosTarget(r)) return

      const isLembur = isLemburExpense(r.category, r.description)
      const effectiveCategory = isLembur ? 'lembur' : r.category

      // Sewa bulan berjalan: tampilkan porsi yang sudah berjalan, simpan nominal aslinya.
      const totalSewa = r.outlet_id && adalahSewa(r.category) ? (sewaRiil.get(r.outlet_id) ?? 0) : 0
      const sewaBerjalan = totalSewa > 0
        ? Math.round((sewaProrata.get(r.outlet_id as string) ?? 0) * (r.amount / totalSewa))
        : null

      list.push({
        ...(sewaBerjalan !== null ? { amount_asli: r.amount, description_asli: r.description } : {}),
        id: r.id,
        date: r.expense_date,
        category: effectiveCategory,
        outlet_name: r.outlet_name ?? (r.scope === 'pusat' ? 'Kantor Pusat' : '-'),
        outlet_id: r.outlet_id,
        recipient_name: r.recipient_name ?? '-',
        division: r.division ?? (r.scope === 'pusat' ? 'General' : '-'),
        description: sewaBerjalan !== null
          ? `${r.description || 'Sewa outlet'} · dibebankan per hari (sebulan ${rupiah(r.amount)})`
          : r.description,
        amount: sewaBerjalan !== null ? sewaBerjalan : r.amount,
        type: 'expense',
        receipt_url: r.receipt_url || null,
        isTopup: false,
        raw_description: r.raw_description || r.description,
        raw_category: r.raw_category || r.category,
        scope: r.scope,
        source: r.source || 'monthly',
        isLembur
      })
    })

    // Sort descending by date
    list.sort((a, b) => b.date.localeCompare(a.date))
    return list
  }, [expenseRows, prorataExpenseRows, isProratedOpex, sewaProrata, target, isAllOutlets, isGroupTarget, sertakanPusat, inTargetGroup])

  // Summary OPEX calculation
  const summary = useMemo(() => {
    let totalOpex = 0
    let salary = 0
    let lembur = 0
    let nonSalary = 0
    let pusat = 0
    let outlet = 0

    allTransactions.forEach(t => {
      const amt = Number(t.amount || 0)
      totalOpex += amt
      if (t.category === 'lembur' || t.isLembur) {
        lembur += amt
      } else if (isSalaryCategory(t.category)) {
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
      lembur,
      nonSalary,
      pusat,
      outlet,
      count: allTransactions.length
    }
  }, [allTransactions])

  // Closing OPEX September 2026: untuk rentang tepat 1–30 Sep dan cakupan internal/pusat,
  // angka kartu = target sheet FIXED (lib/closing). Daftar transaksi tetap data asli.
  const closingKartu = useMemo(() => kartuClosingUntuk(target, startDate, endDate), [target, startDate, endDate])
  const kartuClosing = closingKartu.kartu
  const nonSalaryTampil = kartuClosing ? kartuClosing.nonGaji : summary.nonSalary

  // Prorata calculation based on current date filter (starts / ends)
  const prorataInfo = useMemo(() => calculateDateRangeProrata(startDate, endDate), [startDate, endDate])

  const hasHrPayroll = Boolean(hrPayroll && hrPayroll.totalStaff > 0 && hrPayroll.totalSalary > 0)

  // Smart Prorata untuk outlet yang buka atau tutup di pertengahan bulan
  const effectiveProrataInfo = useMemo(() => {
    if (hasHrPayroll && hrPayroll?.outletOperationalInfo?.isPartial) {
      const op = hrPayroll.outletOperationalInfo
      const opStart = op.firstDate || `${startDate.slice(0, 7)}-01`
      const opEnd = op.lastDate || endDate
      const overlapStart = startDate > opStart ? startDate : opStart
      const overlapEnd = endDate < opEnd ? endDate : opEnd

      if (overlapStart > overlapEnd) {
        return {
          ...prorataInfo,
          isProrated: true,
          ratio: 0,
          overlapDays: 0,
          totalDays: op.operationalCalendarDays || 1,
          label: 'Belum Beroperasi (0 Hari)'
        }
      }
      const overlapDays = Math.max(0, Math.round((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      const totalOpDays = op.operationalCalendarDays || 1
      const ratio = Math.min(1, Math.max(0, overlapDays / totalOpDays))
      const isProrated = ratio < 1 || prorataInfo.isProrated
      return {
        ...prorataInfo,
        isProrated,
        ratio,
        overlapDays,
        totalDays: totalOpDays,
        label: `Prorata ${overlapDays} Hari (${overlapDays}/${totalOpDays} Hari Ops)`
      }
    }
    return prorataInfo
  }, [hasHrPayroll, hrPayroll, startDate, endDate, prorataInfo])

  // Realtime & Exact Crew Bonus from HR Payroll (get_daily_outlet_bonus_detail) / Prorata fallback
  const displayCrewBonus = useMemo(() => {
    if (kartuClosing) return kartuClosing.bonusKru
    if (isPusat) return 0
    if (hasHrPayroll && hrPayroll?.crewBonus !== undefined) {
      return hrPayroll.crewBonus
    }
    if (prorataBreakdown?.bonus_crew?.nominalProrata > 0) {
      return prorataBreakdown.bonus_crew.nominalProrata
    }
    return 0
  }, [kartuClosing, isPusat, hasHrPayroll, hrPayroll, prorataBreakdown])

  // Realtime & Exact Manager Bonus from HR Payroll / Prorata fallback
  const displayManagerBonus = useMemo(() => {
    if (kartuClosing) return kartuClosing.bonusManajer
    if (isPusat) return 0
    if (hasHrPayroll && hrPayroll?.managerBonusAllocation !== undefined) {
      return hrPayroll.managerBonusAllocation
    }
    const mgrProrata = (prorataBreakdown?.bonus_area_manager?.nominalProrata || 0) + (prorataBreakdown?.bonus_regional_manager?.nominalProrata || 0)
    if (mgrProrata > 0) {
      return mgrProrata
    }
    return 0
  }, [kartuClosing, isPusat, hasHrPayroll, hrPayroll, prorataBreakdown])

  // Total Bonus (Kru + Pengawas)
  const displayBonus = useMemo(() => {
    if (isPusat) return displayCrewBonus
    return displayCrewBonus + displayManagerBonus
  }, [isPusat, displayCrewBonus, displayManagerBonus])

  // Realtime & Prorata Routine Salary (Gaji Pokok + Tunjangan Aktif + Alokasi Rutin Manajer)
  const displayRoutineSalary = useMemo(() => {
    if (kartuClosing) return kartuClosing.gajiRutin
    if (hasHrPayroll && hrPayroll) {
      const staffGapok = Math.round(isPusat ? hrPayroll.basicSalary : (hrPayroll.crewBasicSalary ?? hrPayroll.basicSalary))
      const staffTunj = Math.round(isPusat ? hrPayroll.allowances : (hrPayroll.crewAllowances ?? hrPayroll.allowances))
      const staffPot = Math.round(isPusat ? hrPayroll.deductions : (hrPayroll.crewDeductions ?? hrPayroll.deductions))
      const staffRoutine = Math.max(0, staffGapok + staffTunj - staffPot)
      const mgrAlloc = isPusat ? 0 : Math.round(hrPayroll.managerAllocation || 0)
      const monthlyRoutine = staffRoutine + mgrAlloc

      if (hrPayroll.outletOperationalInfo?.isPartial) {
        return effectiveProrataInfo.isProrated
          ? Math.round(monthlyRoutine * effectiveProrataInfo.ratio)
          : monthlyRoutine
      }

      return prorataInfo.isProrated ? Math.round(monthlyRoutine * prorataInfo.ratio) : monthlyRoutine
    }
    if (isPusat) return summary.salary
    if (prorataBreakdown?.gaji_crew_outlet?.nominalProrata > 0) {
      return prorataBreakdown.gaji_crew_outlet.nominalProrata
    }
    return summary.salary
  }, [kartuClosing, isPusat, prorataBreakdown, hasHrPayroll, hrPayroll, prorataInfo, effectiveProrataInfo, summary.salary])

  // Total Beban Gaji (Rutin + Bonus)
  const displaySalary = useMemo(() => {
    return displayRoutineSalary + displayBonus
  }, [displayRoutineSalary, displayBonus])

  const displayBasicSalary = useMemo(() => {
    if (!hasHrPayroll || !hrPayroll?.basicSalary) return 0
    if (!prorataInfo.isProrated) return hrPayroll.basicSalary
    return Math.round(hrPayroll.basicSalary * prorataInfo.ratio)
  }, [hasHrPayroll, hrPayroll, prorataInfo])

  // Baselines sebulan penuh (1 bln) untuk pembanding kartu dan modal rincian
  const baselineRoutineSalary = useMemo(() => {
    if (hasHrPayroll && hrPayroll) {
      const staffGapok = Math.round(isPusat ? hrPayroll.basicSalary : (hrPayroll.crewBasicSalary ?? hrPayroll.basicSalary))
      const staffTunj = Math.round(isPusat ? hrPayroll.allowances : (hrPayroll.crewAllowances ?? hrPayroll.allowances))
      const staffPot = Math.round(isPusat ? hrPayroll.deductions : (hrPayroll.crewDeductions ?? hrPayroll.deductions))
      const staffRoutine = Math.max(0, staffGapok + staffTunj - staffPot)
      const mgrAlloc = isPusat ? 0 : Math.round(hrPayroll.managerAllocation || 0)
      return Math.max(0, staffRoutine + mgrAlloc)
    }
    if (isPusat) return summary.salary
    return prorataBreakdown?.gaji_crew_outlet?.nominalBulanan || summary.salary
  }, [isPusat, prorataBreakdown, hasHrPayroll, hrPayroll, summary.salary])

  const baselineCrewBonus = useMemo(() => {
    if (isPusat) return hrPayroll?.crewBonus || 0
    return prorataBreakdown?.bonus_crew?.nominalBulanan || hrPayroll?.crewBonus || 0
  }, [isPusat, prorataBreakdown, hrPayroll])

  const baselineManagerBonus = useMemo(() => {
    if (isPusat) return 0
    const b = (prorataBreakdown?.bonus_area_manager?.nominalBulanan || 0) + (prorataBreakdown?.bonus_regional_manager?.nominalBulanan || 0)
    return b > 0 ? b : (hrPayroll?.managerBonusAllocation || 0)
  }, [isPusat, prorataBreakdown, hrPayroll])

  // Data Lembur Kas Outlet (Petty Cash)
  const lemburData = useMemo(() => {
    const items = allTransactions
      .filter(t => t.category === 'lembur' || t.isLembur)
      .map(t => ({
        id: t.id,
        date: t.date,
        outletName: t.outlet_name,
        outletId: t.outlet_id,
        description: t.description,
        amount: Number(t.amount || 0),
        recipientName: t.recipient_name,
        receiptUrl: t.receipt_url,
      }))

    const outletMap = new Map<string, { outletName: string; outletId?: string | null; count: number; totalAmount: number }>()
    items.forEach(it => {
      const key = it.outletName || 'Cabang'
      const existing = outletMap.get(key) || { outletName: key, outletId: it.outletId, count: 0, totalAmount: 0 }
      existing.count += 1
      existing.totalAmount += it.amount
      outletMap.set(key, existing)
    })

    const outlets = Array.from(outletMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    const totalLembur = items.reduce((sum, it) => sum + it.amount, 0)

    return {
      totalLembur,
      totalCount: items.length,
      items,
      outlets
    }
  }, [allTransactions])

  const displayLembur = kartuClosing ? kartuClosing.lembur : lemburData.totalLembur
  const totalCombinedOpex = displaySalary + displayLembur + nonSalaryTampil

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
      if (isSalaryCategory(t.category) || t.category === 'lembur' || t.isLembur) return
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

  // Filtered and sorted transactions based on selected category, search query, and sort settings
  const displayedTransactions = useMemo(() => {
    const filtered = allTransactions.filter(tx => {
      const matchCat = matchesCategory(tx.category, selectedCategory)
      if (!matchCat) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const desc = (tx.description || '').toLowerCase()
      const outlet = (tx.outlet_name || '').toLowerCase()
      const recipient = (tx.recipient_name || '').toLowerCase()
      const catLabel = labelOf(tx.category).toLowerCase()

      return desc.includes(q) || outlet.includes(q) || recipient.includes(q) || catLabel.includes(q)
    })

    return [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'date':
          comparison = (a.date || '').localeCompare(b.date || '')
          break
        case 'amount':
          comparison = Number(a.amount || 0) - Number(b.amount || 0)
          break
        case 'outlet_name':
          comparison = (a.outlet_name || '').localeCompare(b.outlet_name || '', 'id')
          break
        case 'recipient_name':
          comparison = (a.recipient_name || '').localeCompare(b.recipient_name || '', 'id')
          break
        case 'category':
          comparison = labelOf(a.category).localeCompare(labelOf(b.category), 'id')
          break
        case 'source':
          comparison = (a.source || '').localeCompare(b.source || '', 'id')
          break
        default:
          comparison = 0
      }

      if (comparison === 0) {
        // Fallback secondary sort: tanggal terbaru lalu nominal terbesar
        const dateCmp = (b.date || '').localeCompare(a.date || '')
        if (dateCmp !== 0) return dateCmp
        return Number(b.amount || 0) - Number(a.amount || 0)
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [allTransactions, selectedCategory, searchQuery, sortField, sortDirection])

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

  const selectOptions = useMemo(() => {
    const outletMitra = validOutlets.filter(o => mitraIds.has(o.id))
    const outletInternal = validOutlets.filter(o => !mitraIds.has(o.id))
    // `groupLabel` menggambar garis pemisah berteks tepat di atas pilihan itu.
    const berkelompok = (daftar: typeof validOutlets, judul: string) =>
      daftar.map((o, i) => ({ label: o.name, value: o.id, ...(i === 0 ? { groupLabel: judul } : {}) }))
    return [
      { label: 'Semua Unit (Pusat & Outlet)', value: 'all' },
      { label: 'Semua Outlet (Khusus Cabang)', value: 'ALL_OUTLETS' },
      { label: 'Outlet Internal', value: 'INTERNAL_OUTLETS', indent: true },
      { label: 'Outlet Mitra', value: 'MITRA_OUTLETS', indent: true },
      ...(isAdmin ? [
        { label: 'Kantor Pusat (OPEX Pusat)', value: 'PUSAT' },
        { label: 'Kantor Pusat + Outlet Internal', value: 'INTERNAL_PUSAT' },
      ] : []),
      ...berkelompok(outletMitra, 'Mitra'),
      ...berkelompok(outletInternal, 'Internal'),
    ]
  }, [isAdmin, validOutlets, mitraIds])

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

      worksheet.mergeCells('A1:I1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = 'Laporan Pengeluaran OPEX - SukaShawarma'
      titleCell.font = { size: 14, bold: true }

      worksheet.getCell('A3').value = `Periode: ${startDate} s/d ${endDate}${selectedCategory !== 'all' ? ` | Kategori: ${labelOf(selectedCategory)}` : ''}`
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
          r.source === 'petty_cash' ? 'Kasir POS' : 'Transfer Bulanan',
          r.recipient_name || '-',
          labelOf(r.category),
          r.description || '-',
          r.receipt_url ? 'Ada Struk' : '-',
          r.amount
        ]
        row.getCell(9).numFmt = 'Rp #,##0'
        curIdx++
      })

      const totalRow = worksheet.getRow(curIdx)
      totalRow.values = ['TOTAL', '', '', '', '', '', '', '', displayedTotalOpex]
      totalRow.font = { bold: true }
      totalRow.getCell(9).numFmt = 'Rp #,##0'

      worksheet.columns.forEach(col => { col.width = 16 })
      worksheet.getColumn(7).width = 30
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
      const headers = ['No', 'Tanggal', 'Unit / Cabang', 'Sumber Biaya', 'Nama Pemohon', 'Kategori', 'Keterangan', 'Bukti Nota', 'Nominal Pengeluaran (Rp)']
      const rows = displayedTransactions.map((r, idx) => [
        idx + 1,
        `"${r.date}"`,
        `"${(r.outlet_name || '').replace(/"/g, '""')}"`,
        `"${r.source === 'petty_cash' ? 'Kasir POS' : 'Transfer Bulanan'}"`,
        `"${(r.recipient_name || '-').replace(/"/g, '""')}"`,
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
    if (preset === 'yesterday') {
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      const y = formatLocalDate(yesterday)
      setStartDate(y)
      setEndDate(y)
    } else if (preset === 'today') {
      const t = formatLocalDate(today)
      setStartDate(t)
      setEndDate(t)
    } else if (preset === 'this_month') {
      setStartDate(getFirstOfMonth(today))
      setEndDate(formatLocalDate(today))
    } else if (preset === 'last_month') {
      const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
      const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth() // 1-indexed (1 to 12)
      const padM = String(prevMonth).padStart(2, '0')
      const start = `${prevYear}-${padM}-01`
      const lastDay = new Date(prevYear, prevMonth, 0).getDate()
      const end = `${prevYear}-${padM}-${String(lastDay).padStart(2, '0')}`
      setStartDate(start)
      setEndDate(end)
    } else if (preset === 'last_7_days') {
      const past = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
      setStartDate(formatLocalDate(past))
      setEndDate(formatLocalDate(today))
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
        title="Buku Kas (OPEX)"
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

      {/* STATUS SINKRONISASI REALTIME & REFRESH BUTTON */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 -mt-3 mb-1 pt-2 border-t border-suka-brown/10 text-xs">
        <div className="flex items-center gap-2">
          {isPast ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[11px] shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Terakhir diperbarui: <strong>{formatLastUpdated(lastUpdated)}</strong> (Data Lampau Tersimpan)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-bold text-[11px] shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Realtime · Sinkronisasi POS: <strong>{formatLastUpdated(lastUpdated)}</strong></span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={expensesLoading || prorataLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white hover:bg-suka-gray-50 border border-suka-gray-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Muat ulang data pengeluaran dan gaji dari database"
          >
            <RefreshCw className={`w-3 h-3 text-suka-orange ${expensesLoading || prorataLoading || isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

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
            onClick={() => setPreset('yesterday')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activePreset === 'yesterday'
                ? 'bg-suka-orange text-white font-bold shadow-xs'
                : 'text-gray-600 hover:text-suka-brown hover:bg-white/70'
            }`}
          >
            Kemarin
          </button>
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

      {(kartuClosing || closingKartu.catatan) && (
        <div className={`mb-3 rounded-xl border px-3 py-2 text-xs font-semibold ${kartuClosing ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {kartuClosing
            ? 'Kartu OPEX September 2026 mengikuti laporan closing (sheet FIXED SEPTEMBER 2026). Daftar transaksi di bawah tetap data asli.'
            : closingKartu.catatan}
        </div>
      )}

      {/* SUMMARY STATS (PURE OPEX - DYNAMIC CARDS: ROUTINE SALARY, CREW BONUS, AM/RM BONUS, LEMBUR KAS, OPERATIONAL, TOTAL) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isPusat && displayCrewBonus === 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3.5 sm:gap-4.5`}>
        {/* 1. Gaji & Payroll (Rutin) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-xs hover:shadow-md hover:border-suka-gray-300 transition-all duration-200 flex flex-col justify-between min-w-0 min-h-[165px]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 flex-wrap min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <Users size={14} className="shrink-0" />
                  <span>{isPusat ? 'Gaji Rutin Pusat' : 'Gaji (Rutin)'}</span>
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
                {hasHrPayroll && effectiveProrataInfo.isProrated && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300/70 shadow-2xs"
                    title={`Prorata ${effectiveProrataInfo.overlapDays} hari dari total ${effectiveProrataInfo.totalDays} hari periode payroll (${(effectiveProrataInfo.ratio * 100).toFixed(1)}%)`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{effectiveProrataInfo.label}</span>
                  </span>
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs">
                <Users size={16} />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-2.5 tracking-tight truncate" title={rupiah(displayRoutineSalary)}>
              {rupiah(displayRoutineSalary)}
            </div>

            <div className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
              {hasHrPayroll ? (
                <span>
                  {isPusat ? (
                    `Gaji Rutin (${hrPayroll!.totalStaff} staf kantor pusat)`
                  ) : (
                    <>
                      Gaji Rutin ({hrPayroll!.crewCount ?? hrPayroll!.totalStaff} kru{(() => {
                        const parts: string[] = []
                        const reg = hrPayroll!.crewRegularCount ?? 0
                        const bkp = hrPayroll!.crewBackupCount ?? 0
                        const trn = hrPayroll!.crewTraineeCount ?? 0
                        const ojt = hrPayroll!.crewOjtCount ?? 0
                        if (reg > 0) parts.push(`${reg} Reguler`)
                        if (bkp > 0) parts.push(`${bkp} Backup`)
                        if (trn > 0) parts.push(`${trn} Trainee`)
                        if (ojt > 0) parts.push(`${ojt} OJT`)
                        return parts.length > 0 ? `: ${parts.join(', ')}` : ''
                      })()})
                      {Boolean(hrPayroll!.managerAllocation && hrPayroll!.managerAllocation > 0) && (
                        <span className="text-[10px] text-indigo-600 font-bold ml-1.5" title={`Termasuk alokasi beban rutin AM, RM, & Stock Controller: ${rupiah(hrPayroll!.managerRoutineAllocation ?? hrPayroll!.managerAllocation)}`}>
                          • Termasuk Rutin AM/RM/SC
                        </span>
                      )}
                    </>
                  )}
                  {prorataInfo.isProrated && (
                    <span className="text-[10px] text-amber-700 font-bold ml-1.5" title="Nilai acuan gaji rutin sebulan penuh sebelum prorata">
                      • Baseline 1 bln: {rupiah(baselineRoutineSalary)}
                    </span>
                  )}
                  {Boolean(displayBasicSalary > 0) && (
                    <span className="text-[10px] text-indigo-600 font-bold ml-1.5" title={prorataInfo.isProrated ? "Gaji Pokok Prorata" : "Total Gaji Pokok Murni"}>
                      • Gapok: {rupiah(displayBasicSalary)}
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  Beban gaji rutin crew & kantor
                  {baselineRoutineSalary > 0 && prorataInfo.isProrated && (
                    <span className="text-[10px] text-amber-700 font-bold ml-1.5">
                      • Baseline 1 bln: {rupiah(baselineRoutineSalary)}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between mt-auto">
            <button
              type="button"
              onClick={() => setActiveDetailModal('salary')}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-[10px] text-gray-400 font-medium">
              {hasHrPayroll && prorataInfo.isProrated
                ? `Prorata ${prorataInfo.overlapDays} Hari`
                : (isPusat ? `${hrPayroll?.totalStaff || 23} Staf Kantor` : 'Breakdown Staf')}
            </span>
          </div>
        </div>

        {/* 2. Bonus Kru Toko / Bonus Staf Kantor */}
        {(!isPusat || displayCrewBonus > 0) && (
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-xs hover:shadow-md hover:border-suka-gray-300 transition-all duration-200 flex flex-col justify-between min-w-0 min-h-[165px]">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 flex-wrap min-w-0">
                  <div className="flex items-center gap-1 shrink-0">
                    <Award size={14} className="shrink-0" />
                    <span>{isPusat ? 'Bonus Staf Kantor' : 'Bonus Kru'}</span>
                  </div>
                  {!isPusat && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300/70 shadow-2xs">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                      </span>
                      <span>Realtime Penjualan</span>
                    </span>
                  )}
                  {prorataInfo.isProrated && !isPusat && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300/70 shadow-2xs"
                      title={`Prorata ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari periode`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Prorata</span>
                    </span>
                  )}
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                  <Award size={16} />
                </div>
              </div>

              <div className="text-xl sm:text-2xl font-black text-amber-700 mt-2.5 tracking-tight truncate" title={rupiah(displayCrewBonus)}>
                {rupiah(displayCrewBonus)}
              </div>

              <div className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
                {isPusat ? (
                  <span>
                    {displayCrewBonus > 0
                      ? `${hrPayroll?.crewBonusDetails?.length || 0} penerima • Insentif Staf Kantor`
                      : 'Staf kantor tidak ada bonus omset toko'}
                  </span>
                ) : (
                  <span>
                    {hasHrPayroll && hrPayroll?.crewBonusDetails ? `${hrPayroll.crewBonusDetails.length} penerima` : 'Bonus Omset Kru'}
                    <span className="text-[10px] text-amber-700 font-bold ml-1.5">
                      • Kru Toko
                    </span>
                    {baselineCrewBonus > 0 && (
                      <span className="text-[10px] text-gray-400 font-normal ml-1" title="Estimasi bonus kru sebulan penuh berbasis transaksi penjualan MTD">
                        • 1 bln: {rupiah(baselineCrewBonus)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between mt-auto">
              <button
                type="button"
                onClick={() => setActiveDetailModal('bonus_kru')}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors cursor-pointer group"
              >
                <span>Lihat Detail</span>
                <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <span className="text-[10px] text-gray-400 font-medium">
                {isPusat ? 'Rincian Staf' : 'Rincian Kru'}
              </span>
            </div>
          </div>
        )}

        {/* 3. Bonus Sales AM & RM - HANYA UNTUK TOKO/OUTLET */}
        {!isPusat && (
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-xs hover:shadow-md hover:border-suka-gray-300 transition-all duration-200 flex flex-col justify-between min-w-0 min-h-[165px]">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5 flex-wrap min-w-0">
                  <div className="flex items-center gap-1 shrink-0">
                    <Briefcase size={14} className="shrink-0" />
                    <span>Bonus AM & RM</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-300/70 shadow-2xs">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
                    </span>
                    <span>Realtime Penjualan</span>
                  </span>
                  {prorataInfo.isProrated && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-300/70 shadow-2xs"
                      title={`Prorata ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari periode`}
                    >
                      <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                      <span>Prorata</span>
                    </span>
                  )}
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200/60 shadow-2xs">
                  <Briefcase size={16} />
                </div>
              </div>

              <div className="text-xl sm:text-2xl font-black text-purple-700 mt-2.5 tracking-tight truncate" title={rupiah(displayManagerBonus)}>
                {rupiah(displayManagerBonus)}
              </div>

              <div className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
                <span>
                  {hasHrPayroll && hrPayroll?.managerBonusDetails ? `${hrPayroll.managerBonusDetails.length} penerima` : 'Alokasi Pengawas'}
                  <span className="text-[10px] text-purple-700 font-bold ml-1.5">
                    • AM & RM
                  </span>
                  {baselineManagerBonus > 0 && (
                    <span className="text-[10px] text-gray-400 font-normal ml-1" title="Estimasi alokasi bonus bulanan penuh berbasis transaksi penjualan cabang binaan MTD">
                      • 1 bln: {rupiah(baselineManagerBonus)}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between mt-auto">
              <button
                type="button"
                onClick={() => setActiveDetailModal('bonus_manager')}
                className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors cursor-pointer group"
              >
                <span>Lihat Detail</span>
                <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <span className="text-[10px] text-gray-400 font-medium">
                Alokasi AM/RM
              </span>
            </div>
          </div>
        )}

        {/* 4. Lemburan */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-xs hover:shadow-md hover:border-suka-gray-300 transition-all duration-200 flex flex-col justify-between min-w-0 min-h-[165px]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1.5 flex-wrap min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <Clock size={14} className="shrink-0" />
                  <span>Lemburan</span>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-200/60 shadow-2xs">
                <Clock size={16} />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-black text-orange-700 mt-2.5 tracking-tight truncate" title={rupiah(displayLembur)}>
              {rupiah(displayLembur)}
            </div>

            <div className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
              <span>
                {lemburData.totalCount} nota lembur
                <span className="text-[10px] text-orange-700 font-bold ml-1.5">
                  • Petty Cash Toko
                </span>
              </span>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between mt-auto">
            <button
              type="button"
              onClick={() => setActiveDetailModal('lembur')}
              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-800 transition-colors cursor-pointer group"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-[10px] text-gray-400 font-medium">
              {lemburData.outlets.length} Cabang
            </span>
          </div>
        </div>

        {/* 5. Operasional Outlet & Pusat */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-xs hover:shadow-md hover:border-suka-gray-300 transition-all duration-200 flex flex-col justify-between min-w-0 min-h-[165px]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 truncate">
                <Store size={14} className="shrink-0" />
                <span className="truncate">Operasional Outlet & Pusat</span>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-2xs">
                <Store size={16} />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-2.5 tracking-tight truncate" title={rupiah(nonSalaryTampil)}>
              {rupiah(nonSalaryTampil)}
            </div>

            <div className="text-[11px] text-gray-500 font-semibold mt-0.5 truncate">
              Listrik, sewa, operasional ({operationalBreakdown.count} transaksi)
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between mt-auto">
            <button
              type="button"
              onClick={() => setActiveDetailModal('operational')}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer group"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-[10px] text-gray-400 font-medium">Per Kategori & Cabang</span>
          </div>
        </div>

        {/* 6. Total OPEX (Highlighted Full Background) */}
        <div className="relative overflow-hidden bg-linear-to-br from-rose-600 via-rose-600 to-rose-700 text-white p-4 sm:p-5 rounded-2xl border border-rose-500/80 shadow-md hover:shadow-lg hover:border-rose-400 transition-all duration-200 flex flex-col justify-between min-w-0 min-h-[165px]">
          {/* Watermark icon decoration */}
          <div className="absolute -right-4 -bottom-4 text-white/10 pointer-events-none">
            <ArrowUpRight size={110} strokeWidth={1.5} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-black text-rose-100 uppercase tracking-wider flex items-center gap-1.5 flex-wrap min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <ArrowUpRight size={14} className="shrink-0 text-white" />
                  <span className="text-white">Total OPEX</span>
                </div>
                {hasHrPayroll && prorataInfo.isProrated && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-white/20 px-2 py-0.5 rounded-full border border-white/30 shadow-2xs backdrop-blur-xs"
                    title="Termasuk beban gaji prorata sesuai rentang filter"
                  >
                    <Sparkles className="w-3 h-3 text-rose-200 shrink-0" />
                    <span>Prorata</span>
                  </span>
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/25 shadow-2xs backdrop-blur-xs">
                <ArrowUpRight size={16} />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-black text-white mt-2.5 tracking-tight truncate drop-shadow-xs" title={rupiah(totalCombinedOpex)}>
              {rupiah(totalCombinedOpex)}
            </div>

            <div
              className="text-[11px] text-rose-100/90 font-medium mt-0.5 truncate"
              title={isPusat
                ? `Gaji Rutin: ${rupiah(displayRoutineSalary)} + Lemburan: ${rupiah(displayLembur)} + Opex: ${rupiah(nonSalaryTampil)}`
                : `Gaji Rutin: ${rupiah(displayRoutineSalary)} + Kru: ${rupiah(displayCrewBonus)} + AM/RM: ${rupiah(displayManagerBonus)} + Lemburan: ${rupiah(displayLembur)} + Opex: ${rupiah(nonSalaryTampil)}`}
            >
              <span>Rutin: {rupiah(displayRoutineSalary)}</span>
              {!isPusat && (
                <>
                  <span className="text-rose-300 mx-1">+</span>
                  <span>Kru: {rupiah(displayCrewBonus)}</span>
                  <span className="text-rose-300 mx-1">+</span>
                  <span>AM/RM: {rupiah(displayManagerBonus)}</span>
                </>
              )}
              {isPusat && displayCrewBonus > 0 && (
                <>
                  <span className="text-rose-300 mx-1">+</span>
                  <span>Bonus: {rupiah(displayCrewBonus)}</span>
                </>
              )}
              <span className="text-rose-300 mx-1">+</span>
              <span>Lemburan: {rupiah(displayLembur)}</span>
              <span className="text-rose-300 mx-1">+</span>
              <span>Opex: {rupiah(nonSalaryTampil)}</span>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-white/20 flex items-center justify-between mt-auto relative z-10">
            <button
              type="button"
              onClick={() => setActiveDetailModal('total')}
              className="inline-flex items-center gap-1 text-xs font-bold text-white hover:text-rose-100 transition-colors cursor-pointer group"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-[10px] text-rose-200/90 font-medium">Rumus & Akumulasi</span>
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

            {/* Urutkan / Sort Dropdown */}
            <div className="relative flex-1 sm:flex-none min-w-[160px]">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                <ArrowUpDown size={13} className="text-suka-orange" />
              </div>
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-') as [SortField, SortDirection]
                  setSortField(field)
                  setSortDirection(dir)
                }}
                className="block w-full pl-8 pr-7 py-1.5 border border-suka-gray-200 rounded-xl leading-5 bg-white text-suka-brown font-bold focus:outline-none focus:ring-1 focus:ring-suka-orange focus:border-suka-orange transition-colors text-xs cursor-pointer shadow-2xs"
                title="Urutkan daftar pengeluaran"
              >
                <option value="date-desc">Tanggal Terbaru</option>
                <option value="date-asc">Tanggal Terlama</option>
                <option value="amount-desc">Nominal Terbesar</option>
                <option value="amount-asc">Nominal Terkecil</option>
                <option value="outlet_name-asc">Outlet (A - Z)</option>
                <option value="outlet_name-desc">Outlet (Z - A)</option>
                <option value="recipient_name-asc">Pemohon (A - Z)</option>
                <option value="recipient_name-desc">Pemohon (Z - A)</option>
                <option value="category-asc">Kategori (A - Z)</option>
                <option value="category-desc">Kategori (Z - A)</option>
                <option value="source-asc">Sumber Kasir POS Dulu</option>
                <option value="source-desc">Sumber Bulanan Dulu</option>
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

            {/* Tombol Reset Filter & Urutan */}
            {(selectedCategory !== 'all' || searchQuery || sortField !== 'date' || sortDirection !== 'desc') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all')
                  setSearchQuery('')
                  setSortField('date')
                  setSortDirection('desc')
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl border border-rose-200 transition-all cursor-pointer shrink-0"
                title="Reset semua filter dan urutan"
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
                setSortField('date')
                setSortDirection('desc')
              }}
              className="mt-3.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl border border-amber-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <X size={13} />
              Reset Filter & Urutan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse min-w-[960px]">
              <thead className="bg-gray-50 border-b border-suka-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th
                    onClick={() => handleSort('date')}
                    className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100 hover:text-suka-brown transition-colors group"
                    title="Klik untuk mengurutkan berdasarkan tanggal"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Tanggal</span>
                      {sortField === 'date' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={13} className="text-suka-orange shrink-0" />
                        ) : (
                          <ArrowDown size={13} className="text-suka-orange shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('outlet_name')}
                    className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100 hover:text-suka-brown transition-colors group"
                    title="Klik untuk mengurutkan berdasarkan outlet"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Outlet</span>
                      {sortField === 'outlet_name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={13} className="text-suka-orange shrink-0" />
                        ) : (
                          <ArrowDown size={13} className="text-suka-orange shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('source')}
                    className="px-3 py-3 text-center cursor-pointer select-none hover:bg-gray-100 hover:text-suka-brown transition-colors group"
                    title="Klik untuk mengurutkan berdasarkan sumber dana"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Sumber</span>
                      {sortField === 'source' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={13} className="text-suka-orange shrink-0" />
                        ) : (
                          <ArrowDown size={13} className="text-suka-orange shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('recipient_name')}
                    className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100 hover:text-suka-brown transition-colors group"
                    title="Klik untuk mengurutkan berdasarkan nama pemohon"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Nama Pemohon</span>
                      {sortField === 'recipient_name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={13} className="text-suka-orange shrink-0" />
                        ) : (
                          <ArrowDown size={13} className="text-suka-orange shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('category')}
                    className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100 hover:text-suka-brown transition-colors group"
                    title="Klik untuk mengurutkan berdasarkan kategori"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Kategori</span>
                      {sortField === 'category' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={13} className="text-suka-orange shrink-0" />
                        ) : (
                          <ArrowDown size={13} className="text-suka-orange shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-3 py-3 text-center">Bukti Nota</th>
                  <th
                    onClick={() => handleSort('amount')}
                    className="px-5 py-3 text-right cursor-pointer select-none hover:bg-gray-100 hover:text-suka-brown transition-colors group"
                    title="Klik untuk mengurutkan berdasarkan nominal pengeluaran"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Nominal Pengeluaran (Rp)</span>
                      {sortField === 'amount' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={13} className="text-suka-orange shrink-0" />
                        ) : (
                          <ArrowDown size={13} className="text-suka-orange shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors" />
                      )}
                    </div>
                  </th>
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.recipient_name && tx.recipient_name !== '-' ? (
                          <span className="font-bold text-gray-900 text-xs truncate max-w-[180px] block" title={tx.recipient_name}>
                            {tx.recipient_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">-</span>
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
                            <span>
                              {(() => {
                                if (tx.receipt_url?.startsWith('[')) {
                                  try {
                                    const parsed = JSON.parse(tx.receipt_url)
                                    if (Array.isArray(parsed) && parsed.length > 1) {
                                      return `${parsed.length} Nota`
                                    }
                                  } catch {}
                                }
                                return 'Lihat Nota'
                              })()}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black whitespace-nowrap text-sm text-rose-600">
                        -{rupiah(tx.amount)}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <div className={`flex items-center justify-center gap-1.5 ${tx.sintetis ? 'invisible' : ''}`}>
                          <button
                            type="button"
                            onClick={() => setEditingTx(tx.amount_asli != null ? { ...tx, amount: tx.amount_asli, description: tx.description_asli } : tx)}
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
                    <td colSpan={7} className="px-4 py-3.5 text-right uppercase tracking-wider text-gray-500 font-extrabold">
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
            <div className="flex-1 overflow-auto bg-gray-50 rounded-xl p-3 my-4 min-h-0 space-y-4">
              {(() => {
                let urls = [previewReceiptUrl]
                if (previewReceiptUrl.startsWith('[')) {
                  try {
                    const parsed = JSON.parse(previewReceiptUrl)
                    if (Array.isArray(parsed) && parsed.length > 0) urls = parsed
                  } catch {}
                }
                return urls.map((url, idx) => (
                  <div key={idx} className="flex flex-col items-center justify-center">
                    {urls.length > 1 && (
                      <span className="text-xs font-bold text-gray-600 mb-1.5 self-start">
                        Nota #${idx + 1}
                      </span>
                    )}
                    <img
                      src={url}
                      alt={`Bukti Nota ${idx + 1}`}
                      className="max-h-[55vh] object-contain rounded-lg shadow-xs"
                    />
                  </div>
                ))
              })()}
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
        isPusat={isPusat}
        salaryData={{
          displaySalary,
          displayRoutineSalary,
          displayBonus,
          displayCrewBonus,
          displayManagerBonus,
          hasHrPayroll: hasHrPayrollModal,
          hrPayroll: hrPayrollModal,
          cashSalary: summary.salary,
          isProrated: (hasHrPayrollModal && effectiveProrataInfo.isProrated) || isProratedOpex,
          prorataInfo: effectiveProrataInfo,
          baselineRoutine: baselineRoutineSalary,
          baselineCrewBonus,
          baselineManagerBonus,
        }}
        lemburData={lemburData}
        operationalData={{
          totalNonSalary: nonSalaryTampil,
          totalCount: operationalBreakdown.count,
          categories: operationalBreakdown.categories,
          outlets: operationalBreakdown.outlets
        }}
        totalOpexData={{
          totalCombined: totalCombinedOpex,
          displaySalary,
          displayRoutineSalary,
          displayBonus,
          displayCrewBonus,
          displayManagerBonus,
          displayLembur,
          totalNonSalary: nonSalaryTampil,
          isProrated: (hasHrPayrollModal && effectiveProrataInfo.isProrated) || isProratedOpex,
          prorataInfo: effectiveProrataInfo
        }}
      />
    </div>
  )
}
