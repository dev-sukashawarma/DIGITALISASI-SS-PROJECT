// @ts-nocheck
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Printer,
  Store,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  X,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getRekapStrukReport } from '@/app/actions/rekapStruk'
import { invalidatePosReportDays, refreshPosReportRange } from '@/app/actions/posReport'
import type { CashierStrukRecapRow } from '@/lib/posReport/rekapStruk'
import { addDaysStr, orderDatesFromRealtime, refreshDelayMs } from '@/lib/ownerDashboardCache'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { splitOutletsByType } from '@/lib/marketplaceOutlets'
import { isTestOutlet } from '@/lib/outletFilters'
import type { Outlet } from '@/pos-types'

type DateRangeType = 'today' | 'yesterday' | '7days' | 'thisMonth' | 'lastMonth' | 'all' | 'custom'

const RANGE_LABELS: Record<DateRangeType, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7days': '7 Hari Terakhir',
  thisMonth: 'Bulan Ini',
  lastMonth: 'Bulan Lalu',
  all: 'Semua Waktu',
  custom: 'Kustom Tanggal',
}

function formatLastUpdated(dateIso?: string) {
  if (!dateIso) return ''
  try {
    const d = new Date(dateIso)
    return (
      new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d) + ' WIB'
    )
  } catch {
    return ''
  }
}

function getPrintedRateStyle(printedRate: number, notPrintedOrders: number) {
  if (notPrintedOrders === 0 || printedRate >= 99.9) {
    return {
      textClass: 'text-emerald-700',
      barClass: 'bg-emerald-500',
    }
  }
  if (printedRate >= 85) {
    return {
      textClass: 'text-amber-700',
      barClass: 'bg-amber-500',
    }
  }
  return {
    textClass: 'text-red-600',
    barClass: 'bg-red-500',
  }
}

interface RekapStrukViewProps {
  initialOutlets: Outlet[]
  initialReport?: Awaited<ReturnType<typeof getRekapStrukReport>> | null
  initialRequestKey?: string | null
}

export default function RekapStrukView({
  initialOutlets: rawInitialOutlets,
  initialReport = null,
  initialRequestKey = null,
}: RekapStrukViewProps) {
  const initialOutlets = useMemo(
    () => rawInitialOutlets.filter((o) => !isTestOutlet(o) && o.type !== 'marketplace'),
    [rawInitialOutlets]
  )
  const { physical: physicalOutlets } = useMemo(
    () => splitOutletsByType(initialOutlets),
    [initialOutlets]
  )

  const [report, setReport] = useState<Awaited<ReturnType<typeof getRekapStrukReport>> | null>(
    initialReport
  )
  const skipInitialFetchRef = useRef<string | null>(initialReport ? initialRequestKey : null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const loading = !report
  const [lastUpdated, setLastUpdated] = useState<string>(
    () => initialReport?.fetchedAt ?? new Date().toISOString()
  )

  const todayJakarta = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
    []
  )

  // Global Top Filters
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>(
    initialOutlets.length === 1 ? [initialOutlets[0].id] : ['all']
  )
  const [selectedAm, setSelectedAm] = useState<string>('all')
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['all'])
  const [range, setRange] = useState<DateRangeType>(
    initialOutlets.length === 1 ? 'yesterday' : 'thisMonth'
  )
  const [showRangePicker, setShowRangePicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Table Search & Sort
  const [cashierSearch, setCashierSearch] = useState<string>('')
  const [cashierSortBy, setCashierSortBy] = useState<
    'notPrinted' | 'printed' | 'total' | 'printedRate' | 'cashierName' | 'outletName' | 'amName'
  >('notPrinted')
  const [cashierSortDir, setCashierSortDir] = useState<'asc' | 'desc'>('desc')

  const dateStrRange = useMemo(() => {
    if (range === 'today') return { from: todayJakarta, to: todayJakarta }
    if (range === 'yesterday') {
      const y = addDaysStr(todayJakarta, -1)
      return { from: y, to: y }
    }
    if (range === '7days') {
      return { from: addDaysStr(todayJakarta, -7), to: todayJakarta }
    }
    if (range === 'thisMonth') {
      return { from: `${todayJakarta.slice(0, 8)}01`, to: todayJakarta }
    }
    if (range === 'lastMonth') {
      const jkt = new Date(Date.now() + 7 * 3600 * 1000)
      const month = jkt.getUTCMonth() + 1
      const year = jkt.getUTCFullYear()
      const prevYear = month === 1 ? year - 1 : year
      const prevMonth = month === 1 ? 12 : month - 1
      const mm = String(prevMonth).padStart(2, '0')
      const lastDay = new Date(prevYear, prevMonth, 0).getDate()
      return {
        from: `${prevYear}-${mm}-01`,
        to: `${prevYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
      }
    }
    if (range === 'custom') {
      if (!customStartDate || !customEndDate) return { from: '', to: '' }
      return { from: customStartDate, to: customEndDate }
    }
    return { from: '2000-01-01', to: todayJakarta }
  }, [range, customStartDate, customEndDate, todayJakarta])

  const isPast = useMemo(() => {
    if (range === 'yesterday' || range === '7days' || range === 'lastMonth') {
      if (dateStrRange.to && dateStrRange.to < todayJakarta) return true
    }
    if (range === 'custom' && customEndDate && customEndDate < todayJakarta) return true
    return false
  }, [range, dateStrRange, customEndDate, todayJakarta])

  const PAWOON_CUTOFF = '2026-08-01'
  const isPawoonVisible = useMemo(() => {
    if (range === 'all') return true
    const from = dateStrRange.from
    if (!from) return false
    return new Date(from) < new Date(PAWOON_CUTOFF)
  }, [range, dateStrRange.from])

  const fetchRequestId = useRef(0)

  const reportRequest = useMemo(() => {
    if (!dateStrRange.from || !dateStrRange.to) return null
    return {
      from: dateStrRange.from,
      to: dateStrRange.to,
      outlets: selectedOutlets,
      channels: selectedChannels,
      skipKindFilter: 'all_not_printed' as const,
      outletDrilldown: 'all',
      cashierDrilldown: 'all',
      paymentMethod: 'all',
      search: '',
      page: 1,
      pageSize: 15,
      isPawoonVisible,
    }
  }, [dateStrRange, selectedOutlets, selectedChannels, isPawoonVisible])

  const fetchReport = useCallback(async () => {
    if (!reportRequest) return
    const requestId = ++fetchRequestId.current
    setRefreshing(true)
    try {
      const res = await getRekapStrukReport(reportRequest)
      if (requestId !== fetchRequestId.current) return
      setReport(res)
      setReportError(null)
      setLastUpdated(res.fetchedAt)
    } catch (err: any) {
      if (requestId !== fetchRequestId.current) return
      console.error('getRekapStrukReport error:', err)
      setReportError('Gagal memuat data rekap cetak struk. Silakan coba muat ulang.')
    } finally {
      if (requestId === fetchRequestId.current) setRefreshing(false)
    }
  }, [reportRequest])

  useEffect(() => {
    const skipKey = skipInitialFetchRef.current
    skipInitialFetchRef.current = null
    if (skipKey && reportRequest && JSON.stringify(reportRequest) === skipKey) return
    fetchReport()
  }, [fetchReport])

  // Realtime sync
  const fetchReportRef = useRef(fetchReport)
  fetchReportRef.current = fetchReport
  const rangeRef = useRef(dateStrRange)
  rangeRef.current = dateStrRange

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastRefreshAt: number | null = null
    let pendingWhileHidden = false
    const pendingPastDates = new Set<string>()

    const runRefresh = async () => {
      timer = null
      if (typeof document !== 'undefined' && document.hidden) {
        pendingWhileHidden = true
        return
      }
      const dates = Array.from(pendingPastDates)
      pendingPastDates.clear()
      if (dates.length > 0) {
        try {
          await invalidatePosReportDays(dates)
        } catch {
          // ignore
        }
      }
      lastRefreshAt = Date.now()
      fetchReportRef.current()
    }

    const schedule = () => {
      if (timer) return
      timer = setTimeout(runRefresh, refreshDelayMs(lastRefreshAt, Date.now()))
    }

    const onChange = (payload: any) => {
      const { from, to } = rangeRef.current
      if (!from || !to) return
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
        new Date()
      )
      const dates = orderDatesFromRealtime(payload)
      const pastDates = dates.filter((d) => d < today)
      pastDates.forEach((d) => pendingPastDates.add(d))
      const touchesToday = dates.length === 0 || dates.includes(today)
      const viewIncludesToday = from <= today && today <= to
      const pastInView = pastDates.some((d) => d >= from && d <= to)
      if (pastInView || (touchesToday && viewIncludesToday)) schedule()
    }

    const onVisible = () => {
      if (!document.hidden && pendingWhileHidden) {
        pendingWhileHidden = false
        schedule()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    const realtime = supabase
      .channel('rekap-struk-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(realtime)
    }
  }, [])

  const cashierRecap: CashierStrukRecapRow[] = report?.cashierRecap ?? []
  const availableAreaManagers: string[] = report?.availableAreaManagers ?? []
  const availableChannels = report?.availableChannels ?? []

  const selectedOutletName = selectedOutlets.includes('all')
    ? 'Semua Cabang'
    : selectedOutlets
        .map((id) => initialOutlets.find((o) => o.id === id)?.name)
        .filter(Boolean)
        .join(', ') || 'Cabang Terpilih'

  // Hanya tampilkan kasir yang tidak cetak struk (notPrintedOrders > 0), sesuai filter AM & pencarian
  const filteredCashiers = useMemo(() => {
    let list = cashierRecap.filter((c) => c.notPrintedOrders > 0)

    if (selectedAm !== 'all') {
      const qAm = selectedAm.toLowerCase()
      list = list.filter((c) => (c.amName || '').toLowerCase().includes(qAm))
    }

    if (cashierSearch.trim()) {
      const q = cashierSearch.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.cashierName.toLowerCase().includes(q) ||
          c.outletName.toLowerCase().includes(q) ||
          (c.amName && c.amName.toLowerCase().includes(q))
      )
    }

    list.sort((a, b) => {
      let diff = 0
      if (cashierSortBy === 'notPrinted') {
        diff = a.notPrintedOrders - b.notPrintedOrders || b.printedRate - a.printedRate
      } else if (cashierSortBy === 'printed') {
        diff = a.printedOrders - b.printedOrders || a.totalOrders - b.totalOrders
      } else if (cashierSortBy === 'total') {
        diff = a.totalOrders - b.totalOrders
      } else if (cashierSortBy === 'printedRate') {
        diff = a.printedRate - b.printedRate || b.notPrintedOrders - a.notPrintedOrders
      } else if (cashierSortBy === 'cashierName') {
        diff = a.cashierName.localeCompare(b.cashierName)
      } else if (cashierSortBy === 'outletName') {
        diff = a.outletName.localeCompare(b.outletName)
      } else if (cashierSortBy === 'amName') {
        diff = (a.amName || '').localeCompare(b.amName || '')
      }
      return cashierSortDir === 'asc' ? diff : -diff
    })

    return list
  }, [cashierRecap, selectedAm, cashierSearch, cashierSortBy, cashierSortDir])

  // Footer totals for the filtered cashier recap table
  const cashierTableTotals = useMemo(() => {
    let totalOrders = 0
    let printedOrders = 0
    let notPrintedOrders = 0
    let customerSkipped = 0
    let kitchenSkipped = 0
    for (let i = 0; i < filteredCashiers.length; i++) {
      const c = filteredCashiers[i]
      totalOrders += c.totalOrders
      printedOrders += c.printedOrders
      notPrintedOrders += c.notPrintedOrders
      customerSkipped += c.customerSkippedOrders
      kitchenSkipped += c.kitchenSkippedOrders
    }
    const printedRate =
      totalOrders > 0 ? Math.round((printedOrders / totalOrders) * 1000) / 10 : 0
    const notPrintedRate =
      totalOrders > 0 ? Math.round((notPrintedOrders / totalOrders) * 1000) / 10 : 0
    return {
      totalOrders,
      printedOrders,
      notPrintedOrders,
      customerSkipped,
      kitchenSkipped,
      printedRate,
      notPrintedRate,
    }
  }, [filteredCashiers])

  const toggleCashierSort = (
    col: 'notPrinted' | 'printed' | 'total' | 'printedRate' | 'cashierName' | 'outletName' | 'amName'
  ) => {
    if (cashierSortBy === col) {
      setCashierSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setCashierSortBy(col)
      setCashierSortDir(
        col === 'cashierName' || col === 'outletName' || col === 'amName' ? 'asc' : 'desc'
      )
    }
  }

  // Export PDF handler (hanya tabel kasir tidak cetak struk, sesuai filter aktif!)
  const handleExportPdf = async () => {
    if (!dateStrRange.from || !dateStrRange.to || exportingPdf) return
    if (filteredCashiers.length === 0) {
      setExportNotice('Tidak ada kasir yang melewati cetak struk pada filter ini untuk diekspor.')
      return
    }
    setExportingPdf(true)
    setExportNotice(null)
    try {
      const channelLabel = selectedChannels.includes('all')
        ? 'Order Offline & Website'
        : selectedChannels
            .map((ch) => availableChannels.find((c) => c.key === ch)?.label || ch)
            .join(', ')

      const filterParts: string[] = ['Daftar Kasir Tidak Cetak Struk (Khusus Order Offline & Website)']
      if (selectedChannels.length > 0 && !selectedChannels.includes('all')) {
        filterParts.push(`Sumber: ${channelLabel}`)
      }
      if (cashierSearch.trim()) {
        filterParts.push(`Pencarian: "${cashierSearch.trim()}"`)
      }

      const { buatPdfRekapStruk } = await import('@/lib/posReport/eksporStrukPdf')
      await buatPdfRekapStruk({
        periode: { from: dateStrRange.from, to: dateStrRange.to },
        cabangLabel: selectedOutletName,
        amLabel: selectedAm === 'all' ? 'Semua Area Manager' : selectedAm,
        channelLabel,
        filterInfoLabel: filterParts.join('  ·  '),
        cashiers: filteredCashiers,
      })
    } catch (err) {
      console.error('export PDF error:', err)
      setExportNotice('Gagal menyiapkan file PDF. Silakan coba lagi.')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ── Header & Filter Bar ── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl shadow-[0_2px_20px_rgba(44,24,16,0.03)] border border-stone-200/80">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#2C1810] tracking-tight flex items-center gap-2.5">
              <Printer className="w-6 h-6 text-suka-orange shrink-0" />
              <span>Rekap Cetak Struk Kasir & Outlet</span>
            </h1>
            <p className="text-stone-500 text-xs sm:text-sm mt-1 font-medium">
              Rekap khusus <strong className="text-[#2C1810]">Orderan Offline & Order Website</strong> (tanpa Food Apps) — daftar kasir yang tidak mencetak struk beserta cabang, AM, jumlah dicetak, tidak dicetak, dan persentasenya.
            </p>
          </div>

          {/* Filter Controls & Export PDF Button */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            {initialOutlets.length > 1 && (
              <MultiSelectDropdown
                icon={Store}
                options={physicalOutlets.map((o) => ({ id: o.id, name: o.name }))}
                selectedIds={selectedOutlets}
                onChange={(ids) => setSelectedOutlets(ids)}
                allLabel="Semua Cabang"
              />
            )}

            {/* Filter Area Manager */}
            {availableAreaManagers.length > 0 && (
              <div className="w-full sm:w-48">
                <Select
                  value={selectedAm}
                  onChange={(val) => setSelectedAm(val)}
                  options={[
                    { value: 'all', label: 'Semua Area Manager' },
                    ...availableAreaManagers.map((am) => ({
                      value: am,
                      label: `AM: ${am}`,
                    })),
                  ]}
                />
              </div>
            )}

            <MultiSelectDropdown
              options={availableChannels.map((ch) => ({ id: ch.key, name: ch.label }))}
              selectedIds={selectedChannels}
              onChange={(chs) => setSelectedChannels(chs)}
              allLabel="Offline & Website"
            />

            {/* Custom Date Range Selector */}
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowRangePicker(!showRangePicker)}
                className="w-full sm:w-auto flex items-center justify-between gap-2 bg-white border border-stone-200 hover:border-suka-orange/60 px-3.5 py-2 rounded-xl text-xs font-bold text-[#2C1810] transition-all shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-suka-orange" />
                  <span>{RANGE_LABELS[range]}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-stone-400 transition-transform ${
                    showRangePicker ? 'rotate-180 text-suka-orange' : ''
                  }`}
                />
              </button>

              {range === 'custom' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <DatePicker
                    label="Dari"
                    value={customStartDate}
                    onChange={(val) => setCustomStartDate(val)}
                    max={customEndDate || todayJakarta}
                    rangeFrom={customStartDate}
                    rangeTo={customEndDate}
                  />
                  <DatePicker
                    label="Sampai"
                    value={customEndDate}
                    onChange={(val) => setCustomEndDate(val)}
                    min={customStartDate}
                    max={todayJakarta}
                    rangeFrom={customStartDate}
                    rangeTo={customEndDate}
                    align="right"
                  />
                </div>
              )}

              {showRangePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRangePicker(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-stone-200 rounded-2xl shadow-[0_12px_36px_rgba(44,24,16,0.12)] py-2 z-50 w-48 animate-fade-in">
                    {(Object.keys(RANGE_LABELS) as DateRangeType[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRange(r)
                          setShowRangePicker(false)
                          if (r === 'custom' && !customStartDate) {
                            setCustomStartDate(`${todayJakarta.slice(0, 8)}01`)
                            setCustomEndDate(todayJakarta)
                          }
                        }}
                        className={`w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer ${
                          range === r
                            ? 'bg-amber-50 text-amber-800 font-bold'
                            : 'text-stone-600 hover:bg-stone-50 font-medium'
                        }`}
                      >
                        {RANGE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Tombol Export PDF */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf || filteredCashiers.length === 0}
              className="inline-flex items-center gap-2 bg-[#4A1713] hover:bg-[#38100d] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Ekspor tabel kasir tidak cetak struk ke PDF sesuai filter yang sedang aktif"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 text-suka-orange" />
              )}
              <span>{exportingPdf ? 'Menyiapkan PDF...' : 'Export PDF'}</span>
            </button>
          </div>
        </div>

        {/* Sub-bar Status Sinkronisasi */}
        <div className="mt-4 pt-3.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {isPast ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-bold text-[11px]">
                <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>Terakhir diperbarui: {formatLastUpdated(lastUpdated)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-bold text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                <span>Live Sinkronisasi POS · {formatLastUpdated(lastUpdated)}</span>
              </span>
            )}
            <span className="text-stone-500 font-medium">
              Cabang: <strong className="text-[#2C1810]">{selectedOutletName}</strong>
              {selectedAm !== 'all' && (
                <>
                  {' '}
                  · AM: <strong className="text-[#2C1810]">{selectedAm}</strong>
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (dateStrRange.from && dateStrRange.to) {
                try {
                  await refreshPosReportRange(dateStrRange.from, dateStrRange.to)
                } catch {
                  // ignore
                }
              }
              fetchReport()
            }}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-suka-orange' : ''}`} />
            <span>{refreshing ? 'Menyegarkan...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* Custom Notification Banner */}
      {(reportError || exportNotice) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-red-800 text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{reportError || exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setReportError(null)
              setExportNotice(null)
            }}
            className="p-1 rounded-lg hover:bg-red-100 text-red-700 cursor-pointer"
            aria-label="Tutup pesan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── TABEL UTAMA: REKAP SEMUA KASIR YANG TIDAK CETAK STRUK ── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl shadow-[0_2px_20px_rgba(44,24,16,0.03)] border border-stone-200/80">
        {/* Table Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-extrabold text-[#2C1810]">
              Daftar Kasir Tidak Cetak Struk
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-extrabold tabular-nums">
              {filteredCashiers.length.toLocaleString('id-ID')} Kasir
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Inline Summary Pills */}
            <div className="hidden sm:flex items-center gap-2.5 text-xs bg-stone-50 border border-stone-200/80 px-3.5 py-1.5 rounded-xl">
              <span className="text-stone-500 font-semibold">
                Total Trx:{' '}
                <strong className="text-[#2C1810] tabular-nums">
                  {cashierTableTotals.totalOrders.toLocaleString('id-ID')}
                </strong>
              </span>
              <span className="text-stone-300">|</span>
              <span className="text-emerald-700 font-semibold">
                Dicetak:{' '}
                <strong className="tabular-nums">
                  {cashierTableTotals.printedOrders.toLocaleString('id-ID')}
                </strong>{' '}
                ({cashierTableTotals.printedRate}%)
              </span>
              <span className="text-stone-300">|</span>
              <span className="text-red-600 font-semibold">
                Tidak Dicetak:{' '}
                <strong className="tabular-nums">
                  {cashierTableTotals.notPrintedOrders.toLocaleString('id-ID')}
                </strong>{' '}
                ({cashierTableTotals.notPrintedRate}%)
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={cashierSearch}
                onChange={(e) => setCashierSearch(e.target.value)}
                placeholder="Cari kasir, outlet, atau AM..."
                className="w-full pl-9 pr-8 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-[#2C1810] placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-suka-orange transition-colors"
              />
              {cashierSearch && (
                <button
                  type="button"
                  onClick={() => setCashierSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  aria-label="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Clean Table List */}
        <div className="overflow-x-auto rounded-2xl border border-stone-200/90">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                <th className="py-3.5 px-4 w-14 text-center">No</th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleCashierSort('cashierName')}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer"
                  >
                    <span>Nama Kasir</span>
                    {cashierSortBy === 'cashierName' &&
                      (cashierSortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                      ))}
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleCashierSort('outletName')}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer"
                  >
                    <span>Outlet / Cabang</span>
                    {cashierSortBy === 'outletName' &&
                      (cashierSortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                      ))}
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleCashierSort('amName')}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer"
                  >
                    <span>Nama AM</span>
                    {cashierSortBy === 'amName' &&
                      (cashierSortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                      ))}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleCashierSort('total')}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer ml-auto"
                  >
                    <span>Total Transaksi</span>
                    {cashierSortBy === 'total' &&
                      (cashierSortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                      ))}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleCashierSort('printed')}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer ml-auto"
                  >
                    <span>Struk Dicetak</span>
                    {cashierSortBy === 'printed' &&
                      (cashierSortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                      ))}
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleCashierSort('notPrinted')}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer ml-auto"
                  >
                    <span>Tidak Dicetak</span>
                    {cashierSortBy === 'notPrinted' &&
                      (cashierSortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                      ))}
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleCashierSort('printedRate')}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer"
                  >
                    <span>% Struk Dicetak (dari Total Trx)</span>
                    {cashierSortBy === 'printedRate' &&
                      (cashierSortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                      ))}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-suka-orange" />
                      <span>Memuat data rekap cetak struk...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCashiers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2" />
                    <div className="text-sm font-bold text-[#2C1810]">
                      Tidak Ada Kasir yang Melewati Cetak Struk pada Filter Ini
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5 font-medium">
                      Seluruh transaksi pada filter yang dipilih telah dicetak struknya dengan tertib.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCashiers.map((cashier, idx) => {
                  const rateStyle = getPrintedRateStyle(
                    cashier.printedRate,
                    cashier.notPrintedOrders
                  )

                  return (
                    <tr key={cashier.key} className="hover:bg-stone-50/80 transition-colors">
                      {/* No */}
                      <td className="py-3.5 px-4 text-center font-bold text-stone-400 text-xs tabular-nums">
                        {idx + 1}
                      </td>

                      {/* Nama Kasir */}
                      <td className="py-3.5 px-4 font-bold text-[#2C1810] text-sm">
                        {cashier.cashierName}
                      </td>

                      {/* Outlet / Cabang */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                          <Store className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{cashier.outletName}</span>
                        </span>
                      </td>

                      {/* Nama AM */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-stone-600">
                        {cashier.amName}
                      </td>

                      {/* Total Transaksi */}
                      <td className="py-3.5 px-4 text-right font-bold text-[#2C1810] tabular-nums">
                        {cashier.totalOrders.toLocaleString('id-ID')}
                      </td>

                      {/* Struk Dicetak */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold text-xs tabular-nums">
                          {cashier.printedOrders.toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Tidak Dicetak */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200/80 font-bold text-xs tabular-nums">
                            {cashier.notPrintedOrders.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] text-stone-400 font-medium mt-0.5">
                            Cust: {cashier.customerSkippedOrders} · Dapur:{' '}
                            {cashier.kitchenSkippedOrders}
                          </span>
                        </div>
                      </td>

                      {/* Persentase Struk Dicetak dari Total Transaksi */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`text-sm font-extrabold tabular-nums ${rateStyle.textClass}`}
                          >
                            {cashier.printedRate}% Dicetak
                          </span>
                          <span className="text-[11px] font-bold text-red-600 tabular-nums">
                            ({cashier.notPrintedRate}% Tidak Cetak)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${rateStyle.barClass}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, cashier.printedRate))}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Table Footer Totals */}
            {filteredCashiers.length > 0 && (
              <tfoot className="bg-stone-50 border-t-2 border-stone-200 font-extrabold text-xs text-[#2C1810]">
                <tr>
                  <td colSpan={4} className="py-3.5 px-4 uppercase tracking-wider">
                    TOTAL ({filteredCashiers.length.toLocaleString('id-ID')} KASIR TIDAK CETAK STRUK)
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-sm">
                    {cashierTableTotals.totalOrders.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-sm text-emerald-700">
                    {cashierTableTotals.printedOrders.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-sm text-red-600">
                    {cashierTableTotals.notPrintedOrders.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 tabular-nums">
                    <span className="text-emerald-700">
                      {cashierTableTotals.printedRate}% Dicetak
                    </span>
                    <span className="text-stone-400 mx-1.5">·</span>
                    <span className="text-red-600">
                      {cashierTableTotals.notPrintedRate}% Tidak Cetak
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
