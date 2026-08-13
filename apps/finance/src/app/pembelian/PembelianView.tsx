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
  draft: 'bg-suka-gray-100 text-suka-gray-500 border-suka-gray-200',
  menunggu_approval_finance: 'bg-orange-50 text-suka-orange border-orange-200',
  dikirim_ke_supplier: 'bg-blue-50 text-blue-600 border-blue-200',
  sebagian_diterima: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  diterima_lengkap: 'bg-suka-green/10 text-suka-green border-suka-green/20',
  dibatalkan: 'bg-red-50 text-red-600 border-red-200',
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
      style: 'bg-red-50 text-red-600 border-red-200 animate-pulse font-black',
      category: 'overdue',
      dateText: due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      isOverdue: true,
    }
  } else if (diffDays === 0) {
    return {
      label: 'Jatuh Tempo Hari Ini!',
      style: 'bg-amber-50 text-amber-800 border-amber-300 font-extrabold',
      category: 'today',
      dateText: 'Hari Ini',
      isOverdue: false,
    }
  } else {
    return {
      label: `Sisa ${diffDays} Hari (TOP ${po.termin_hari || 0}H)`,
      style: 'bg-blue-50 text-blue-700 border-blue-200 font-bold',
      category: 'tempo',
      dateText: due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      isOverdue: false,
    }
  }
}

export default function PembelianView({ initialData, defaultFrom, defaultTo }: { initialData: POSummary[], defaultFrom: string, defaultTo: string }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
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
  const activePO = filtered.filter(p => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima').length
  const discrepancyCount = filtered.filter(p => p.has_discrepancy).length

  // Rata-rata fulfillment rate %
  const validPOWithItems = filtered.filter(p => p.jumlah_item > 0 && p.status !== 'draft' && p.status !== 'dibatalkan')
  const avgFulfillment = validPOWithItems.length > 0
    ? Math.round(
        validPOWithItems.reduce((acc, p) => acc + (Math.min(100, ((p.jumlah_item_terima ?? 0) / p.jumlah_item) * 100)), 0) / validPOWithItems.length
      )
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader 
        title="Purchase Order & Matching Dashboard" 
        description="Pusat kontrol pengadaan barang, verifikasi penerimaan fisik, dan 3-Way Matching invoice."
      >
        <Link
          href="/pembelian/new"
          className="mt-3 sm:mt-0 flex items-center justify-center gap-2 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-extrabold px-5 py-2.5 rounded-2xl hover:from-suka-ink hover:to-black active:scale-[.98] transition-all text-sm shadow-[0_8px_20px_rgba(44,24,16,0.15)]"
        >
          <Plus className="w-5 h-5" />
          Buat PO
        </Link>
      </PageHeader>

      {/* Top Strategic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Komitmen PO"
          value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
          hint={`${filtered.length} Dokumen Pembelian`}
          icon={<FileText className="w-5 h-5" />}
          tone="default"
        />
        <StatCard
          label="Realisasi Diterima"
          value={<><span className="text-lg align-top">Rp </span><CountUp end={totalTerima} duration={1} separator="." /></>}
          hint={`Terima Fisik vs Tagihan`}
          icon={<TrendingUp className="w-5 h-5" />}
          tone="green"
        />
        <StatCard
          label="Avg Fulfillment Rate"
          value={<><CountUp end={avgFulfillment} duration={1} /><span className="text-lg align-top">%</span></>}
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
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-suka-gray-200/60 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400" />
              <input
                type="text"
                placeholder="Cari nomor PO atau supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-suka-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all cursor-pointer"
            >
              <option value="">Semua Status PO</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={dueFilter}
              onChange={e => setDueFilter(e.target.value)}
              className="border border-suka-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all cursor-pointer"
            >
              <option value="">Semua Status Termin / Due</option>
              <option value="overdue">🔴 Menunggak (Overdue)</option>
              <option value="today">🟡 Jatuh Tempo Hari Ini</option>
              <option value="tempo">🔵 Tempo Masih Jalan</option>
            </select>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-suka-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-suka-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-suka-gray-100 p-1 rounded-xl border border-suka-gray-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-white text-suka-ink shadow-xs' : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              3-Way Matching Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'card' ? 'bg-white text-suka-ink shadow-xs' : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kartu PO
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
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-suka-gray-50/80 border-b border-suka-gray-200/60 text-[10px] uppercase font-black tracking-wider text-suka-gray-500">
              <th className="py-3.5 px-5">Nomor PO & Issue Date</th>
              <th className="py-3.5 px-5">Supplier</th>
              <th className="py-3.5 px-5 text-center">Progress & Arrival Date</th>
              <th className="py-3.5 px-5 text-right">Nilai Pesan vs Terima</th>
              <th className="py-3.5 px-5 text-right">Financial Variance</th>
              <th className="py-3.5 px-5 text-center">Payment Date & Aging</th>
              <th className="py-3.5 px-5 text-center">3-Way Match Status</th>
              <th className="py-3.5 px-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 text-xs">
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
                <tr key={po.id} className="hover:bg-white/80 transition-all group">
                  {/* 1. Nomor PO & Date of Issue */}
                  <td className="py-3.5 px-5">
                    <Link href={`/pembelian/${po.id}`} className="font-mono font-black text-suka-ink group-hover:text-suka-orange transition-colors text-sm">
                      {po.nomor_po}
                    </Link>
                    <div className="flex items-center gap-1.5 text-[10px] text-suka-gray-500 font-bold mt-1">
                      <span className="bg-suka-cream px-1.5 py-0.5 rounded text-[9px] text-suka-brown font-black uppercase tracking-wider">Issue</span>
                      <span>{new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {po.nama_dibuat_oleh && (
                      <div className="text-[9px] text-suka-gray-400 font-semibold mt-0.5 truncate">Oleh: {po.nama_dibuat_oleh}</div>
                    )}
                  </td>

                  {/* 2. Supplier */}
                  <td className="py-3.5 px-5 font-bold text-suka-brown max-w-[150px] truncate">
                    {po.supplier_nama}
                  </td>

                  {/* 3. Physical Progress & Date of Arrival */}
                  <td className="py-3.5 px-5">
                    <div className="w-36 mx-auto space-y-1.5 text-center">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-suka-gray-600">{itemTerima}/{itemPesan} item</span>
                        <span className={pctProgress === 100 ? 'text-emerald-600 font-black' : 'text-suka-brown'}>{pctProgress}%</span>
                      </div>
                      <div className="w-full bg-suka-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            pctProgress === 100 ? 'bg-emerald-500' : pctProgress > 0 ? 'bg-amber-500' : 'bg-suka-gray-300'
                          }`}
                          style={{ width: `${pctProgress}%` }}
                        />
                      </div>
                      <div className="text-[9px] font-semibold">
                        {isArrived ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
                            ✓ Arrived: {arrivalDateText}
                          </span>
                        ) : arrivalDateText ? (
                          <span className="text-suka-gray-500 font-bold bg-suka-gray-50 px-1.5 py-0.5 rounded">{arrivalDateText}</span>
                        ) : (
                          <span className="text-suka-gray-400 font-medium italic">Belum Tiba</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 4. Nilai Pesan vs Terima */}
                  <td className="py-3.5 px-5 text-right font-medium">
                    <div className="font-extrabold text-suka-ink text-sm">{rupiah(totalPesan)}</div>
                    {totalTerima > 0 && (
                      <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                        Terima: {rupiah(totalTerima)}
                      </div>
                    )}
                  </td>

                  {/* 5. Financial Variance */}
                  <td className="py-3.5 px-5 text-right font-black">
                    {po.status === 'draft' || po.status === 'menunggu_approval_finance' || po.status === 'dikirim_ke_supplier' ? (
                      <span className="text-suka-gray-300 font-normal">-</span>
                    ) : selisih === 0 ? (
                      <span className="text-emerald-600 text-[11px] font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Pas (0)
                      </span>
                    ) : selisih < 0 ? (
                      <div className="text-amber-700 text-[11px] font-black bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-block">
                        {rupiah(selisih)}
                      </div>
                    ) : (
                      <div className="text-red-600 text-[11px] font-black bg-red-50 px-2 py-0.5 rounded-md border border-red-200 inline-block">
                        +{rupiah(selisih)}
                      </div>
                    )}
                  </td>

                  {/* 6. Date of Payment & Aging */}
                  <td className="py-3.5 px-5 text-center">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full border ${agingInfo.style}`}>
                        <Calendar className="w-3 h-3" /> {agingInfo.label}
                      </span>
                      <div className="text-[9px] font-semibold">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-black bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            💳 Paid: {paymentDateText}
                          </span>
                        ) : agingInfo.dateText ? (
                          <span className="text-suka-gray-500 font-bold block">
                            Due: {agingInfo.dateText}
                          </span>
                        ) : (
                          <span className="text-suka-gray-400 font-medium block">Unpaid</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 7. 3-Way Match Status */}
                  <td className="py-3.5 px-5 text-center">
                    {matchStatus === 'validated' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Match Validated
                      </span>
                    )}
                    {matchStatus === 'discrepancy' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full animate-pulse">
                        <ShieldAlert className="w-3 h-3 text-red-600" /> Discrepancy / Tahan
                      </span>
                    )}
                    {matchStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full">
                        <Clock className="w-3 h-3 text-blue-600" /> In Transit / Terima
                      </span>
                    )}
                    {matchStatus === 'draft' && (
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${STATUS_COLOR[po.status]}`}>
                        {STATUS_LABEL[po.status]}
                      </span>
                    )}
                  </td>

                  {/* 8. Aksi */}
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/pembelian/${po.id}`}
                      className="inline-flex items-center gap-1 text-xs font-black text-suka-orange hover:text-orange-600 transition-colors"
                    >
                      Detail <ChevronRight className="w-4 h-4" />
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
      : agingInfo.dateText ? `Due ${agingInfo.dateText}` : 'Unpaid'

  return (
    <Link href={`/pembelian/${po.id}`}>
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-suka-gray-200/60 shadow-sm hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:bg-white/90 hover:border-suka-brown/20 transition-all duration-300 p-4 sm:p-5 flex items-center gap-4 group cursor-pointer relative overflow-hidden">
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-black text-suka-ink uppercase tracking-tight">{po.nomor_po}</span>
            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 border shadow-sm ${STATUS_COLOR[po.status]}`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
              {STATUS_LABEL[po.status]}
            </span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${agingInfo.style}`}>
              {agingInfo.label}
            </span>
            {po.has_discrepancy && (
              <span className="text-[9px] font-black bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-red-600" /> Discrepancy
              </span>
            )}
          </div>
          <div className="text-xs font-bold text-suka-gray-600 mt-1.5 truncate">{po.supplier_nama}</div>
          
          {/* 3-Date Timeline Badges */}
          <div className="flex items-center gap-2 mt-2.5 text-[10px] flex-wrap">
            <span className="bg-suka-cream px-2.5 py-1 rounded-lg border border-suka-brown/15 text-suka-brown font-extrabold flex items-center gap-1 shadow-2xs">
              📅 Issue: {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className={`px-2.5 py-1 rounded-lg border font-extrabold flex items-center gap-1 shadow-2xs ${
              isArrived ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-suka-gray-50 text-suka-gray-500 border-suka-gray-200'
            }`}>
              🚚 Arrive: {arrivalDateText}
            </span>
            <span className={`px-2.5 py-1 rounded-lg border font-extrabold flex items-center gap-1 shadow-2xs ${
              isPaid ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              💳 Payment: {paymentDateText}
            </span>
            {po.nama_dibuat_oleh && <span className="text-suka-gray-400 font-semibold">· Oleh {po.nama_dibuat_oleh}</span>}
          </div>
        </div>
        <div className="text-right shrink-0 z-10">
          <div className="font-black text-suka-brown text-base tracking-tight">{rupiah(po.total_nilai)}</div>
        </div>
        <ChevronRight className="w-5 h-5 text-suka-gray-300 group-hover:text-suka-orange transition-colors shrink-0 z-10" />
      </div>
    </Link>
  )
}
