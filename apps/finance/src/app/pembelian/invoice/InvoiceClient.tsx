// @ts-nocheck
'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { 
  Receipt, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  Search, 
  Calendar, 
  ExternalLink, 
  Upload, 
  ChevronRight, 
  ShieldCheck, 
  Clock, 
  DollarSign 
} from 'lucide-react'
import { usePurchaseOrders, useUploadInvoice, getSignedInvoiceUrl, type POSummary } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui'
import { Spinner } from '@suka/design-system'
import CountUp from 'react-countup'

export function InvoiceClient({ 
  initialData, 
  defaultFrom, 
  defaultTo 
}: { 
  initialData: POSummary[]
  defaultFrom: string
  defaultTo: string 
}) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'unuploaded' | 'discrepancy' | 'paid'>('all')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [activeUploadPoId, setActiveUploadPoId] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadInvoice = useUploadInvoice()

  const { data: pos = initialData, isLoading } = usePurchaseOrders({
    from: fromDate,
    to: toDate,
  }, initialData)

  // Only consider POs that have progressed past draft / approval
  const relevantPos = useMemo(() => {
    return pos.filter(p => p.status !== 'draft' && p.status !== 'menunggu_approval_finance' && p.status !== 'dibatalkan')
  }, [pos])

  const totalNilaiTagihan = useMemo(() => {
    return relevantPos.reduce((sum, p) => sum + (p.total_nilai_terima || p.total_nilai || 0), 0)
  }, [relevantPos])

  const unuploadedCount = relevantPos.filter(p => !p.jumlah_invoice || p.jumlah_invoice === 0).length
  const discrepancyCount = relevantPos.filter(p => p.has_discrepancy).length
  const paidCount = relevantPos.filter(p => p.payment_status === 'paid' || p.paid_at).length

  const filtered = useMemo(() => {
    return relevantPos.filter(p => {
      // Tab filter
      if (activeTab === 'unuploaded' && (p.jumlah_invoice && p.jumlah_invoice > 0)) return false
      if (activeTab === 'discrepancy' && !p.has_discrepancy) return false
      if (activeTab === 'paid' && !(p.payment_status === 'paid' || p.paid_at)) return false

      // Search filter
      if (search) {
        const q = search.toLowerCase()
        return p.nomor_po.toLowerCase().includes(q) || p.supplier_nama.toLowerCase().includes(q)
      }
      return true
    })
  }, [relevantPos, activeTab, search])

  const handleUploadClick = (poId: string) => {
    setActiveUploadPoId(poId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeUploadPoId) return
    await uploadInvoice.mutateAsync({ poId: activeUploadPoId, file })
    e.target.value = ''
    setActiveUploadPoId(null)
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* Hidden File Input */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*,application/pdf" 
        className="hidden" 
        onChange={handleFileChange} 
      />

      {/* Header */}
      <PageHeader 
        title="Invoice & 3-Way Matching" 
        description="Audit dan pencocokan 3 arah: Dokumen PO Resmi ↔ Verifikasi Penerimaan Gudang ↔ Nota/Invoice Tagihan Supplier."
      />

      {/* Strategic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Nilai Tagihan"
          value={<><span className="text-sm align-top">Rp </span><CountUp end={totalNilaiTagihan} duration={1} separator="." /></>}
          hint="Realisasi & Komitmen Berjalan"
          icon={<Receipt className="w-5 h-5" />}
          tone="default"
        />
        <StatCard
          label="Invoice Belum Diunggah"
          value={<CountUp end={unuploadedCount} duration={1} />}
          hint="Perlu Lampiran Foto Fisik"
          icon={<Camera className="w-5 h-5" />}
          tone={unuploadedCount > 0 ? 'orange' : 'default'}
        />
        <StatCard
          label="Selisih / Discrepancy"
          value={<CountUp end={discrepancyCount} duration={1} />}
          hint="Harga / Qty Berbeda"
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={discrepancyCount > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Sudah Lunas (Paid)"
          value={<CountUp end={paidCount} duration={1} />}
          hint="Tagihan Selesai Dibayar"
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="green"
        />
      </div>

      {/* Controls & Filter Strip */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs Filter */}
          <div className="flex items-center bg-suka-cream/60 p-1 rounded-2xl border border-suka-brown/10 shadow-2xs overflow-x-auto">
            {[
              { key: 'all', label: 'Semua Invoice', count: relevantPos.length },
              { key: 'unuploaded', label: 'Belum Upload', count: unuploadedCount },
              { key: 'discrepancy', label: 'Ada Selisih', count: discrepancyCount },
              { key: 'paid', label: 'Sudah Lunas', count: paidCount },
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
                placeholder="Cari nomor PO atau supplier..."
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

      {/* Main 3-Way Match Matrix List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/60 rounded-3xl border border-suka-brown/5">
          <Spinner className="w-8 h-8 text-suka-orange mb-3" />
          <p className="text-suka-brown/60 font-semibold text-xs">Memuat dokumen invoice &amp; 3-way matching…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 p-12 text-center shadow-sm">
          <Receipt className="w-12 h-12 mx-auto text-suka-brown/30 mb-3" />
          <h3 className="font-bold text-suka-brown text-base">Tidak Ada Dokumen Invoice</h3>
          <p className="text-xs text-suka-brown/60 mt-1 max-w-md mx-auto">
            {search ? 'Tidak ada data invoice yang sesuai dengan filter pencarian.' : 'Belum ada transaksi pengadaan pada rentang tanggal ini.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => {
            const hasInvoice = po.jumlah_invoice && po.jumlah_invoice > 0
            const isArrived = !!po.diverifikasi_at || po.status === 'diterima_lengkap' || po.status === 'sebagian_diterima'
            const isPaid = po.payment_status === 'paid' || !!po.paid_at
            const totalPesan = po.total_nilai || 0
            const totalTerima = po.total_nilai_terima || totalPesan
            const selisih = totalTerima - totalPesan

            return (
              <div 
                key={po.id}
                className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md hover:border-suka-orange/30 transition-all p-5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5"
              >
                {/* 1. Header Information */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link 
                      href={`/pembelian/${po.id}`}
                      className="font-mono text-sm font-bold text-suka-brown hover:text-suka-orange transition-colors"
                    >
                      {po.nomor_po}
                    </Link>
                    <span className="text-xs font-bold text-suka-brown">· {po.supplier_nama}</span>
                    {po.has_discrepancy && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Discrepancy
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-suka-brown/60 font-medium mt-1">
                    Tanggal PO: {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {po.jatuh_tempo && <span className="ml-2">• Jatuh Tempo: {new Date(po.jatuh_tempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                </div>

                {/* 2. Visual 3-Way Match Verification Flow */}
                <div className="grid grid-cols-3 gap-2 w-full xl:w-auto xl:min-w-[420px] bg-suka-cream/30 p-2.5 rounded-2xl border border-suka-brown/10">
                  {/* Step 1: PO Approved */}
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/80 border border-suka-brown/5">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-bold text-suka-brown uppercase tracking-wider">1. Dokumen PO</span>
                    <span className="text-[10px] font-semibold text-suka-brown/70 tabular-nums mt-0.5">{rupiah(totalPesan)}</span>
                  </div>

                  {/* Step 2: Physical Receipt */}
                  <div className={`flex flex-col items-center text-center p-2 rounded-xl border ${
                    isArrived ? 'bg-white/80 border-suka-brown/5' : 'bg-stone-50 border-stone-200 opacity-60'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                      isArrived ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'
                    }`}>
                      {isArrived ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-bold text-suka-brown uppercase tracking-wider">2. Fisik Barang</span>
                    <span className="text-[10px] font-semibold text-suka-brown/70 mt-0.5">
                      {isArrived ? `${po.jumlah_item_terima || 0}/${po.jumlah_item || 0} Item` : 'Belum Tiba'}
                    </span>
                  </div>

                  {/* Step 3: Invoice Attached */}
                  <div className={`flex flex-col items-center text-center p-2 rounded-xl border ${
                    hasInvoice ? 'bg-white/80 border-suka-brown/5' : 'bg-amber-50/80 border-amber-200'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                      hasInvoice ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {hasInvoice ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-bold text-suka-brown uppercase tracking-wider">3. Foto Invoice</span>
                    <span className="text-[10px] font-bold text-suka-brown mt-0.5">
                      {hasInvoice ? `${po.jumlah_invoice} Lampiran` : 'Belum Upload'}
                    </span>
                  </div>
                </div>

                {/* 3. Action Buttons & Status */}
                <div className="flex items-center gap-2 w-full xl:w-auto justify-between xl:justify-end shrink-0 border-t xl:border-t-0 pt-3 xl:pt-0 border-suka-brown/5">
                  <div className="text-left xl:text-right">
                    <span className="block text-[10px] text-suka-brown/50 font-bold uppercase tracking-wider">Status Bayar</span>
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}>
                      {isPaid ? 'Sudah Lunas' : 'Belum Dibayar'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!hasInvoice && (
                      <button
                        onClick={() => handleUploadClick(po.id)}
                        disabled={uploadInvoice.isPending}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-suka-orange/10 hover:bg-suka-orange/20 text-suka-orange border border-suka-orange/30 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Upload Foto</span>
                      </button>
                    )}

                    <Link
                      href={`/pembelian/${po.id}`}
                      className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-suka-cream hover:bg-white border border-suka-brown/15 text-suka-brown font-bold text-xs transition-all shadow-2xs"
                    >
                      <span>Detail Audit</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
