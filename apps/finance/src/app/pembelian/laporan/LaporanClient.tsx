// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  FileText, 
  Download, 
  Calendar, 
  Search, 
  TrendingUp, 
  CheckCircle2, 
  Truck, 
  AlertTriangle, 
  ChevronRight,
  Filter,
  BarChart3,
  Building2
} from 'lucide-react'
import { usePurchaseOrders, type POSummary } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui'
import { Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import CountUp from 'react-countup'

export function LaporanClient({ 
  initialData, 
  defaultFrom, 
  defaultTo 
}: { 
  initialData: POSummary[]
  defaultFrom: string
  defaultTo: string 
}) {
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)

  const { data: pos = initialData, isLoading } = usePurchaseOrders({
    from: fromDate,
    to: toDate,
  }, initialData)

  // Overall Statistics
  const stats = useMemo(() => {
    const valid = pos.filter(p => p.status !== 'dibatalkan')
    const totalSpend = valid.reduce((sum, p) => sum + (p.total_nilai || 0), 0)
    const totalRealisasi = valid.reduce((sum, p) => sum + (p.total_nilai_terima || p.total_nilai || 0), 0)
    
    const totalItemPesan = valid.reduce((sum, p) => sum + (p.jumlah_item || 0), 0)
    const totalItemTerima = valid.reduce((sum, p) => sum + (p.jumlah_item_terima || 0), 0)
    const fulfillmentRate = totalItemPesan > 0 ? Math.round((totalItemTerima / totalItemPesan) * 100) : 100

    const uniqueSuppliers = new Set(valid.map(p => p.supplier_nama)).size

    return {
      totalSpend,
      totalRealisasi,
      totalCount: pos.length,
      fulfillmentRate,
      uniqueSuppliers
    }
  }, [pos])

  // Supplier Breakdown
  const supplierRanking = useMemo(() => {
    const map = new Map<string, { nama: string; totalSpend: number; poCount: number }>()
    pos.filter(p => p.status !== 'dibatalkan').forEach(p => {
      const existing = map.get(p.supplier_nama) || { nama: p.supplier_nama, totalSpend: 0, poCount: 0 }
      existing.totalSpend += (p.total_nilai || 0)
      existing.poCount += 1
      map.set(p.supplier_nama, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend)
  }, [pos])

  // Unique list of suppliers for filter dropdown
  const supplierNames = useMemo(() => {
    return Array.from(new Set(pos.map(p => p.supplier_nama))).filter(Boolean)
  }, [pos])

  // Filtered dataset
  const filtered = useMemo(() => {
    return pos.filter(p => {
      if (supplierFilter !== 'all' && p.supplier_nama !== supplierFilter) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return p.nomor_po.toLowerCase().includes(q) || p.supplier_nama.toLowerCase().includes(q)
      }
      return true
    })
  }, [pos, supplierFilter, statusFilter, search])

  // Export to CSV
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }

    const headers = [
      'Nomor PO',
      'Tanggal PO',
      'Supplier',
      'Status PO',
      'Jumlah Item Pesan',
      'Jumlah Item Terima',
      'Total Nilai PO (Rp)',
      'Realisasi Terima (Rp)',
      'Status Pembayaran',
      'Tgl Verifikasi Gudang',
      'Dibuat Oleh'
    ]

    const rows = filtered.map(p => [
      `"${p.nomor_po}"`,
      `"${p.tanggal_po}"`,
      `"${p.supplier_nama.replace(/"/g, '""')}"`,
      `"${p.status}"`,
      p.jumlah_item || 0,
      p.jumlah_item_terima || 0,
      p.total_nilai || 0,
      p.total_nilai_terima || p.total_nilai || 0,
      `"${p.payment_status || 'unpaid'}"`,
      `"${p.diverifikasi_at ? new Date(p.diverifikasi_at).toLocaleDateString('id-ID') : '-'}"`,
      `"${(p.nama_dibuat_oleh || '').replace(/"/g, '""')}"`
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Laporan_Pembelian_${fromDate}_sd_${toDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Laporan berhasil diekspor ke CSV')
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* Header */}
      <PageHeader 
        title="Laporan & Rekapitulasi Pembelian" 
        description="Analisis komitmen biaya pengadaan bahan baku, kinerja pemenuhan supplier, dan ekspor riwayat dokumen PO."
        action={
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-bold text-xs rounded-2xl hover:opacity-95 active:scale-95 transition-all shadow-md shadow-suka-brown/20 cursor-pointer"
          >
            <Download className="w-4 h-4 text-suka-orange" />
            <span>Ekspor CSV</span>
          </button>
        }
      />

      {/* Strategic KPI StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Komitmen Belanja"
          value={<><span className="text-sm align-top">Rp </span><CountUp end={stats.totalSpend} duration={1} separator="." /></>}
          hint="Nilai Akumulasi PO Sah"
          icon={<TrendingUp className="w-5 h-5" />}
          tone="default"
        />
        <StatCard
          label="Fulfillment Rate"
          value={<><CountUp end={stats.fulfillmentRate} duration={1} /><span className="text-sm"> %</span></>}
          hint="Ketercapaian Fisik Barang"
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone={stats.fulfillmentRate >= 80 ? 'green' : 'orange'}
        />
        <StatCard
          label="Supplier Aktif"
          value={<CountUp end={stats.uniqueSuppliers} duration={1} />}
          hint="Mitra Pengadaan Berjalan"
          icon={<Building2 className="w-5 h-5" />}
          tone="default"
        />
        <StatCard
          label="Total Transaksi PO"
          value={<CountUp end={stats.totalCount} duration={1} />}
          hint="Dokumen Diterbitkan"
          icon={<FileText className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Top Suppliers Analytics Bar */}
      {supplierRanking.length > 0 && (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-suka-brown text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-suka-orange" />
              <span>Top Supplier by Total Belanja</span>
            </h3>
            <span className="text-[11px] font-semibold text-suka-brown/50">Rentang tanggal terpilih</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {supplierRanking.slice(0, 3).map((sup, idx) => {
              const share = stats.totalSpend > 0 ? Math.round((sup.totalSpend / stats.totalSpend) * 100) : 0
              return (
                <div key={sup.nama} className="p-3.5 rounded-2xl bg-suka-cream/30 border border-suka-brown/10 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-suka-orange uppercase tracking-wider">#{idx + 1} Pemasok Utama</span>
                      <h4 className="font-bold text-suka-brown text-xs sm:text-sm truncate mt-0.5">{sup.nama}</h4>
                    </div>
                    <span className="text-xs font-bold text-suka-brown bg-white px-2 py-0.5 rounded-md border border-suka-brown/10">
                      {share}%
                    </span>
                  </div>
                  <div className="flex justify-between items-end mt-3 pt-2 border-t border-dashed border-suka-brown/10">
                    <span className="text-[11px] text-suka-brown/60 font-medium">{sup.poCount} Transaksi PO</span>
                    <span className="text-xs font-bold text-suka-brown tabular-nums">{rupiah(sup.totalSpend)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter and Date Bar */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-suka-ink/40" />
            <input
              type="text"
              placeholder="Cari PO atau supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold text-suka-ink bg-suka-cream/30 border border-suka-brown/10 rounded-xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all"
            />
          </div>

          {/* Dropdowns and Date Picker */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1 sm:flex-initial justify-end">
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="px-3 py-1.5 bg-suka-cream/30 border border-suka-brown/10 rounded-xl text-xs font-bold text-suka-brown outline-none focus:border-suka-orange"
            >
              <option value="all">Semua Supplier</option>
              {supplierNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-suka-cream/30 border border-suka-brown/10 rounded-xl text-xs font-bold text-suka-brown outline-none focus:border-suka-orange"
            >
              <option value="all">Semua Status PO</option>
              <option value="draft">Draft</option>
              <option value="menunggu_approval_finance">Menunggu Approval</option>
              <option value="dikirim_ke_supplier">Dikirim ke Supplier</option>
              <option value="sebagian_diterima">Sebagian Diterima</option>
              <option value="diterima_lengkap">Diterima Lengkap</option>
              <option value="dibatalkan">Dibatalkan</option>
            </select>

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

      {/* Comprehensive Report Ledger Table */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner className="w-8 h-8 text-suka-orange mb-3" />
            <p className="text-suka-brown/60 font-semibold text-xs">Memuat data laporan pembelian…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-suka-brown/30 mb-3" />
            <h3 className="font-bold text-suka-brown text-base">Tidak Ada Transaksi</h3>
            <p className="text-xs text-suka-brown/60 mt-1 max-w-md mx-auto">
              Tidak ada catatan PO yang sesuai dengan kriteria dan rentang tanggal yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-suka-cream/70 text-suka-brown/80 text-[11px] uppercase font-bold tracking-wider select-none border-b border-suka-brown/10">
                  <th className="py-3 px-4">Nomor PO</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">Item</th>
                  <th className="py-3 px-4 text-right">Nilai Pesanan</th>
                  <th className="py-3 px-4 text-right">Realisasi Terima</th>
                  <th className="py-3 px-4 text-center">Status Pemenuhan</th>
                  <th className="py-3 px-4 text-center">Status Bayar</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/5">
                {filtered.map(po => {
                  const totalPesan = po.total_nilai || 0
                  const totalTerima = po.total_nilai_terima || totalPesan
                  const isPaid = po.payment_status === 'paid' || !!po.paid_at

                  return (
                    <tr key={po.id} className="hover:bg-suka-cream/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-suka-brown">
                        {po.nomor_po}
                      </td>
                      <td className="py-3 px-4 text-suka-ink/80 font-medium whitespace-nowrap">
                        {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 font-bold text-suka-brown truncate max-w-[180px]">
                        {po.supplier_nama}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-suka-ink">
                        {po.jumlah_item_terima || 0}/{po.jumlah_item || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-suka-brown tabular-nums whitespace-nowrap">
                        {rupiah(totalPesan)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                        {rupiah(totalTerima)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${
                          po.status === 'diterima_lengkap'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : po.status === 'sebagian_diterima'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : po.status === 'dikirim_ke_supplier'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : po.status === 'dibatalkan'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-stone-50 text-stone-700 border-stone-200'
                        }`}>
                          {po.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          {isPaid ? 'Lunas' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/pembelian/${po.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-suka-cream hover:bg-white border border-suka-brown/15 text-suka-brown font-bold text-[11px] transition-all shadow-2xs"
                        >
                          <span>Rincian</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
