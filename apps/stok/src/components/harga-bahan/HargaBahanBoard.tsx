'use client'

import React, { useState, useMemo } from 'react'
import { ArrowLeft, AlertCircle, Plus } from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { useFluktuasiHarga, type FluktuasiHargaItem } from '@/hooks/useFluktuasiHarga'
import { useBahanBakuMutations } from '@/hooks/useBahanBakuMutations'
import { HargaBahanSummaryCards } from './HargaBahanSummaryCards'
import { HargaBahanFilterBar } from './HargaBahanFilterBar'
import { HargaBahanTable } from './HargaBahanTable'
import { HargaBahanDetailModal } from './HargaBahanDetailModal'
import { HargaBahanAddModal } from './HargaBahanAddModal'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { useAuth } from '@suka/auth'

interface HargaBahanBoardProps {
  showBackButton?: boolean
  backUrl?: string
}

export function HargaBahanBoard({
  showBackButton = true,
  backUrl = '/dashboard'
}: HargaBahanBoardProps) {
  // State Filters
  const [daysFilter, setDaysFilter] = useState<number | null>(30)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'naik' | 'turun' | 'stabil'>('all')

  // State Detail Modal
  const [detailItem, setDetailItem] = useState<FluktuasiHargaItem | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const { outletStaff } = useAuth()
  const role = outletStaff?.role || ''
  const canAddBahanBaku = role === 'admin' || role === 'kitchen' || role === 'developer' || role === 'owner'

  // Query Hook
  const {
    items = [],
    isLoading,
    isRefetching,
    refetch,
    error
  } = useFluktuasiHarga(daysFilter)

  const { addBahanBaku } = useBahanBakuMutations()

  // Extract unique category names
  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => {
      if (it.kategori_nama) set.add(it.kategori_nama)
    })
    return Array.from(set).sort()
  }, [items])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // 1. Text Search (nama, sku, vendor)
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = it.nama.toLowerCase().includes(q)
        const matchSku = it.kode.toLowerCase().includes(q)
        const matchVendor = (it.supplier_terakhir || '').toLowerCase().includes(q)
        const matchNoPo = (it.nomor_po_terakhir || '').toLowerCase().includes(q)
        if (!matchName && !matchSku && !matchVendor && !matchNoPo) return false
      }

      // 2. Kategori filter
      if (selectedCategory !== 'all' && it.kategori_nama !== selectedCategory) {
        return false
      }

      // 3. Status filter
      if (statusFilter === 'naik') {
        const isUp = it.selisih_pct_prev !== null && it.selisih_pct_prev > 0
        if (!isUp) return false
      } else if (statusFilter === 'turun') {
        const isDown = it.selisih_pct_prev !== null && it.selisih_pct_prev < 0
        if (!isDown) return false
      } else if (statusFilter === 'stabil') {
        const isUp = it.selisih_pct_prev !== null && it.selisih_pct_prev > 0
        const isDown = it.selisih_pct_prev !== null && it.selisih_pct_prev < 0
        if (it.harga_terakhir === null || isUp || isDown) return false
      }

      return true
    })
  }, [items, search, selectedCategory, statusFilter])

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredItems.length === 0) return

    const headers = [
      'Kode SKU',
      'Nama Bahan Baku',
      'Kategori',
      'Satuan',
      'Vendor Terakhir',
      'No PO Terakhir',
      'Tgl PO Terakhir',
      'Harga Beli Terakhir (Rp)',
      'Harga Pembelian Sebelumnya (Rp)',
      'Selisih Nominal vs Prev (Rp)',
      'Selisih % vs Prev'
    ]

    const rows = filteredItems.map((it) => [
      `"${it.kode || ''}"`,
      `"${it.nama.replace(/"/g, '""')}"`,
      `"${it.kategori_nama || ''}"`,
      `"${it.satuan || ''}"`,
      `"${(it.supplier_terakhir || '').replace(/"/g, '""')}"`,
      `"${it.nomor_po_terakhir || ''}"`,
      `"${it.tgl_po_terakhir || ''}"`,
      it.harga_terakhir ?? '',
      it.harga_sebelumnya ?? '',
      it.selisih_nominal_prev ?? '',
      it.selisih_pct_prev ? `${(it.selisih_pct_prev * 100).toFixed(2)}%` : ''
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `laporan_harga_bahan_baku_${new Date().toISOString().split('T')[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Link
              href={backUrl}
              className="p-2.5 rounded-2xl bg-white border border-suka-brown/10 text-suka-brown hover:bg-suka-cream transition-all shadow-xs"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black text-suka-brown font-display flex items-center gap-2">
              <span>Master Harga Bahan Baku</span>
            </h1>
            <p className="text-xs text-suka-brown/70 mt-0.5">
              Kelola master data dan pantau pergerakan harga beli bahan baku dari vendor.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAddBahanBaku && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white rounded-xl font-bold shadow-sm transition-colors text-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Tambah Bahan Baku</span>
            </button>
          )}
          <UserAvatarDropdown />
        </div>
      </div>

      <HargaBahanAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        isSaving={addBahanBaku.isPending}
        onAdd={(vars) => {
          addBahanBaku.mutate(vars, {
            onSuccess: () => {
              toast.success('Bahan baku berhasil ditambahkan')
              setIsAddModalOpen(false)
            },
            onError: (e: any) => {
              toast.error(e.message)
            }
          })
        }}
      />

      {/* KPI Metric Summary Cards */}
      <HargaBahanSummaryCards
        items={items}
        activeStatusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Filter Bar */}
      <HargaBahanFilterBar
        search={search}
        onSearchChange={setSearch}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        daysFilter={daysFilter}
        onDaysFilterChange={setDaysFilter}
        onExportCsv={handleExportCsv}
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Gagal memuat data harga: {(error as Error).message}</span>
        </div>
      )}

      {/* Main Table or Loading */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-suka-brown/10 p-16 flex flex-col items-center justify-center text-suka-brown/60 space-y-3">
          <Spinner className="w-8 h-8 text-suka-orange" />
          <span className="text-xs font-bold">Memuat analisis fluktuasi harga bahan baku...</span>
        </div>
      ) : (
        <HargaBahanTable
          items={filteredItems}
          onOpenDetail={(item) => setDetailItem(item)}
        />
      )}

      {/* Drilldown Detail Modal */}
      <HargaBahanDetailModal
        item={detailItem}
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
      />
    </div>
  )
}
