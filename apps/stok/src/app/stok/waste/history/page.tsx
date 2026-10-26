'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWasteHistory } from '@/hooks/useWaste'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import {
  getAccessibleOutletsForWaste,
  type WasteHistoryFilter,
  type WasteSortField,
  type WasteSortOrder,
} from '@/app/actions/waste'
import { formatTriUnitSaldo } from '@/lib/format/compositeUnit'
import { WastePhotoModal } from '@/components/waste/WastePhotoModal'
import {
  RotateCcw,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  Inbox,
  Loader2,
  FileSpreadsheet,
  Coins,
  Package,
} from 'lucide-react'

function formatDateInput(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().split('T')[0]
}

function formatRp(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

const sortOptions: { value: `${WasteSortField}_${WasteSortOrder}`; label: string }[] = [
  { value: 'created_at_desc', label: 'Waktu: Terbaru' },
  { value: 'created_at_asc', label: 'Waktu: Terlama' },
  { value: 'nilai_waste_desc', label: 'Est. Kerugian: Terbesar' },
  { value: 'nilai_waste_asc', label: 'Est. Kerugian: Terkecil' },
  { value: 'harga_beli_desc', label: 'Harga Bahan: Termahal' },
  { value: 'harga_beli_asc', label: 'Harga Bahan: Termurah' },
  { value: 'qty_desc', label: 'Jumlah (Qty): Terbanyak' },
  { value: 'qty_asc', label: 'Jumlah (Qty): Tersedikit' },
  { value: 'bahan_baku_asc', label: 'Bahan Baku: A → Z' },
  { value: 'bahan_baku_desc', label: 'Bahan Baku: Z → A' },
  { value: 'outlet_asc', label: 'Outlet: A → Z' },
  { value: 'outlet_desc', label: 'Outlet: Z → A' },
  { value: 'status_asc', label: 'Status: A → Z' },
]

export default function WasteHistoryPage() {
  const defaultTo = useMemo(() => formatDateInput(new Date()), [])
  const defaultFrom = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return formatDateInput(d)
  }, [])

  // Filters state
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [status, setStatus] = useState<'ALL' | 'APPROVED' | 'REJECTED' | 'PENDING'>('ALL')
  const [selectedOutlet, setSelectedOutlet] = useState<string>('')
  const [selectedBahanId, setSelectedBahanId] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<WasteSortField>('created_at')
  const [sortOrder, setSortOrder] = useState<WasteSortOrder>('desc')
  const [page, setPage] = useState(1)

  // Master Bahan Baku
  const { bahanBaku } = useBahanBaku()

  // Photo modal state
  const [activePhoto, setActivePhoto] = useState<{
    url: string
    title: string
    subtitle: string
  } | null>(null)

  // Fetch accessible outlets for dropdown
  const { data: outlets = [] } = useQuery({
    queryKey: ['waste_accessible_outlets'],
    queryFn: () => getAccessibleOutletsForWaste(),
    staleTime: 60000,
  })

  // Filter params for query
  const queryFilters: WasteHistoryFilter = useMemo(
    () => ({
      from,
      to,
      status,
      outletId: selectedOutlet || undefined,
      bahanBakuId: selectedBahanId === 'ALL' ? undefined : selectedBahanId,
      sortBy,
      sortOrder,
      page,
      limit: 20,
    }),
    [from, to, status, selectedOutlet, selectedBahanId, sortBy, sortOrder, page]
  )

  const {
    reports,
    totalCount,
    activeCount,
    totalNilai,
    totalQty,
    selectedBahanHarga,
    totalPages,
    loading,
    fetching,
  } = useWasteHistory(queryFilters)

  const kpiIncidentCount = status === 'ALL' ? activeCount : totalCount

  // Quick Preset Handlers (inclusive: 30 Hari = hari ini s/d H-29, 7 Hari = hari ini s/d H-6)
  const handlePreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    if (days > 0) {
      start.setDate(start.getDate() - (days - 1))
    }
    setFrom(formatDateInput(start))
    setTo(formatDateInput(end))
    setPage(1)
  }

  const handleReset = () => {
    setFrom(defaultFrom)
    setTo(defaultTo)
    setStatus('ALL')
    setSelectedOutlet('')
    setSelectedBahanId('ALL')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }

  const handleSortChange = (combinedVal: string) => {
    if (combinedVal.startsWith('nilai_waste_')) {
      const ord = combinedVal.replace('nilai_waste_', '') as WasteSortOrder
      setSortBy('nilai_waste')
      setSortOrder(ord)
    } else if (combinedVal.startsWith('harga_beli_')) {
      const ord = combinedVal.replace('harga_beli_', '') as WasteSortOrder
      setSortBy('harga_beli')
      setSortOrder(ord)
    } else if (combinedVal.startsWith('created_at_')) {
      const ord = combinedVal.replace('created_at_', '') as WasteSortOrder
      setSortBy('created_at')
      setSortOrder(ord)
    } else if (combinedVal.startsWith('bahan_baku_')) {
      const ord = combinedVal.replace('bahan_baku_', '') as WasteSortOrder
      setSortBy('bahan_baku')
      setSortOrder(ord)
    } else if (combinedVal.startsWith('qty_')) {
      const ord = combinedVal.replace('qty_', '') as WasteSortOrder
      setSortBy('qty')
      setSortOrder(ord)
    } else if (combinedVal.startsWith('outlet_')) {
      const ord = combinedVal.replace('outlet_', '') as WasteSortOrder
      setSortBy('outlet')
      setSortOrder(ord)
    } else if (combinedVal.startsWith('status_')) {
      const ord = combinedVal.replace('status_', '') as WasteSortOrder
      setSortBy('status')
      setSortOrder(ord)
    }
    setPage(1)
  }

  const handleHeaderSort = (field: WasteSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(
        field === 'created_at' || field === 'qty' || field === 'nilai_waste' || field === 'harga_beli'
          ? 'desc'
          : 'asc'
      )
    }
    setPage(1)
  }

  const renderSortIndicator = (field: WasteSortField) => {
    if (sortBy !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-[#544437]/30 group-hover:text-[#544437]/80 transition-colors shrink-0 ml-1" />
      )
    }
    if (sortOrder === 'asc') {
      return <ChevronUp className="w-3.5 h-3.5 text-suka-orange shrink-0 ml-1" />
    }
    return <ChevronDown className="w-3.5 h-3.5 text-suka-orange shrink-0 ml-1" />
  }

  const statusPills: { id: 'ALL' | 'APPROVED' | 'REJECTED' | 'PENDING'; label: string; icon: any; color: string }[] = [
    { id: 'ALL', label: 'Semua Status', icon: FileSpreadsheet, color: 'text-suka-brown' },
    { id: 'APPROVED', label: 'Disetujui', icon: CheckCircle2, color: 'text-green-600' },
    { id: 'REJECTED', label: 'Ditolak', icon: XCircle, color: 'text-red-600' },
    { id: 'PENDING', label: 'Menunggu', icon: Clock, color: 'text-amber-600' },
  ]

  const isCustomSort = sortBy !== 'created_at' || sortOrder !== 'desc'
  const isCustomBahan = selectedBahanId !== 'ALL'
  const selectedBahan = useMemo(
    () => bahanBaku.find((b) => b.id === selectedBahanId),
    [bahanBaku, selectedBahanId]
  )
  const effectiveHargaBeli =
    selectedBahanHarga ??
    reports.find((r) => r.bahan_baku_id === selectedBahanId)?.harga_beli ??
    0

  const formatQtyDisplay = (qty: number) => {
    if (!selectedBahan) return `${Math.round(qty * 100) / 100}`
    return formatTriUnitSaldo(
      qty,
      selectedBahan.satuan || '',
      selectedBahan.satuan_tengah,
      selectedBahan.faktor_tengah,
      selectedBahan.satuan_kecil,
      selectedBahan.faktor_tampilan,
      true
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Section Card */}
      <div className="bg-white border border-[#d9c2b2]/60 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#d9c2b2]/20">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#701604] flex items-center gap-2">
              <span>🔍</span> Filter Riwayat Waste
            </h2>
            <p className="text-xs text-[#544437]/70 font-semibold mt-0.5">
              Tentukan periode tanggal, status persetujuan, outlet, bahan baku, dan urutan data
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#d9c2b2]/60 bg-[#faf2e9]/50 text-xs font-bold text-[#544437] hover:bg-[#faf2e9] active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Date Inputs, Outlet, Bahan Baku & Sort Dropdown */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${outlets.length > 1 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-2 xl:grid-cols-4'} gap-3.5`}>
          <div>
            <label className="text-[10px] font-bold text-[#544437] uppercase tracking-wider block mb-1">
              Dari Tanggal
            </label>
            <div className="relative">
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#faf2e9]/40 border border-[#d9c2b2]/60 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:ring-2 focus:ring-suka-orange focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#544437] uppercase tracking-wider block mb-1">
              Sampai Tanggal
            </label>
            <div className="relative">
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#faf2e9]/40 border border-[#d9c2b2]/60 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:ring-2 focus:ring-suka-orange focus:outline-none"
              />
            </div>
          </div>

          {outlets.length > 1 && (
            <div>
              <label className="text-[10px] font-bold text-[#544437] uppercase tracking-wider block mb-1">
                Pilih Outlet
              </label>
              <div className="relative">
                <select
                  value={selectedOutlet}
                  onChange={(e) => {
                    setSelectedOutlet(e.target.value)
                    setPage(1)
                  }}
                  className="w-full bg-[#faf2e9]/40 border border-[#d9c2b2]/60 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:ring-2 focus:ring-suka-orange focus:outline-none"
                >
                  <option value="">Semua Outlet Akses</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name.replace('SUKA SHAWARMA ', '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-[#544437] uppercase tracking-wider block mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3 text-suka-orange" />
                Pilih Bahan Baku
              </span>
              {isCustomBahan && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBahanId('ALL')
                    setPage(1)
                  }}
                  className="text-[9px] lowercase font-bold text-suka-orange hover:underline cursor-pointer"
                >
                  semua
                </button>
              )}
            </label>
            <div className="relative">
              <select
                value={selectedBahanId}
                onChange={(e) => {
                  setSelectedBahanId(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#faf2e9]/40 border border-[#d9c2b2]/60 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:ring-2 focus:ring-suka-orange focus:outline-none"
              >
                <option value="ALL">Semua Bahan Baku</option>
                {bahanBaku.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#544437] uppercase tracking-wider block mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-suka-orange" />
                Urutkan Data
              </span>
              {isCustomSort && (
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('created_at')
                    setSortOrder('desc')
                    setPage(1)
                  }}
                  className="text-[9px] lowercase font-bold text-suka-orange hover:underline cursor-pointer"
                >
                  reset
                </button>
              )}
            </label>
            <div className="relative">
              <select
                value={`${sortBy}_${sortOrder}`}
                onChange={(e) => handleSortChange(e.target.value)}
                className="w-full bg-[#faf2e9]/40 border border-[#d9c2b2]/60 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:ring-2 focus:ring-suka-orange focus:outline-none"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Date Presets & Status Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Quick Dates */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-[#544437]/50 tracking-wider mr-1">
              Preset:
            </span>
            <button
              type="button"
              onClick={() => handlePreset(0)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#d9c2b2]/40 bg-white hover:bg-[#faf2e9] text-[#544437] transition-colors cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => handlePreset(7)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#d9c2b2]/40 bg-white hover:bg-[#faf2e9] text-[#544437] transition-colors cursor-pointer"
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => handlePreset(30)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#d9c2b2]/40 bg-white hover:bg-[#faf2e9] text-[#544437] transition-colors cursor-pointer"
            >
              30 Hari
            </button>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusPills.map((pill) => {
              const active = status === pill.id
              const Icon = pill.icon
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setStatus(pill.id)
                    setPage(1)
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    active
                      ? 'bg-[#701604] text-white shadow-2xs'
                      : 'bg-white border border-[#d9c2b2]/50 text-[#544437]/80 hover:bg-[#faf2e9]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : pill.color}`} />
                  <span>{pill.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="bg-white border border-[#d9c2b2]/60 rounded-3xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-[#ba1a1a] shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#544437]/70 uppercase tracking-wider block">
                Total Estimasi Kerugian
              </span>
              {isCustomBahan && selectedBahan && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-800 rounded-md truncate max-w-[140px]">
                  {selectedBahan.nama}
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#ba1a1a] mt-0.5 truncate">
              {formatRp(totalNilai)}
            </div>
            <p className="text-[11px] text-[#544437]/70 font-medium truncate mt-0.5">
              {status === 'REJECTED' ? (
                <span className="text-red-600 font-semibold">
                  Laporan ditolak tidak dihitung dalam estimasi kerugian
                </span>
              ) : isCustomBahan ? (
                <>
                  Harga Master: <span className="font-bold text-[#701604]">{formatRp(effectiveHargaBeli)}</span> / {selectedBahan?.satuan || 'satuan'}
                  <span className="text-[#544437]/50 font-normal"> · Ditolak tidak dihitung</span>
                </>
              ) : (
                'Akumulasi nilai riil (laporan ditolak tidak dihitung)'
              )}
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#d9c2b2]/60 rounded-3xl p-5 shadow-xs flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isCustomBahan
                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                : 'bg-[#faf2e9] border border-[#d9c2b2]/50 text-[#701604]'
            }`}
          >
            {isCustomBahan ? <Package className="w-6 h-6" /> : <FileSpreadsheet className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#544437]/70 uppercase tracking-wider block">
                {isCustomBahan ? 'Total Volume Terbuang' : 'Total Laporan Waste'}
              </span>
              {isCustomBahan && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md">
                  {kpiIncidentCount} Insiden
                </span>
              )}
            </div>
            <div
              className="text-xl sm:text-2xl font-black text-[#701604] mt-0.5 truncate"
              title={
                isCustomBahan && selectedBahan
                  ? `${totalQty.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${selectedBahan.satuan}`
                  : undefined
              }
            >
              {isCustomBahan ? (
                formatQtyDisplay(totalQty)
              ) : (
                <>
                  {kpiIncidentCount} <span className="text-sm font-bold text-[#544437]/70">Insiden</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-[#544437]/70 font-medium truncate mt-0.5">
              {status === 'REJECTED' ? (
                <span className="text-red-600 font-semibold">
                  Laporan ditolak tidak dihitung dalam volume terbuang
                </span>
              ) : isCustomBahan ? (
                <>
                  Akumulasi riil ({totalQty.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {selectedBahan?.satuan})
                  <span className="text-[#544437]/50 font-normal"> · dari {kpiIncidentCount} laporan valid</span>
                </>
              ) : status === 'ALL' && totalCount > activeCount ? (
                `Insiden valid (${totalCount - activeCount} ditolak dari ${totalCount} total laporan)`
              ) : (
                'Sesuai filter status & tanggal yang dipilih'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-[#544437] uppercase tracking-wider">
              Daftar Insiden Waste
            </h3>
            {fetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-suka-orange" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isCustomBahan && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-suka-orange border border-orange-200">
                <span>Bahan: {bahanBaku.find((b) => b.id === selectedBahanId)?.nama || selectedBahanId}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBahanId('ALL')
                    setPage(1)
                  }}
                  className="hover:text-red-700 ml-0.5 cursor-pointer font-bold"
                  title="Hapus filter bahan"
                >
                  ✕
                </button>
              </span>
            )}
            {isCustomSort && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                <ArrowUpDown className="w-2.5 h-2.5 text-amber-700" />
                Urut: {sortOptions.find((o) => o.value === `${sortBy}_${sortOrder}`)?.label}
              </span>
            )}
            <span className="text-xs font-bold text-[#544437]/60">
              Ditemukan {totalCount} laporan
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#d9c2b2]/40 rounded-3xl text-center">
            <Loader2 className="w-8 h-8 animate-spin text-suka-orange mb-2" />
            <p className="text-xs font-bold text-suka-brown/60 uppercase tracking-wider">
              Memuat Riwayat Waste...
            </p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#d9c2b2]/40 rounded-3xl text-center p-6 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#faf2e9] border border-[#d9c2b2]/40 flex items-center justify-center mb-3">
              <Inbox className="w-7 h-7 text-[#544437]/40" />
            </div>
            <h4 className="text-base font-extrabold text-[#544437]">Tidak Ada Laporan Waste</h4>
            <p className="text-xs text-[#544437]/60 mt-1 max-w-sm">
              Tidak ditemukan data waste yang cocok dengan filter tanggal, outlet, bahan baku, atau status yang dipilih.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-suka-orange text-white rounded-xl text-xs font-bold shadow-xs hover:bg-orange-600 transition-colors cursor-pointer"
            >
              Reset Semua Filter
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Structured Table (>= md) */}
            <div className="hidden md:block bg-white border border-[#d9c2b2]/60 rounded-3xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf2e9]/70 border-b border-[#d9c2b2]/40 text-[#544437] font-black uppercase text-[10px] tracking-wider">
                    <tr>
                      <th
                        className="py-3.5 px-4 cursor-pointer select-none group hover:bg-[#faf2e9]"
                        onClick={() => handleHeaderSort('created_at')}
                        title="Klik untuk mengurutkan berdasarkan waktu"
                      >
                        <div className="flex items-center gap-1">
                          <span>Waktu</span>
                          {renderSortIndicator('created_at')}
                        </div>
                      </th>
                      <th
                        className="py-3.5 px-4 cursor-pointer select-none group hover:bg-[#faf2e9]"
                        onClick={() => handleHeaderSort('outlet')}
                        title="Klik untuk mengurutkan berdasarkan nama outlet"
                      >
                        <div className="flex items-center gap-1">
                          <span>Outlet</span>
                          {renderSortIndicator('outlet')}
                        </div>
                      </th>
                      <th
                        className="py-3.5 px-4 cursor-pointer select-none group hover:bg-[#faf2e9]"
                        onClick={() => handleHeaderSort('bahan_baku')}
                        title="Klik untuk mengurutkan berdasarkan bahan baku"
                      >
                        <div className="flex items-center gap-1">
                          <span>Bahan Baku</span>
                          {renderSortIndicator('bahan_baku')}
                        </div>
                      </th>
                      <th
                        className="py-3.5 px-4 text-right cursor-pointer select-none group hover:bg-[#faf2e9]"
                        onClick={() => handleHeaderSort('harga_beli')}
                        title="Klik untuk mengurutkan berdasarkan harga bahan baku"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Harga Bahan</span>
                          {renderSortIndicator('harga_beli')}
                        </div>
                      </th>
                      <th
                        className="py-3.5 px-4 text-right cursor-pointer select-none group hover:bg-[#faf2e9]"
                        onClick={() => handleHeaderSort('qty')}
                        title="Klik untuk mengurutkan berdasarkan jumlah"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Jumlah</span>
                          {renderSortIndicator('qty')}
                        </div>
                      </th>
                      <th
                        className="py-3.5 px-4 text-right cursor-pointer select-none group hover:bg-[#faf2e9]"
                        onClick={() => handleHeaderSort('nilai_waste')}
                        title="Klik untuk mengurutkan berdasarkan estimasi nilai kerugian"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Est. Nilai Kerugian</span>
                          {renderSortIndicator('nilai_waste')}
                        </div>
                      </th>
                      <th className="py-3.5 px-4">Alasan</th>
                      <th
                        className="py-3.5 px-4 cursor-pointer select-none group hover:bg-[#faf2e9]"
                        onClick={() => handleHeaderSort('status')}
                        title="Klik untuk mengurutkan berdasarkan status"
                      >
                        <div className="flex items-center gap-1">
                          <span>Status</span>
                          {renderSortIndicator('status')}
                        </div>
                      </th>
                      <th className="py-3.5 px-4">Pelapor / Penyetuju</th>
                      <th className="py-3.5 px-4 text-center">Bukti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d9c2b2]/20 font-medium text-suka-brown">
                    {reports.map((r) => {
                      const createdDate = r.created_at ? new Date(r.created_at) : null
                      const formattedDate = createdDate
                        ? createdDate.toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'

                      return (
                        <tr key={r.id} className="hover:bg-[#faf2e9]/30 transition-colors">
                          <td className="py-3.5 px-4 text-suka-brown/70 font-semibold whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#701604] whitespace-nowrap">
                            {r.outlets?.name?.replace('SUKA SHAWARMA ', '') || '-'}
                          </td>
                          <td className="py-3.5 px-4 font-black text-suka-brown">
                            {r.bahan_baku?.nama || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-[#544437] whitespace-nowrap">
                            <div>{formatRp(r.harga_beli || 0)}</div>
                            <span className="text-[10px] text-[#544437]/50 font-semibold block">
                              / {r.bahan_baku?.satuan || 'satuan'}
                            </span>
                          </td>
                          <td className={`py-3.5 px-4 text-right font-black whitespace-pre-line ${r.status === 'REJECTED' ? 'text-stone-400 line-through' : 'text-[#ba1a1a]'}`}>
                            {formatTriUnitSaldo(
                              r.qty,
                              r.bahan_baku?.satuan || '',
                              r.bahan_baku?.satuan_tengah,
                              r.bahan_baku?.faktor_tengah,
                              r.bahan_baku?.satuan_kecil,
                              r.bahan_baku?.faktor_tampilan,
                              true
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                            {r.status === 'REJECTED' ? (
                              <div className="flex flex-col items-end">
                                <span className="line-through text-stone-400 font-bold text-xs">
                                  {formatRp(r.nilai_waste || 0)}
                                </span>
                                <span className="text-[9px] font-bold text-red-500 uppercase tracking-tight">
                                  Ditolak (Tidak Dihitung)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#ba1a1a]">{formatRp(r.nilai_waste || 0)}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 italic text-suka-brown/80 max-w-[320px] truncate" title={r.reason}>
                            "{r.reason}"
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {r.status === 'APPROVED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-green-50 text-green-700 border border-green-200">
                                <CheckCircle2 className="w-3 h-3" /> Disetujui
                              </span>
                            )}
                            {r.status === 'REJECTED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="w-3 h-3" /> Ditolak
                              </span>
                            )}
                            {r.status === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" /> Menunggu
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] leading-tight max-w-[280px]">
                            <div className="font-bold text-suka-brown truncate">
                              Oleh: {r.reported_by_staff?.name || '-'}
                            </div>
                            {r.status === 'APPROVED' && r.approved_by_staff && (
                              <div className="text-green-700 text-[10px] font-semibold mt-0.5 truncate">
                                Disetujui: {r.approved_by_staff.name}
                              </div>
                            )}
                            {r.status === 'REJECTED' && (
                              <div className="text-red-600 text-[10px] font-semibold mt-0.5">
                                {r.approved_by_staff?.name ? `Ditolak oleh ${r.approved_by_staff.name}: ` : 'Alasan: '}
                                <span className="italic">"{r.rejection_reason || 'Tidak ada alasan'}"</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {r.photo_url ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setActivePhoto({
                                    url: r.photo_url!,
                                    title: r.bahan_baku?.nama || 'Foto Bukti',
                                    subtitle: `${r.outlets?.name || ''} · ${formattedDate}`,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] hover:bg-[#e0f2fe] text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                <Camera className="w-3 h-3" />
                                <span>Foto</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#544437]/40 font-medium italic">
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List (< md) */}
            <div className="md:hidden space-y-3">
              {reports.map((r) => {
                const createdDate = r.created_at ? new Date(r.created_at) : null
                const formattedDate = createdDate
                  ? createdDate.toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'

                return (
                  <div
                    key={r.id}
                    className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-4 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-black bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Disetujui
                            </span>
                          )}
                          {r.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-black bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="w-2.5 h-2.5" /> Ditolak
                            </span>
                          )}
                          {r.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-2.5 h-2.5" /> Menunggu
                            </span>
                          )}
                          <span className="text-[10px] text-[#544437]/60 font-semibold">
                            {formattedDate}
                          </span>
                        </div>
                        <h4 className="font-black text-[#701604] text-sm mt-1">
                          {r.bahan_baku?.nama}
                        </h4>
                        <p className="text-[11px] font-bold text-[#544437]/70 uppercase">
                          🏪 {r.outlets?.name?.replace('SUKA SHAWARMA ', '') || '-'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-black text-sm whitespace-pre-line ${r.status === 'REJECTED' ? 'text-stone-400 line-through' : 'text-[#ba1a1a]'}`}>
                          {formatTriUnitSaldo(
                            r.qty,
                            r.bahan_baku?.satuan || '',
                            r.bahan_baku?.satuan_tengah,
                            r.bahan_baku?.faktor_tengah,
                            r.bahan_baku?.satuan_kecil,
                            r.bahan_baku?.faktor_tampilan,
                            true
                          )}
                        </p>
                        <p className="text-[10px] font-bold text-[#544437]/70 mt-0.5">
                          @ {formatRp(r.harga_beli || 0)} / {r.bahan_baku?.satuan || 'satuan'}
                        </p>
                        {r.status === 'REJECTED' ? (
                          <div className="mt-0.5">
                            <span className="line-through text-stone-400 font-bold text-xs block">
                              {formatRp(r.nilai_waste || 0)}
                            </span>
                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-tight block">
                              Ditolak (Tidak Dihitung)
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs font-black text-[#ba1a1a] mt-0.5">
                            {formatRp(r.nilai_waste || 0)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="bg-[#faf2e9]/40 p-2.5 rounded-xl border border-[#d9c2b2]/30 text-xs">
                      <span className="text-[9px] font-bold text-[#544437]/60 uppercase block">
                        Alasan:
                      </span>
                      <p className="font-medium text-[#1e1b15] italic mt-0.5">
                        "{r.reason}"
                      </p>
                    </div>

                    {/* Rejection Note if Rejected */}
                    {r.status === 'REJECTED' && r.rejection_reason && (
                      <div className="bg-red-50 p-2.5 rounded-xl border border-red-200 text-xs">
                        <span className="text-[9px] font-bold text-red-700 uppercase block">
                          Catatan Penolakan:
                        </span>
                        <p className="font-semibold text-red-600 italic mt-0.5">
                          "{r.rejection_reason}"
                        </p>
                      </div>
                    )}

                    {/* Reporter & Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#d9c2b2]/20 text-[11px]">
                      <span className="text-[#544437]/70 font-semibold truncate max-w-[180px]">
                        Pelapor: <strong className="text-suka-brown">{r.reported_by_staff?.name || '-'}</strong>
                      </span>

                      {r.photo_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setActivePhoto({
                              url: r.photo_url!,
                              title: r.bahan_baku?.nama || 'Foto Bukti',
                              subtitle: `${r.outlets?.name || ''} · ${formattedDate}`,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] font-bold text-xs cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Foto</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white border border-[#d9c2b2]/60 rounded-2xl p-3 px-4 shadow-2xs">
                <span className="text-xs font-bold text-[#544437]/70">
                  Halaman <strong className="text-suka-brown">{page}</strong> dari{' '}
                  <strong className="text-suka-brown">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#d9c2b2]/60 bg-white text-xs font-bold text-[#544437] hover:bg-[#faf2e9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#d9c2b2]/60 bg-white text-xs font-bold text-[#544437] hover:bg-[#faf2e9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo Preview Modal */}
      {activePhoto && (
        <WastePhotoModal
          photoUrl={activePhoto.url}
          title={activePhoto.title}
          subtitle={activePhoto.subtitle}
          onClose={() => setActivePhoto(null)}
        />
      )}
    </div>
  )
}
