// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Search, 
  ArrowRight, 
  PackageCheck, 
  Calendar,
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react'
import { usePurchaseOrders, usePODetail, type POSummary } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui'
import { Spinner } from '@suka/design-system'
import { VerifikasiTerimaModal } from '../[id]/components/VerifikasiTerimaModal'
import CountUp from 'react-countup'

export function PenerimaanClient({ 
  initialData, 
  defaultFrom, 
  defaultTo 
}: { 
  initialData: POSummary[]
  defaultFrom: string
  defaultTo: string 
}) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'waiting' | 'partial' | 'completed'>('all')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  
  // Selected PO for modal verification
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const { data: selectedPoDetail, isLoading: loadingDetail } = usePODetail(selectedPoId || '', undefined)

  const { data: pos = initialData, isLoading, error } = usePurchaseOrders({
    from: fromDate,
    to: toDate,
  }, initialData)

  // Filter for goods receipt: POs that are either dikirim_ke_supplier, sebagian_diterima, or diterima_lengkap
  const relevantPos = useMemo(() => {
    return pos.filter(p => p.status !== 'draft' && p.status !== 'menunggu_approval_finance' && p.status !== 'dibatalkan')
  }, [pos])

  const waitingCount = relevantPos.filter(p => p.status === 'dikirim_ke_supplier').length
  const partialCount = relevantPos.filter(p => p.status === 'sebagian_diterima').length
  const completedCount = relevantPos.filter(p => p.status === 'diterima_lengkap').length
  const discrepancyCount = relevantPos.filter(p => p.has_discrepancy).length

  // Filtered by active tab and search
  const filtered = useMemo(() => {
    return relevantPos.filter(p => {
      // Tab filter
      if (activeTab === 'waiting' && p.status !== 'dikirim_ke_supplier') return false
      if (activeTab === 'partial' && p.status !== 'sebagian_diterima') return false
      if (activeTab === 'completed' && p.status !== 'diterima_lengkap') return false

      // Search filter
      if (search) {
        const q = search.toLowerCase()
        return p.nomor_po.toLowerCase().includes(q) || p.supplier_nama.toLowerCase().includes(q)
      }
      return true
    })
  }, [relevantPos, activeTab, search])

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* Modal Verifikasi Penerimaan Langsung */}
      {selectedPoId && selectedPoDetail && (
        <VerifikasiTerimaModal 
          po={selectedPoDetail} 
          onClose={() => setSelectedPoId(null)} 
        />
      )}

      {/* Header */}
      <PageHeader 
        title="Penerimaan Barang (Goods Receipt)" 
        description="Pusat verifikasi kedatangan fisik barang dari supplier, pemeriksaan kuantitas & kondisi, serta penambahan stok Gudang Kitchen."
      />

      {/* Top Strategic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Menunggu Pengiriman"
          value={<CountUp end={waitingCount} duration={1} />}
          hint="Dalam Perjalanan / Supplier"
          icon={<Truck className="w-5 h-5" />}
          tone={waitingCount > 0 ? 'orange' : 'default'}
        />
        <StatCard
          label="Diterima Sebagian"
          value={<CountUp end={partialCount} duration={1} />}
          hint="Perlu Pengiriman Lanjutan"
          icon={<Layers className="w-5 h-5" />}
          tone={partialCount > 0 ? 'orange' : 'default'}
        />
        <StatCard
          label="Selesai Diterima"
          value={<CountUp end={completedCount} duration={1} />}
          hint="Stok Masuk Gudang"
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="green"
        />
        <StatCard
          label="Discrepancy / Selisih"
          value={<CountUp end={discrepancyCount} duration={1} />}
          hint="Barang Kurang / Rusak"
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={discrepancyCount > 0 ? 'orange' : 'default'}
        />
      </div>

      {/* Controls & Filter Strip */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs Filter */}
          <div className="flex items-center bg-suka-cream/60 p-1 rounded-2xl border border-suka-brown/10 shadow-2xs overflow-x-auto">
            {[
              { key: 'all', label: 'Semua Status', count: relevantPos.length },
              { key: 'waiting', label: 'Menunggu Pengiriman', count: waitingCount },
              { key: 'partial', label: 'Parsial (Sebagian)', count: partialCount },
              { key: 'completed', label: 'Selesai Diterima', count: completedCount },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key 
                    ? 'bg-white text-suka-brown shadow-xs' 
                    : 'text-suka-ink/60 hover:text-suka-brown'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  activeTab === tab.key ? 'bg-suka-orange/20 text-suka-orange' : 'bg-suka-brown/10 text-suka-brown/70'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search and Date Range */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1 sm:flex-initial justify-end">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-suka-ink/40" />
              <input
                type="text"
                placeholder="Cari PO atau supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold text-suka-ink bg-suka-cream/30 border border-suka-brown/10 rounded-xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-1 bg-suka-cream/30 px-2.5 py-1 rounded-xl border border-suka-brown/10">
              <Calendar className="w-3.5 h-3.5 text-suka-orange" />
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
        </div>
      </div>

      {/* Main Receiving Table & Cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/60 rounded-3xl border border-suka-brown/5">
          <Spinner className="w-8 h-8 text-suka-orange mb-3" />
          <p className="text-suka-brown/60 font-semibold text-xs">Memuat daftar penerimaan barang…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 p-12 text-center shadow-sm">
          <Package className="w-12 h-12 mx-auto text-suka-brown/30 mb-3" />
          <h3 className="font-bold text-suka-brown text-base">Tidak Ada Dokumen Penerimaan</h3>
          <p className="text-xs text-suka-brown/60 mt-1 max-w-md mx-auto">
            {search ? 'Tidak ada dokumen yang cocok dengan kata kunci pencarian.' : 'Seluruh pengiriman barang pada rentang tanggal ini sudah diverifikasi atau belum ada PO aktif.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => {
            const itemPesan = po.jumlah_item || 0
            const itemTerima = po.jumlah_item_terima || 0
            const pct = itemPesan > 0 ? Math.min(100, Math.round((itemTerima / itemPesan) * 100)) : 0
            const isReadyToReceive = po.status === 'dikirim_ke_supplier' || po.status === 'sebagian_diterima'
            const isComplete = po.status === 'diterima_lengkap'

            return (
              <div 
                key={po.id}
                className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md hover:border-suka-orange/30 transition-all p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                {/* Left: PO & Supplier Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link 
                      href={`/pembelian/${po.id}`}
                      className="font-mono text-sm font-bold text-suka-brown hover:text-suka-orange transition-colors"
                    >
                      {po.nomor_po}
                    </Link>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${
                      isComplete 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : po.status === 'sebagian_diterima'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {po.status.replace(/_/g, ' ')}
                    </span>
                    {po.has_discrepancy && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Selisih Qty/Fisik
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-suka-brown mt-1 truncate">
                    Supplier: <span className="font-semibold">{po.supplier_nama}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-suka-brown/60 font-medium mt-1 flex-wrap">
                    <span>Dipesan: {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {po.tanggal_estimasi_tiba && (
                      <span className="text-suka-orange font-semibold">
                        • Est. Tiba: {new Date(po.tanggal_estimasi_tiba).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {po.diverifikasi_at && (
                      <span className="text-emerald-700 font-semibold">
                        • Diverifikasi: {new Date(po.diverifikasi_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: Fulfillment Progress Bar */}
                <div className="w-full lg:w-48 shrink-0 bg-suka-cream/40 p-3 rounded-2xl border border-suka-brown/5">
                  <div className="flex justify-between items-center text-[11px] font-bold text-suka-brown mb-1.5">
                    <span>Fulfillment Fisik</span>
                    <span className={pct === 100 ? 'text-emerald-700' : 'text-suka-orange'}>{pct}%</span>
                  </div>
                  <div className="w-full bg-suka-cream rounded-full h-2 overflow-hidden border border-suka-brown/10">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-stone-300'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-suka-brown/60 font-semibold mt-1">
                    <span>{itemTerima} dari {itemPesan} item</span>
                    <span>{rupiah(po.total_nilai || 0)}</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-suka-brown/5">
                  {isReadyToReceive && (
                    <button
                      onClick={() => setSelectedPoId(po.id)}
                      className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-suka-brown to-suka-ink text-white font-bold text-xs hover:opacity-95 active:scale-95 transition-all shadow-md shadow-suka-brown/20 cursor-pointer"
                    >
                      <PackageCheck className="w-4 h-4 text-suka-orange" />
                      <span>Verifikasi &amp; Terima</span>
                    </button>
                  )}
                  {isComplete && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Selesai Diterima
                    </span>
                  )}
                  <Link
                    href={`/pembelian/${po.id}`}
                    className="p-2.5 rounded-xl text-suka-brown/50 hover:text-suka-brown hover:bg-suka-cream transition-colors"
                    title="Lihat Rincian PO"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
