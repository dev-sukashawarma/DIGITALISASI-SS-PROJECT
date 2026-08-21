// @ts-nocheck
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight, Package, AlertCircle, FileText, Clock, TrendingUp, LayoutGrid, Table, CheckCircle2, ShieldAlert, Calendar, AlertTriangle } from 'lucide-react'
import { usePurchaseOrders, type POStatus, type POSummary } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { Spinner } from '@suka/design-system'
import { PageHeader, StatCard } from '@/components/ui'
import CountUp from 'react-countup'

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft',
  menunggu_approval_finance: 'Menunggu Approval Finance',
  dikirim_ke_supplier: 'Dikirim ke Supplier',
  sebagian_diterima: 'Sebagian Diterima',
  diterima_lengkap: 'Diterima Lengkap',
  dibatalkan: 'Dibatalkan',
}

const STATUS_COLOR: Record<POStatus, string> = {
  draft: 'bg-stone-100 text-stone-600 border-stone-200',
  menunggu_approval_finance: 'bg-amber-50 text-amber-800 border-amber-200',
  dikirim_ke_supplier: 'bg-blue-50 text-blue-700 border-blue-200',
  sebagian_diterima: 'bg-orange-50 text-orange-700 border-orange-200',
  diterima_lengkap: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  dibatalkan: 'bg-rose-50 text-rose-700 border-rose-200',
}

function getDueDateAgingInfo(po: POSummary) {
  if (!po.jatuh_tempo) {
    if (po.termin_hari && po.termin_hari > 0) {
      return { label: `TOP ${po.termin_hari} Hari`, style: 'bg-blue-50 text-blue-700 border-blue-200', category: 'tempo' }
    }
    return { label: 'Cash / COD', style: 'bg-emerald-50 text-emerald-700 border-emerald-200', category: 'cod' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(po.jatuh_tempo)
  due.setHours(0, 0, 0, 0)

  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      label: `OVERDUE ${Math.abs(diffDays)} Hari`,
      style: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
      category: 'overdue',
      dateText: due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      isOverdue: true,
    }
  } else if (diffDays === 0) {
    return {
      label: 'Jatuh Tempo Hari Ini!',
      style: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
      category: 'today',
      dateText: 'Hari Ini',
      isOverdue: false,
    }
  } else {
    return {
      label: `Sisa ${diffDays} Hari (TOP ${po.termin_hari || 0}H)`,
      style: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
      category: 'tempo',
      dateText: due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      isOverdue: false,
    }
  }
}

export default function PembelianView({ 
  initialData, 
  defaultFrom, 
  defaultTo,
  title = "Purchase Order & Matching Dashboard",
  description = "Pusat kontrol pengadaan barang, verifikasi penerimaan fisik, dan 3-Way Matching invoice.",
  defaultStatusFilter = '',
  hideCreateButton = false
}: { 
  initialData: POSummary[], 
  defaultFrom: string, 
  defaultTo: string,
  title?: string,
  description?: string,
  defaultStatusFilter?: string,
  hideCreateButton?: boolean
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatusFilter)
  const [dueFilter, setDueFilter] = useState<string>('')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')

  const { data: pos = initialData, isLoading, error } = usePurchaseOrders({
    from: fromDate,
    to: toDate,
    status: statusFilter || undefined,
  }, initialData)

  const filtered = pos.filter(p => {
    // Search filter
    const matchSearch = search
      ? p.nomor_po.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier_nama.toLowerCase().includes(search.toLowerCase())
      : true

    // Due filter
    if (!matchSearch) return false
    if (!dueFilter) return true

    const aging = getDueDateAgingInfo(p)
    if (dueFilter === 'overdue') return aging.category === 'overdue'
    if (dueFilter === 'today') return aging.category === 'today'
    if (dueFilter === 'tempo') return aging.category === 'tempo'
    return true
  })

  const totalNilai = filtered.reduce((s, p) => s + (p.total_nilai ?? 0), 0)
  const totalTerima = filtered.reduce((s, p) => s + (p.total_nilai_terima ?? 0), 0)
  const overdueCount = pos.filter(p => getDueDateAgingInfo(p).category === 'overdue').length
  const discrepancyCount = filtered.filter(p => p.has_discrepancy).length

  // Rata-rata fulfillment rate %
  const validPOWithItems = filtered.filter(p => p.jumlah_item > 0 && p.status !== 'draft' && p.status !== 'dibatalkan')
  const avgFulfillment = validPOWithItems.length > 0
    ? Math.round(
        validPOWithItems.reduce((acc, p) => acc + (Math.min(100, ((p.jumlah_item_terima ?? 0) / p.jumlah_item) * 100)), 0) / validPOWithItems.length
      )
    : 0

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <PageHeader 
        title={title} 
        description={description}
      >
        {!hideCreateButton && (
          <Link
            href="/pembelian/new"
            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-bold px-4 py-2.5 rounded-2xl hover:opacity-95 active:scale-[0.98] transition-all text-xs shadow-md shadow-suka-brown/20"
          >
            <Plus className="w-4 h-4 text-suka-orange" />
            <span>Buat PO</span>
          </Link>
        )}
      </PageHeader>

      {/* Top Strategic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Komitmen PO"
          value={<><span className="text-sm align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
          hint={`${filtered.length} Dokumen Pembelian`}
          icon={<FileText className="w-5 h-5" />}
          tone="default"
        />
        <StatCard
          label="Realisasi Diterima"
          value={<><span className="text-sm align-top">Rp </span><CountUp end={totalTerima} duration={1} separator="." /></>}
          hint="Terima Fisik vs Tagihan"
          icon={<TrendingUp className="w-5 h-5" />}
          tone="green"
        />
        <StatCard
          label="Avg Fulfillment Rate"
          value={<><CountUp end={avgFulfillment} duration={1} /><span className="text-sm align-top">%</span></>}
          hint="Capaian Kedatangan Barang"
          icon={<Package className="w-5 h-5" />}
          tone="blue"
        />
        <StatCard
          label="Menunggak / Overdue"
          value={<CountUp end={overdueCount} duration={1} />}
          hint={`${discrepancyCount} PO Discrepancy Alert`}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={overdueCount > 0 ? 'orange' : 'default'}
        />
      </div>

      {/* Filters & View Switcher */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-suka-ink/40" />
              <input
                type="text"
                placeholder="Cari nomor PO atau nama supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-suka-ink bg-suka-cream/30 border border-suka-brown/10 rounded-xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-suka-brown/10 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown bg-suka-cream/30 focus:outline-none focus:border-suka-orange transition-all cursor-pointer"
            >
              <option value="">Semua Status PO</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={dueFilter}
              onChange={e => setDueFilter(e.target.value)}
              className="border border-suka-brown/10 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown bg-suka-cream/30 focus:outline-none focus:border-suka-orange transition-all cursor-pointer"
            >
              <option value="">Semua Status Termin</option>
              <option value="overdue">🔴 Menunggak (Overdue)</option>
              <option value="today">🟡 Jatuh Tempo Hari Ini</option>
              <option value="tempo">🔵 Tempo Masih Jalan</option>
            </select>
            <div className="flex items-center gap-1 bg-suka-cream/30 px-2 py-1 rounded-xl border border-suka-brown/10">
              <input 
                type="date" 
                value={fromDate} 
                onChange={e => setFromDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-suka-brown outline-none" 
              />
              <span className="text-suka-brown/40 font-bold text-xs">-</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={e => setToDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-suka-brown outline-none" 
              />
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-suka-cream/60 p-1 rounded-xl border border-suka-brown/10 shadow-2xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-suka-brown shadow-xs' : 'text-suka-ink/50 hover:text-suka-brown'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabel Matching</span>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'card' ? 'bg-white text-suka-brown shadow-xs' : 'text-suka-ink/50 hover:text-suka-brown'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kartu PO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle size={18} />
          <span className="text-sm">Gagal memuat data: {(error as Error).message}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada Purchase Order</p>
          <p className="text-sm mt-1">Klik "Buat PO" untuk memulai</p>
        </div>
      ) : viewMode === 'table' ? (
        <MatchingProgressTable pos={filtered} />
      ) : (
        <div className="space-y-2">
          {filtered.map((po) => (
            <POCard key={po.id} po={po} />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchingProgressTable({ pos }: { pos: POSummary[] }) {
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px] text-xs sm:text-sm">
          <thead>
            <tr className="bg-suka-cream/70 border-b border-suka-brown/10 text-[11px] uppercase font-bold tracking-wider text-suka-brown/80 select-none">
              <th className="py-4 px-5">Nomor PO &amp; Tanggal</th>
              <th className="py-4 px-5">Supplier</th>
              <th className="py-4 px-5 text-center">Progress &amp; Kedatangan</th>
              <th className="py-4 px-5 text-right">Pesan vs Terima</th>
              <th className="py-4 px-5 text-right">Selisih (Variance)</th>
              <th className="py-4 px-5 text-center">Jatuh Tempo &amp; Bayar</th>
              <th className="py-4 px-5 text-center">3-Way Match</th>
              <th className="py-4 px-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-brown/5 text-suka-ink font-medium">
            {pos.map((po) => {
              const totalPesan = po.total_nilai ?? 0
              const totalTerima = po.total_nilai_terima ?? 0
              const selisih = totalTerima - totalPesan
              const itemPesan = po.jumlah_item ?? 0
              const itemTerima = po.jumlah_item_terima ?? 0
              const pctProgress = itemPesan > 0 ? Math.min(100, Math.round((itemTerima / itemPesan) * 100)) : 0
              const agingInfo = getDueDateAgingInfo(po)

              // Determine 3-way match status
              let matchStatus: 'validated' | 'discrepancy' | 'pending' | 'draft' = 'pending'
              if (po.status === 'draft' || po.status === 'menunggu_approval_finance') {
                matchStatus = 'draft'
              } else if (po.has_discrepancy) {
                matchStatus = 'discrepancy'
              } else if (po.status === 'diterima_lengkap') {
                matchStatus = 'validated'
              } else {
                matchStatus = 'pending'
              }

              const isArrived = !!po.diverifikasi_at || po.status === 'diterima_lengkap' || po.status === 'sebagian_diterima' || itemTerima > 0
              const arrivalDateText = po.diverifikasi_at
                ? new Date(po.diverifikasi_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                : isArrived
                  ? new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                  : po.tanggal_estimasi_tiba
                    ? `Est. ${new Date(po.tanggal_estimasi_tiba).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
                    : null

              const isPaid = !!po.paid_at || po.payment_status === 'paid'
              const paymentDateText = po.paid_at
                ? new Date(po.paid_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                : isPaid
                  ? new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                  : null

              return (
                <tr key={po.id} className="hover:bg-amber-50/40 transition-colors group">
                  {/* 1. Nomor PO & Date of Issue */}
                  <td className="py-4 px-5">
                    <Link href={`/pembelian/${po.id}`} className="font-mono font-bold text-suka-brown group-hover:text-suka-orange transition-colors text-sm">
                      {po.nomor_po}
                    </Link>
                    <div className="flex items-center gap-1.5 text-[11px] text-suka-brown/60 font-medium mt-0.5">
                      <span className="bg-suka-cream px-1.5 py-0.5 rounded text-[10px] text-suka-brown font-bold uppercase tracking-wider border border-suka-brown/10">Issue</span>
                      <span>{new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {po.nama_dibuat_oleh && (
                      <div className="text-[10px] text-suka-brown/50 font-medium mt-0.5 truncate">Oleh: {po.nama_dibuat_oleh}</div>
                    )}
                  </td>

                  {/* 2. Supplier */}
                  <td className="py-4 px-5 font-bold text-suka-brown max-w-[160px] truncate">
                    {po.supplier_nama}
                  </td>

                  {/* 3. Physical Progress & Date of Arrival */}
                  <td className="py-4 px-5">
                    <div className="w-36 mx-auto space-y-1.5 text-center">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-suka-brown/70">{itemTerima}/{itemPesan} item</span>
                        <span className={pctProgress === 100 ? 'text-emerald-700 font-bold' : 'text-suka-brown'}>{pctProgress}%</span>
                      </div>
                      <div className="w-full bg-suka-cream/80 rounded-full h-1.5 overflow-hidden border border-suka-brown/10">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            pctProgress === 100 ? 'bg-emerald-500' : pctProgress > 0 ? 'bg-amber-500' : 'bg-stone-300'
                          }`}
                          style={{ width: `${pctProgress}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-medium">
                        {isArrived ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            ✓ Tiba: {arrivalDateText}
                          </span>
                        ) : arrivalDateText ? (
                          <span className="text-suka-brown/60 font-semibold bg-suka-cream px-1.5 py-0.5 rounded border border-suka-brown/10">{arrivalDateText}</span>
                        ) : (
                          <span className="text-suka-brown/40 font-medium italic">Belum Tiba</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 4. Nilai Pesan vs Terima */}
                  <td className="py-4 px-5 text-right">
                    <div className="font-bold text-suka-brown text-sm tabular-nums">{rupiah(totalPesan)}</div>
                    {totalTerima > 0 && (
                      <div className="text-[11px] font-semibold text-emerald-700 mt-0.5 tabular-nums">
                        Terima: {rupiah(totalTerima)}
                      </div>
                    )}
                  </td>

                  {/* 5. Financial Variance */}
                  <td className="py-4 px-5 text-right font-bold tabular-nums">
                    {po.status === 'draft' || po.status === 'menunggu_approval_finance' || po.status === 'dikirim_ke_supplier' ? (
                      <span className="text-suka-brown/30 font-normal">-</span>
                    ) : selisih === 0 ? (
                      <span className="text-emerald-700 text-[11px] font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Pas (0)
                      </span>
                    ) : selisih < 0 ? (
                      <div className="text-amber-800 text-[11px] font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-block">
                        {rupiah(selisih)}
                      </div>
                    ) : (
                      <div className="text-rose-700 text-[11px] font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 inline-block">
                        +{rupiah(selisih)}
                      </div>
                    )}
                  </td>

                  {/* 6. Date of Payment & Aging */}
                  <td className="py-4 px-5 text-center">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg border ${agingInfo.style}`}>
                        <Calendar className="w-3 h-3" /> {agingInfo.label}
                      </span>
                      <div className="text-[10px] font-medium">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            💳 Lunas: {paymentDateText}
                          </span>
                        ) : agingInfo.dateText ? (
                          <span className="text-suka-brown/60 font-semibold block">
                            Due: {agingInfo.dateText}
                          </span>
                        ) : (
                          <span className="text-suka-brown/40 font-medium block">Belum Lunas</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 7. 3-Way Match Status */}
                  <td className="py-4 px-5 text-center">
                    {matchStatus === 'validated' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Match Valid
                      </span>
                    )}
                    {matchStatus === 'discrepancy' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-lg animate-pulse">
                        <ShieldAlert className="w-3 h-3 text-rose-600" /> Selisih / Tahan
                      </span>
                    )}
                    {matchStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                        <Clock className="w-3 h-3 text-blue-600" /> In Transit
                      </span>
                    )}
                    {matchStatus === 'draft' && (
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg uppercase tracking-wider border ${STATUS_COLOR[po.status]}`}>
                        {STATUS_LABEL[po.status]}
                      </span>
                    )}
                  </td>

                  {/* 8. Aksi */}
                  <td className="py-4 px-5 text-right">
                    <Link
                      href={`/pembelian/${po.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-suka-orange hover:text-suka-brown transition-colors"
                    >
                      <span>Detail</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function POCard({ po }: { po: POSummary }) {
  const isActive = po.status === 'dikirim_ke_supplier' || po.status === 'sebagian_diterima'
  const agingInfo = getDueDateAgingInfo(po)
  const itemTerima = po.jumlah_item_terima ?? 0

  const isArrived = !!po.diverifikasi_at || po.status === 'diterima_lengkap' || po.status === 'sebagian_diterima' || itemTerima > 0
  const arrivalDateText = po.diverifikasi_at
    ? new Date(po.diverifikasi_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    : isArrived
      ? new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      : po.tanggal_estimasi_tiba
        ? `Est. ${new Date(po.tanggal_estimasi_tiba).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
        : 'Belum Tiba'

  const isPaid = !!po.paid_at || po.payment_status === 'paid'
  const paymentDateText = po.paid_at
    ? new Date(po.paid_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    : isPaid
      ? new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      : agingInfo.dateText ? `Due ${agingInfo.dateText}` : 'Belum Lunas'

  return (
    <Link href={`/pembelian/${po.id}`}>
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md hover:border-suka-orange/30 transition-all p-5 flex items-center gap-4 group cursor-pointer relative overflow-hidden">
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-suka-brown uppercase tracking-tight">{po.nomor_po}</span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1.5 border ${STATUS_COLOR[po.status]}`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
              {STATUS_LABEL[po.status]}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${agingInfo.style}`}>
              {agingInfo.label}
            </span>
            {po.has_discrepancy && (
              <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-600" /> Selisih
              </span>
            )}
          </div>
          <div className="text-xs font-bold text-suka-brown mt-1.5 truncate">{po.supplier_nama}</div>
          
          {/* 3-Date Timeline Badges */}
          <div className="flex items-center gap-2 mt-2 text-[11px] flex-wrap">
            <span className="bg-suka-cream px-2 py-0.5 rounded-lg border border-suka-brown/10 text-suka-brown font-semibold flex items-center gap-1">
              📅 Issue: {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className={`px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 ${
              isArrived ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-suka-cream/50 text-suka-brown/60 border-suka-brown/10'
            }`}>
              🚚 Tiba: {arrivalDateText}
            </span>
            <span className={`px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 ${
              isPaid ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              💳 Bayar: {paymentDateText}
            </span>
            {po.nama_dibuat_oleh && <span className="text-suka-brown/50 font-medium">· Oleh {po.nama_dibuat_oleh}</span>}
          </div>
        </div>
        <div className="text-right shrink-0 z-10">
          <div className="font-bold text-suka-brown text-base tracking-tight tabular-nums">{rupiah(po.total_nilai)}</div>
        </div>
        <ChevronRight className="w-5 h-5 text-suka-brown/30 group-hover:text-suka-orange transition-colors shrink-0 z-10" />
      </div>
    </Link>
  )
}
