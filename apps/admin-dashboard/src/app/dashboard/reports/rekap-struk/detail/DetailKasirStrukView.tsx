// @ts-nocheck
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Printer,
  Store,
  UserCheck,
  Calendar,
  Clock,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react'
import {
  getDetailKasirStrukReport,
  getDetailKasirStrukExport,
} from '@/app/actions/rekapStruk'
import { refreshPosReportRange } from '@/app/actions/posReport'
import {
  SKIP_KIND_LABELS,
  type CashierStrukRecapRow,
  type RekapStrukOrderRow,
  type SkipKindFilter,
} from '@/lib/posReport/rekapStruk'
import { extractOrderPackages } from '@/lib/posReport/compute'
import { receiptChips } from '@/lib/posReport/receiptReprint'
import ReceiptChipBadge from '@/app/dashboard/reports/pos/ReceiptReprintBadge'
import OrderSourceBadge from '@/components/OrderSourceBadge'
import { Select } from '@/components/ui/Select'

const wibDateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const wibTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function formatWibDate(isoStr: string): string {
  try {
    return wibDateFormatter.format(new Date(isoStr))
  } catch {
    return isoStr
  }
}

function formatWibTime(isoStr: string): string {
  try {
    return `${wibTimeFormatter.format(new Date(isoStr))} WIB`
  } catch {
    return ''
  }
}

function formatDateRangeLabel(from: string, to: string): string {
  if (!from || !to) return '-'
  try {
    const f = wibDateFormatter.format(new Date(`${from}T00:00:00+07:00`))
    const t = wibDateFormatter.format(new Date(`${to}T00:00:00+07:00`))
    return from === to ? f : `${f} – ${t}`
  } catch {
    return from === to ? from : `${from} – ${to}`
  }
}

function formatRp(val: number): string {
  return `Rp ${Math.round(Number(val) || 0).toLocaleString('id-ID')}`
}

interface DetailKasirStrukViewProps {
  outletId: string
  cashierName: string
  from: string
  to: string
  channels: string[]
  backHref: string
  initialData: Awaited<ReturnType<typeof getDetailKasirStrukReport>> | null
  initialRequestKey: string | null
}

const STATUS_FILTER_OPTIONS: { value: SkipKindFilter; label: string }[] = [
  { value: 'all_not_printed', label: 'Struk Tidak Dicetak' },
  { value: 'all_tracked', label: 'Semua Order Kasir Ini (Dicetak & Tidak)' },
  { value: 'customer_skipped', label: 'Struk Customer Tidak Dicetak' },
  { value: 'kitchen_skipped', label: 'Struk Dapur Tidak Dicetak' },
  { value: 'both_skipped', label: 'Customer & Dapur Tidak Dicetak' },
  { value: 'late', label: 'Dicetak Susulan (Terlambat)' },
]

export default function DetailKasirStrukView({
  outletId,
  cashierName,
  from,
  to,
  channels: initialChannels,
  backHref,
  initialData,
  initialRequestKey,
}: DetailKasirStrukViewProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getDetailKasirStrukReport>> | null>(
    initialData
  )
  const skipInitialFetchRef = useRef<string | null>(initialData ? initialRequestKey : null)
  const [loading, setLoading] = useState(!initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Detail Filters
  const [skipKindFilter, setSkipKindFilter] = useState<SkipKindFilter>('all_not_printed')
  const [selectedChannel, setSelectedChannel] = useState<string>(
    initialChannels.length === 1 && initialChannels[0] !== 'all' ? initialChannels[0] : 'all'
  )
  const [paymentMethod, setPaymentMethod] = useState<string>('all')
  const [searchInput, setSearchInput] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState<number>(1)
  const pageSize = 20

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 220)
    return () => clearTimeout(t)
  }, [searchInput])

  const isPawoonVisible = useMemo(() => new Date(from) < new Date('2026-08-01'), [from])

  const requestPayload = useMemo(
    () => ({
      outletId,
      cashierName,
      from,
      to,
      channels: selectedChannel === 'all' ? ['all'] : [selectedChannel],
      skipKindFilter,
      paymentMethod,
      search: debouncedSearch,
      sortDir,
      page,
      pageSize,
      isPawoonVisible,
    }),
    [
      outletId,
      cashierName,
      from,
      to,
      selectedChannel,
      skipKindFilter,
      paymentMethod,
      debouncedSearch,
      sortDir,
      page,
      pageSize,
      isPawoonVisible,
    ]
  )

  const reqSeqRef = useRef(0)

  const fetchDetail = useCallback(async () => {
    const seq = ++reqSeqRef.current
    setRefreshing(true)
    try {
      const res = await getDetailKasirStrukReport(requestPayload)
      if (seq !== reqSeqRef.current) return
      setData(res)
      setErrorMsg(null)
    } catch (err) {
      if (seq !== reqSeqRef.current) return
      console.error('getDetailKasirStrukReport error:', err)
      setErrorMsg('Gagal memuat rincian order kasir. Silakan coba muat ulang.')
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [requestPayload])

  useEffect(() => {
    const skipKey = skipInitialFetchRef.current
    skipInitialFetchRef.current = null
    if (skipKey && JSON.stringify(requestPayload) === skipKey) return
    fetchDetail()
  }, [fetchDetail, requestPayload])

  const cashierSummary: CashierStrukRecapRow = data?.cashierSummary ?? {
    key: `${outletId}__${cashierName}`,
    cashierName,
    outletId,
    outletName: 'Cabang',
    amName: '-',
    totalOrders: 0,
    trackedOrders: 0,
    printedOrders: 0,
    latePrintedOrders: 0,
    notPrintedOrders: 0,
    customerSkippedOrders: 0,
    kitchenSkippedOrders: 0,
    bothSkippedOrders: 0,
    printedRate: 0,
    notPrintedRate: 0,
    notPrintedRateAll: 0,
    notPrintedRevenue: 0,
    totalRevenue: 0,
    lastNotPrintedAt: null,
  }

  const rows: RekapStrukOrderRow[] = data?.table?.rows ?? []
  const totalRows = data?.table?.total ?? 0
  const totalPages = data?.table?.totalPages ?? 1
  const currentPage = data?.table?.page ?? 1
  const totalAmount = data?.table?.totalAmount ?? 0
  const totalItems = data?.table?.totalItems ?? 0
  const availableChannels = data?.availableChannels ?? []
  const availablePaymentMethods = data?.availablePaymentMethods ?? []

  const handleExportPdf = async () => {
    if (exportingPdf || totalRows === 0) return
    setExportingPdf(true)
    setErrorMsg(null)
    try {
      const [exportRes, { buatPdfDetailKasirStruk }] = await Promise.all([
        getDetailKasirStrukExport(requestPayload),
        import('@/lib/posReport/eksporStrukPdf'),
      ])
      await buatPdfDetailKasirStruk({
        periode: exportRes.periode,
        cashierSummary: exportRes.cashierSummary,
        filterStatusLabel: SKIP_KIND_LABELS[skipKindFilter] || 'Struk Tidak Dicetak',
        orders: exportRes.orders,
        totalOrderAmount: exportRes.totalOrderAmount,
        totalOrderItems: exportRes.totalOrderItems,
      })
    } catch (err) {
      console.error('export detail PDF error:', err)
      setErrorMsg('Gagal menyiapkan file PDF detail order kasir.')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ── Top Back Navigation & Header Card ── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl shadow-[0_2px_20px_rgba(44,24,16,0.03)] border border-stone-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-stone-100">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-extrabold text-stone-600 hover:text-[#2C1810] bg-stone-50 hover:bg-stone-100 border border-stone-200/80 px-3.5 py-2 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-suka-orange" />
            <span>Kembali ke Daftar Kasir</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={async () => {
                try {
                  await refreshPosReportRange(from, to)
                } catch {
                  // ignore
                }
                fetchDetail()
              }}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-suka-orange' : ''}`}
              />
              <span>{refreshing ? 'Menyegarkan...' : 'Segarkan Data'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf || totalRows === 0}
              className="inline-flex items-center gap-2 bg-[#4A1713] hover:bg-[#38100d] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 text-suka-orange" />
              )}
              <span>{exportingPdf ? 'Menyiapkan PDF...' : 'Export PDF Detail Order'}</span>
            </button>
          </div>
        </div>

        {/* Informasi Kasir, Cabang, AM & Ringkasan */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-bold">
              <Printer className="w-3.5 h-3.5 text-suka-orange" />
              <span>Detail Transaksi per Order · Khusus Offline & Website</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#2C1810] tracking-tight">
              {cashierSummary.cashierName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  Outlet: <strong className="text-[#2C1810]">{cashierSummary.outletName}</strong>
                </span>
              </span>
              <span className="text-stone-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  Area Manager: <strong className="text-[#2C1810]">{cashierSummary.amName}</strong>
                </span>
              </span>
              <span className="text-stone-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-suka-orange" />
                <span>
                  Periode WIB:{' '}
                  <strong className="text-[#2C1810]">{formatDateRangeLabel(from, to)}</strong>
                </span>
              </span>
            </div>
          </div>

          {/* Ringkasan Statistik Kasir pada Periode Ini */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:min-w-[540px]">
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl px-4 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
                Total Transaksi
              </div>
              <div className="text-lg font-extrabold text-[#2C1810] tabular-nums mt-0.5">
                {cashierSummary.totalOrders.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] font-medium text-stone-500">Offline & Website</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl px-4 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                Struk Dicetak
              </div>
              <div className="text-lg font-extrabold text-emerald-700 tabular-nums mt-0.5">
                {cashierSummary.printedOrders.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] font-bold text-emerald-700 tabular-nums">
                {cashierSummary.printedRate}% dari total trx
              </div>
            </div>

            <div className="bg-red-50/70 border border-red-200/80 rounded-2xl px-4 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-red-700">
                Tidak Dicetak
              </div>
              <div className="text-lg font-extrabold text-red-600 tabular-nums mt-0.5">
                {cashierSummary.notPrintedOrders.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] font-semibold text-red-700">
                Cust: {cashierSummary.customerSkippedOrders} · Dapur:{' '}
                {cashierSummary.kitchenSkippedOrders}
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl px-4 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
                % Struk Dicetak
              </div>
              <div
                className={`text-lg font-extrabold tabular-nums mt-0.5 ${
                  cashierSummary.printedRate >= 85 ? 'text-amber-700' : 'text-red-600'
                }`}
              >
                {cashierSummary.printedRate}%
              </div>
              <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full ${
                    cashierSummary.printedRate >= 85 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, cashierSummary.printedRate))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-red-800 text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded-lg hover:bg-red-100 text-red-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Tabel Daftar Per Order (Tanggal & Waktu WIB) ── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl shadow-[0_2px_20px_rgba(44,24,16,0.03)] border border-stone-200/80">
        {/* Filter Bar Tabel Detail Order */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-extrabold text-[#2C1810]">
              Daftar Transaksi Per Order
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-[#2C1810] border border-stone-200 text-xs font-extrabold tabular-nums">
              {totalRows.toLocaleString('id-ID')} Order
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Status Struk */}
            <div className="w-full sm:w-64">
              <Select
                value={skipKindFilter}
                onChange={(val) => {
                  setSkipKindFilter(val as SkipKindFilter)
                  setPage(1)
                }}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>

            {/* Filter Sumber Order (Offline vs Website) */}
            <div className="w-full sm:w-48">
              <Select
                value={selectedChannel}
                onChange={(val) => {
                  setSelectedChannel(val)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Semua (Offline & Web)' },
                  ...availableChannels.map((ch) => ({
                    value: ch.key,
                    label: ch.label,
                  })),
                ]}
              />
            </div>

            {/* Filter Metode Pembayaran */}
            <div className="w-full sm:w-44">
              <Select
                value={paymentMethod}
                onChange={(val) => {
                  setPaymentMethod(val)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Semua Metode Bayar' },
                  ...availablePaymentMethods.map((pm) => ({
                    value: pm.key,
                    label: pm.label,
                  })),
                ]}
              />
            </div>

            {/* Pencarian */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari #Order, pelanggan, menu..."
                className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-[#2C1810] placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-suka-orange transition-colors"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  aria-label="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabel Rincian Per Order */}
        <div className="overflow-x-auto rounded-2xl border border-stone-200/90">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">No. Order</th>
                <th className="py-3.5 px-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                      setPage(1)
                    }}
                    className="inline-flex items-center gap-1 hover:text-[#2C1810] cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-suka-orange" />
                    <span>Tanggal & Waktu (WIB)</span>
                    {sortDir === 'asc' ? (
                      <ChevronUp className="w-3.5 h-3.5 text-suka-orange" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-suka-orange" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Sumber Order</th>
                <th className="py-3.5 px-4">Pelanggan</th>
                <th className="py-3.5 px-4 min-w-[240px]">Rincian Item Pesanan</th>
                <th className="py-3.5 px-4 text-center">Metode Bayar</th>
                <th className="py-3.5 px-4 min-w-[210px]">Status Struk (Customer & Dapur)</th>
                <th className="py-3.5 px-4 text-right">Nominal Transaksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 w-6 bg-stone-100 rounded mx-auto" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-16 bg-stone-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-32 bg-stone-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 bg-stone-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 bg-stone-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-48 bg-stone-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-14 bg-stone-100 rounded mx-auto" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-36 bg-stone-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-20 bg-stone-100 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 mb-2.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-[#2C1810]">
                      Tidak Ada Order yang Sesuai Filter Ini
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Silakan ubah filter status struk, sumber order, atau kata kunci pencarian.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((order, idx) => {
                  const rowNo = (currentPage - 1) * pageSize + idx + 1
                  const chips = receiptChips(order)
                  const pkgs = extractOrderPackages(order)

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-stone-50/80 transition-colors align-top"
                    >
                      <td className="py-3.5 px-4 text-center text-xs font-bold text-stone-400 tabular-nums">
                        {rowNo}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-stone-100 text-[#2C1810] font-extrabold text-xs tabular-nums">
                          #{order.order_number}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#2C1810] text-xs">
                          {formatWibDate(order.created_at)}
                        </div>
                        <div className="text-[11px] font-semibold text-stone-500 tabular-nums mt-0.5">
                          {formatWibTime(order.created_at)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <OrderSourceBadge
                          channel={order.channel}
                          salesSource={order.sales_source}
                          customerName={order.customer_name}
                          isEndorse={order.is_endorse}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-stone-700">
                        {order.customer_name || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {(order.order_items || []).map((item) => (
                            <div
                              key={item.id}
                              className="text-xs text-[#2C1810] flex items-baseline gap-1.5"
                            >
                              <span className="font-extrabold text-suka-orange tabular-nums shrink-0">
                                {item.quantity}x
                              </span>
                              <span className="font-semibold">{item.menu_item_name}</span>
                            </div>
                          ))}
                          {pkgs.length > 0 && (
                            <div className="pt-1 space-y-0.5">
                              {pkgs.map((pkg, pIdx) =>
                                pkg.choices && Object.keys(pkg.choices).length > 0 ? (
                                  <div
                                    key={pIdx}
                                    className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200/70 rounded-lg px-2 py-1"
                                  >
                                    {Object.entries(pkg.choices)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(' · ')}
                                  </div>
                                ) : null
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-700 font-bold text-[11px] uppercase">
                          {order.payment_method || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {chips.length > 0 ? (
                            chips.map((chip) => (
                              <ReceiptChipBadge
                                key={chip.kind}
                                orderId={order.id}
                                chip={chip}
                              />
                            ))
                          ) : (
                            <span className="text-xs text-stone-400 font-medium">
                              Belum tercatat
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-[#2C1810] text-xs tabular-nums whitespace-nowrap">
                        {formatRp(order.total_amount)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-stone-100/90 border-t-2 border-stone-200 text-xs font-extrabold text-[#2C1810]">
                  <td colSpan={5} className="py-3.5 px-4">
                    TOTAL KESELURUHAN FILTER ({totalRows.toLocaleString('id-ID')} ORDER)
                  </td>
                  <td className="py-3.5 px-4 text-stone-700">
                    {totalItems.toLocaleString('id-ID')} Item Terjual
                  </td>
                  <td colSpan={2} className="py-3.5 px-4 text-right text-stone-500">
                    Total Nominal Order:
                  </td>
                  <td className="py-3.5 px-4 text-right text-sm tabular-nums text-[#2C1810]">
                    {formatRp(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
            <div className="font-semibold">
              Menampilkan halaman{' '}
              <strong className="text-[#2C1810] tabular-nums">{currentPage}</strong> dari{' '}
              <strong className="text-[#2C1810] tabular-nums">{totalPages}</strong> (
              {totalRows.toLocaleString('id-ID')} order)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || refreshing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 font-bold text-[#2C1810] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || refreshing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 font-bold text-[#2C1810] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
