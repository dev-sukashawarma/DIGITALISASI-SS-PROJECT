'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight, Package, AlertCircle } from 'lucide-react'
import { usePurchaseOrders, type POStatus, type POSummary } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { Spinner } from '@suka/design-system'

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft',
  dikirim_ke_supplier: 'Dikirim ke Supplier',
  sebagian_diterima: 'Sebagian Diterima',
  diterima_lengkap: 'Diterima Lengkap',
  dibatalkan: 'Dibatalkan',
}

const STATUS_COLOR: Record<POStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  dikirim_ke_supplier: 'bg-blue-100 text-blue-700',
  sebagian_diterima: 'bg-yellow-100 text-yellow-700',
  diterima_lengkap: 'bg-green-100 text-green-700',
  dibatalkan: 'bg-red-100 text-red-600',
}

export default function PembelianPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])

  const { data: pos = [], isLoading, error } = usePurchaseOrders({
    from: fromDate,
    to: toDate,
    status: statusFilter || undefined,
  })

  const filtered = search
    ? pos.filter(p =>
        p.nomor_po.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier_nama.toLowerCase().includes(search.toLowerCase())
      )
    : pos

  const totalNilai = filtered.reduce((s, p) => s + (p.total_nilai ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-suka-brown tracking-tight">Purchase Order</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola pembelian bahan baku dari supplier ke kitchen pusat.</p>
        </div>
        <Link
          href="/dashboard/pembelian/new"
          className="flex items-center gap-2 bg-suka-orange text-white font-bold px-4 py-2.5 rounded-xl hover:bg-suka-orange/90 active:scale-95 transition-all text-sm shadow-sm"
        >
          <Plus size={16} />
          Buat PO
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor PO atau supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-suka-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-suka-brown/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20 bg-white"
          >
            <option value="">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
        </div>

        {/* Summary bar */}
        <div className="flex gap-4 pt-2 border-t border-suka-gray-100 text-sm">
          <div>
            <span className="text-gray-500">Total PO:</span>
            <span className="font-bold text-suka-brown ml-1">{filtered.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Nilai:</span>
            <span className="font-bold text-suka-brown ml-1">{rupiah(totalNilai)}</span>
          </div>
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
  return (
    <Link href={`/dashboard/pembelian/${po.id}`}>
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm hover:shadow-md hover:border-suka-brown/20 transition-all p-4 flex items-center gap-4 group cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-suka-brown">{po.nomor_po}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLOR[po.status]}`}>
              {STATUS_LABEL[po.status]}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-0.5 truncate">{po.supplier_nama}</div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>·</span>
            <span>{po.jumlah_item} item</span>
            {po.nama_dibuat_oleh && <><span>·</span><span>oleh {po.nama_dibuat_oleh}</span></>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-extrabold text-suka-brown text-sm">{rupiah(po.total_nilai)}</div>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-suka-orange transition-colors shrink-0" />
      </div>
    </Link>
  )
}
