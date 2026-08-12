'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight, Package, AlertCircle, FileText, Clock, TrendingUp } from 'lucide-react'
import { usePurchaseOrders, type POStatus, type POSummary } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { Spinner } from '@suka/design-system'
import { PageHeader, StatTile } from '@/components/ui'
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

export default function PembelianView({ initialData, defaultFrom, defaultTo }: { initialData: POSummary[], defaultFrom: string, defaultTo: string }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)

  const { data: pos = initialData, isLoading, error } = usePurchaseOrders({
    from: fromDate,
    to: toDate,
    status: statusFilter || undefined,
  }, initialData)

  const filtered = search
    ? pos.filter(p =>
        p.nomor_po.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier_nama.toLowerCase().includes(search.toLowerCase())
      )
    : pos

  const totalNilai = filtered.reduce((s, p) => s + (p.total_nilai ?? 0), 0)
  const waitingApproval = filtered.filter(p => p.status === 'menunggu_approval_finance').length
  const activePO = filtered.filter(p => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader 
        title="Purchase Order" 
        description="Kelola pembelian bahan baku dari supplier ke kitchen pusat."
      >
        <Link
          href="/dashboard/pembelian/new"
          className="mt-3 sm:mt-0 flex items-center justify-center gap-2 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-extrabold px-5 py-2.5 rounded-2xl hover:from-suka-ink hover:to-black active:scale-[.98] transition-all text-sm shadow-[0_8px_20px_rgba(44,24,16,0.15)]"
        >
          <Plus className="w-5 h-5" />
          Buat PO
        </Link>
      </PageHeader>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Total Nilai PO"
          value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
          sub={`${filtered.length} Dokumen Ditemukan`}
          icon={FileText}
          accent="brown"
        />
        <StatTile
          label="Menunggu Approval"
          value={<CountUp end={waitingApproval} duration={1} separator="." />}
          sub="PO Butuh Persetujuan Finance"
          icon={Clock}
          accent="orange"
        />
        <StatTile
          label="Sedang Diproses"
          value={<CountUp end={activePO} duration={1} separator="." />}
          sub="Dikirim & Sebagian Diterima"
          icon={TrendingUp}
          accent="green"
        />
      </div>

      {/* Filters */}
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-suka-gray-200/60 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor PO atau nama supplier..."
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
            <option value="">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-suka-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-suka-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
        </div>
      </div>

      {/* List */}
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

function POCard({ po }: { po: POSummary }) {
  const isActive = po.status === 'dikirim_ke_supplier' || po.status === 'sebagian_diterima'
  
  return (
    <Link href={`/dashboard/pembelian/${po.id}`}>
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-suka-gray-200/60 shadow-sm hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:bg-white/90 hover:border-suka-brown/20 transition-all duration-300 p-4 sm:p-5 flex items-center gap-4 group cursor-pointer relative overflow-hidden">
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-black text-suka-ink uppercase tracking-tight">{po.nomor_po}</span>
            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 border shadow-sm ${STATUS_COLOR[po.status]}`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
              {STATUS_LABEL[po.status]}
            </span>
          </div>
          <div className="text-xs font-bold text-suka-gray-600 mt-1.5 truncate">{po.supplier_nama}</div>
          <div className="flex items-center gap-3 mt-2 text-[10px] font-semibold text-suka-gray-400">
            <span className="bg-suka-gray-50 px-2 py-0.5 rounded-md border border-suka-gray-100">{new Date(po.tanggal_po).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',  day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>·</span>
            <span className="text-suka-brown">{po.jumlah_item} Item Dipesan</span>
            {po.nama_dibuat_oleh && <><span>·</span><span className="uppercase tracking-wider">Oleh: {po.nama_dibuat_oleh}</span></>}
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
