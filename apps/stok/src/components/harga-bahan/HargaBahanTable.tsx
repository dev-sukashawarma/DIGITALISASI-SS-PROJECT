import React, { useState, useMemo } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Eye, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown,
  Building2,
  PackageCheck,
  FolderOpen,
  FolderClosed,
  Layers
} from 'lucide-react'
import type { FluktuasiHargaItem } from '@/hooks/useFluktuasiHarga'

export function formatRupiah(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val)
}

export type SortField = 'nama' | 'harga_terakhir' | 'selisih_pct_prev' | 'tgl_po_terakhir'
export type SortOrder = 'asc' | 'desc'

interface HargaBahanTableProps {
  items: FluktuasiHargaItem[]
  onOpenDetail: (item: FluktuasiHargaItem) => void
}

export function HargaBahanTable({
  items,
  onOpenDetail
}: HargaBahanTableProps) {
  const [sortField, setSortField] = useState<SortField>('selisih_pct_prev')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isGroupedView, setIsGroupedView] = useState(true)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  const collapseAll = () => {
    const all = new Set(groupedCategories.map((g) => g.kategori))
    setCollapsedCats(all)
  }

  const expandAll = () => {
    setCollapsedCats(new Set())
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'nama':
          comparison = a.nama.localeCompare(b.nama)
          break
        case 'harga_terakhir':
          comparison = (a.harga_terakhir ?? a.harga_master ?? 0) - (b.harga_terakhir ?? b.harga_master ?? 0)
          break
        case 'selisih_pct_prev':
          comparison = (a.selisih_pct_prev ?? -999) - (b.selisih_pct_prev ?? -999)
          break
        case 'tgl_po_terakhir':
          comparison = new Date(a.tgl_po_terakhir ?? 0).getTime() - new Date(b.tgl_po_terakhir ?? 0).getTime()
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [items, sortField, sortOrder])

  // Kelompokkan item berdasarkan kategori
  const groupedCategories = useMemo(() => {
    const map = new Map<string, FluktuasiHargaItem[]>()
    for (const it of sortedItems) {
      const cat = it.kategori_nama || 'Lainnya'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(it)
    }

    return Array.from(map.entries())
      .map(([kategori, catItems]) => {
        const naik = catItems.filter((i) => (i.selisih_pct_prev ?? 0) > 0).length
        const turun = catItems.filter((i) => (i.selisih_pct_prev ?? 0) < 0).length
        const stabil = catItems.length - naik - turun

        return {
          kategori,
          items: catItems,
          naikCount: naik,
          turunCount: turun,
          stabilCount: stabil
        }
      })
      .sort((a, b) => a.kategori.localeCompare(b.kategori))
  }, [sortedItems])

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-suka-orange" />
    ) : (
      <ChevronDown className="w-3 h-3 text-suka-orange" />
    )
  }

  const renderItemRow = (item: FluktuasiHargaItem) => {
    const isUp = item.selisih_pct_prev !== null && item.selisih_pct_prev > 0
    const isDown = item.selisih_pct_prev !== null && item.selisih_pct_prev < 0
    const isFlat = item.selisih_pct_prev !== null && item.selisih_pct_prev === 0

    return (
      <tr
        key={item.bahan_baku_id}
        className="hover:bg-suka-cream/20 transition-colors duration-150"
      >
        {/* Bahan Baku */}
        <td className="py-3.5 px-5">
          <div className="font-extrabold text-suka-brown text-sm">
            {item.nama}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-suka-brown/60 font-medium mt-0.5">
            <span className="px-1.5 py-0.5 rounded bg-suka-cream/80 text-suka-brown/80 font-mono text-[10px] font-bold">
              {item.satuan ? item.satuan.toUpperCase() : 'PCS'}
            </span>
            <span>·</span>
            <span className="text-suka-brown/70">{item.kategori_nama}</span>
          </div>
        </td>

        {/* Supplier & Tanggal PO */}
        <td className="py-3.5 px-4">
          {item.supplier_terakhir ? (
            <div>
              <div className="font-bold text-suka-brown flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-suka-brown/50 shrink-0" />
                <span className="truncate max-w-[180px]">{item.supplier_terakhir}</span>
              </div>
              <div className="text-[10px] text-suka-brown/60 font-medium mt-0.5">
                {item.tgl_po_terakhir
                  ? new Date(item.tgl_po_terakhir).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : ''}{' '}
                · {item.nomor_po_terakhir}
              </div>
            </div>
          ) : (
            <span className="text-suka-brown/40 text-xs italic">Belum ada PO</span>
          )}
        </td>

        {/* Harga Terakhir / Master */}
        <td className="py-3.5 px-4 text-right">
          <div className="font-black text-suka-brown text-sm">
            {formatRupiah(item.harga_terakhir ?? item.harga_master)}
          </div>
          <div className="flex items-center justify-end gap-1 text-[10px] text-suka-brown/50 font-bold">
            {item.harga_terakhir === null && item.harga_master !== null && (
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 font-bold text-[9px] border border-amber-200">
                Master
              </span>
            )}
            {item.satuan && <span>/{item.satuan}</span>}
          </div>
        </td>

        {/* Harga Pembelian Sebelumnya */}
        <td className="py-3.5 px-4 text-right">
          {item.harga_sebelumnya !== null ? (
            <div>
              <div className="font-bold text-suka-brown/70 text-xs">
                {formatRupiah(item.harga_sebelumnya)}
              </div>
              <div className="text-[9px] text-suka-brown/40 font-mono mt-0.5">
                {item.nomor_po_sebelumnya || ''}
              </div>
            </div>
          ) : (
            <span className="text-suka-brown/30 text-xs">—</span>
          )}
        </td>

        {/* Perubahan / Fluktuasi */}
        <td className="py-3.5 px-5 text-right">
          {item.selisih_pct_prev !== null ? (
            <div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black tracking-wider border shadow-2xs ${
                  isUp
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : isDown
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {isUp && <TrendingUp className="w-3 h-3" />}
                {isDown && <TrendingDown className="w-3 h-3" />}
                {isFlat && <Minus className="w-3 h-3" />}
                {isUp ? '+' : ''}
                {(item.selisih_pct_prev * 100).toFixed(1)}%
              </span>
              <div className="text-[11px] text-suka-brown/70 font-bold mt-1">
                {item.selisih_nominal_prev !== null && (
                  <span>
                    {item.selisih_nominal_prev > 0 ? '+' : ''}
                    {formatRupiah(item.selisih_nominal_prev)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-suka-brown/40 text-xs font-medium italic">Pembelian Pertama</span>
          )}
        </td>

        {/* Action Button: Lihat Riwayat Detail */}
        <td className="py-3.5 pr-5 pl-3 text-center">
          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            title="Lihat Riwayat & Grafik Pembelian"
            className="px-3 py-1.5 rounded-xl bg-white border border-suka-brown/15 text-suka-brown hover:bg-suka-cream hover:border-suka-orange text-xs font-bold transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-suka-orange" />
            <span>Riwayat</span>
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      {/* Control View: Toggle Pengelompokan & Expand/Collapse */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsGroupedView(!isGroupedView)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
              isGroupedView
                ? 'bg-suka-orange text-white border-orange-600'
                : 'bg-white text-suka-brown border-suka-brown/15 hover:bg-suka-cream/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Kelompokkan per Kategori ({groupedCategories.length})</span>
          </button>

          {isGroupedView && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-suka-brown/70">
              <button
                type="button"
                onClick={expandAll}
                className="px-2 py-1 rounded-lg bg-white border border-suka-brown/10 hover:bg-suka-cream transition-all cursor-pointer"
              >
                Buka Semua
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2 py-1 rounded-lg bg-white border border-suka-brown/10 hover:bg-suka-cream transition-all cursor-pointer"
              >
                Tutup Semua
              </button>
            </div>
          )}
        </div>

        <div className="text-xs font-bold text-suka-brown/60">
          Total: <strong className="text-suka-brown">{items.length}</strong> bahan baku
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-suka-cream/50 text-suka-brown/70 text-[10px] uppercase font-black tracking-widest border-b border-suka-brown/10">
                {/* Bahan Baku */}
                <th className="py-4 px-5 cursor-pointer group" onClick={() => handleSort('nama')}>
                  <div className="flex items-center gap-1.5">
                    <span>Nama Bahan Baku</span>
                    {renderSortIcon('nama')}
                  </div>
                </th>

                {/* Supplier Terakhir */}
                <th className="py-4 px-4 cursor-pointer group" onClick={() => handleSort('tgl_po_terakhir')}>
                  <div className="flex items-center gap-1.5">
                    <span>Vendor Terakhir</span>
                    {renderSortIcon('tgl_po_terakhir')}
                  </div>
                </th>

                {/* Harga Beli Terakhir */}
                <th className="py-4 px-4 text-right cursor-pointer group" onClick={() => handleSort('harga_terakhir')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Harga Terakhir</span>
                    {renderSortIcon('harga_terakhir')}
                  </div>
                </th>

                {/* Harga Pembelian Sebelumnya */}
                <th className="py-4 px-4 text-right">
                  <span>Pembelian Sebelumnya</span>
                </th>

                {/* Perubahan Fluktuasi */}
                <th className="py-4 px-5 text-right cursor-pointer group" onClick={() => handleSort('selisih_pct_prev')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Perubahan Harga</span>
                    {renderSortIcon('selisih_pct_prev')}
                  </div>
                </th>

                {/* Action Buttons */}
                <th className="py-4 pr-5 pl-3 text-center w-28">
                  <span>Detail</span>
                </th>
              </tr>
            </thead>

            {isGroupedView ? (
              /* Tampilan Dikelompokkan Berdasarkan Kategori */
              <tbody>
                {groupedCategories.map((group) => {
                  const isCollapsed = collapsedCats.has(group.kategori)

                  return (
                    <React.Fragment key={group.kategori}>
                      {/* Category Header Row */}
                      <tr 
                        className="bg-[#faf2e9] border-y border-suka-brown/15 select-none cursor-pointer hover:bg-[#f3e7da] transition-colors"
                        onClick={() => toggleCategoryCollapse(group.kategori)}
                      >
                        <td
                          colSpan={6}
                          className="py-3 px-5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="p-1 rounded-lg bg-white/80 border border-suka-brown/10 text-suka-brown">
                                {isCollapsed ? (
                                  <FolderClosed className="w-4 h-4 text-suka-orange" />
                                ) : (
                                  <FolderOpen className="w-4 h-4 text-suka-orange" />
                                )}
                              </span>
                              <span className="font-black text-suka-brown text-sm uppercase tracking-wide">
                                {group.kategori}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-suka-brown/80 border border-suka-brown/10">
                                {group.items.length} Item
                              </span>
                            </div>

                            {/* Category Stats */}
                            <div className="flex items-center gap-2">
                              {group.naikCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">
                                  <TrendingUp className="w-3 h-3" /> {group.naikCount} Naik
                                </span>
                              )}
                              {group.turunCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  <TrendingDown className="w-3 h-3" /> {group.turunCount} Turun
                                </span>
                              )}
                              <span className="text-suka-brown/50 text-xs font-bold flex items-center gap-1 ml-2">
                                {isCollapsed ? 'Buka' : 'Tutup'}
                                {isCollapsed ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                )}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Items under this category */}
                      {!isCollapsed && group.items.map((item) => renderItemRow(item))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            ) : (
              /* Tampilan Flat List */
              <tbody className="divide-y divide-suka-brown/5 text-xs">
                {sortedItems.map((item) => renderItemRow(item))}
              </tbody>
            )}

            {sortedItems.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={6} className="py-16 text-center text-suka-brown/50 space-y-2">
                    <PackageCheck className="w-10 h-10 mx-auto text-suka-brown/30" />
                    <p className="font-extrabold text-suka-brown text-sm">Tidak ada bahan baku yang cocok</p>
                    <p className="text-xs text-suka-brown/60">
                      Coba sesuaikan kata kunci pencarian atau filter kategori/status di atas.
                    </p>
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
