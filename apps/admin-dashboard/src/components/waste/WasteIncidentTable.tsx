'use client'

import React, { useState, useMemo } from 'react'
import {
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  Search,
  FileSpreadsheet,
} from 'lucide-react'
import { rupiah } from '@/lib/format'
import { INCIDENTS_PER_PAGE, type WasteIncidentRow } from '@/hooks/useWasteIncidents'
import { CLAIMABLE_REASON } from '@/lib/wasteReasons'

interface WasteIncidentTableProps {
  rows: WasteIncidentRow[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  onSelect: (row: WasteIncidentRow) => void
  showOutletColumn: boolean
  loading: boolean
}

const fmtTanggal = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function WasteIncidentTable({
  rows,
  totalCount,
  page,
  onPageChange,
  onSelect,
  showOutletColumn,
  loading,
}: WasteIncidentTableProps) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'with_photo' | 'claimable'>('all')

  const totalPages = Math.max(1, Math.ceil(totalCount / INCIDENTS_PER_PAGE))
  const firstOnPage = totalCount === 0 ? 0 : (page - 1) * INCIDENTS_PER_PAGE + 1
  const lastOnPage = Math.min(page * INCIDENTS_PER_PAGE, totalCount)
  const colSpan = showOutletColumn ? 9 : 8

  // Client-side quick filter untuk baris halaman aktif
  const filteredRows = useMemo(() => {
    let result = rows

    if (filterType === 'with_photo') {
      result = result.filter((r) => Boolean(r.photo_url))
    } else if (filterType === 'claimable') {
      result = result.filter((r) => r.reason === CLAIMABLE_REASON)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.bahan_nama.toLowerCase().includes(q) ||
          r.outlet_name.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          (r.reporter_name && r.reporter_name.toLowerCase().includes(q)) ||
          (r.approver_name && r.approver_name.toLowerCase().includes(q))
      )
    }

    return result
  }, [rows, search, filterType])

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header & Controls */}
        <div className="p-5 sm:p-6 border-b border-suka-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">
                Rincian Insiden Waste
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-suka-cream text-suka-brown border border-suka-brown/10">
                {totalCount} Total Laporan
              </span>
            </div>
            <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">
              Satu baris = satu form pengajuan waste yang sudah disetujui. Klik baris untuk detail &amp; foto bukti.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Filter chips */}
            <div className="flex items-center bg-suka-cream/60 p-1 rounded-2xl border border-suka-brown/10 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-suka-brown shadow-2xs'
                    : 'text-suka-gray-500 hover:text-suka-brown'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterType('claimable')}
                className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  filterType === 'claimable'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-suka-gray-500 hover:text-blue-700'
                }`}
              >
                Klaim Supplier
              </button>
              <button
                type="button"
                onClick={() => setFilterType('with_photo')}
                className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  filterType === 'with_photo'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-suka-gray-500 hover:text-emerald-700'
                }`}
              >
                Ada Foto
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari bahan / pelapor..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-suka-cream/50 border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-suka-cream/40 border-b border-suka-gray-100 text-left">
                <th className="py-3 px-4 sm:px-5 font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Tanggal &amp; Waktu
                </th>
                {showOutletColumn && (
                  <th className="py-3 px-4 sm:px-5 font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                    Outlet
                  </th>
                )}
                <th className="py-3 px-4 sm:px-5 font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Bahan Baku
                </th>
                <th className="py-3 px-4 sm:px-5 text-right font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Qty
                </th>
                <th className="py-3 px-4 sm:px-5 font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Alasan &amp; Kategori
                </th>
                <th className="py-3 px-4 sm:px-5 font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Pelapor
                </th>
                <th className="py-3 px-4 sm:px-5 font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Penyetuju
                </th>
                <th className="py-3 px-4 sm:px-5 text-right font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Nilai Kerugian
                </th>
                <th className="py-3 px-4 sm:px-5 text-center font-bold text-xs uppercase tracking-wider text-suka-gray-500">
                  Bukti
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-suka-gray-400">
                    <div className="w-6 h-6 border-2 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs font-semibold">Memuat rincian insiden...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-suka-gray-400">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold">
                      {search || filterType !== 'all'
                        ? 'Tidak ada insiden yang cocok dengan filter'
                        : 'Belum ada laporan waste pada periode ini'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const isClaimable = r.reason === CLAIMABLE_REASON
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelect(r)}
                      className="hover:bg-suka-cream/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 sm:px-5 text-xs text-suka-gray-500 whitespace-nowrap">
                        {fmtTanggal(r.created_at)}
                      </td>

                      {showOutletColumn && (
                        <td className="py-3 px-4 sm:px-5 text-xs font-bold text-suka-ink">
                          {r.outlet_name.replace('SUKA SHAWARMA ', '')}
                        </td>
                      )}

                      <td className="py-3 px-4 sm:px-5 font-bold text-suka-ink group-hover:text-suka-brown transition-colors">
                        {r.bahan_nama}
                      </td>

                      <td className="py-3 px-4 sm:px-5 text-right whitespace-nowrap text-xs text-suka-gray-600 tabular-nums">
                        {r.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })}{' '}
                        <span className="text-[10px] text-suka-gray-400 font-medium">{r.satuan_kecil}</span>
                      </td>

                      <td className="py-3 px-4 sm:px-5">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isClaimable
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                : r.reason.toLowerCase().includes('basi')
                                ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                                : r.reason.toLowerCase().includes('gosong')
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                                : 'bg-suka-cream text-suka-brown border border-suka-brown/10'
                            }`}
                          >
                            {r.reason}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 sm:px-5 text-xs text-suka-gray-600">
                        {r.reporter_name ?? '—'}
                      </td>

                      <td className="py-3 px-4 sm:px-5 text-xs text-suka-gray-600">
                        {r.approver_name ?? '—'}
                      </td>

                      <td className="py-3 px-4 sm:px-5 text-right font-extrabold text-rose-700 tabular-nums text-xs sm:text-sm">
                        {rupiah(r.nilai)}
                      </td>

                      <td className="py-3 px-4 sm:px-5 text-center">
                        {r.photo_url ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-bold"
                            title="Ada foto bukti - Klik untuk lihat"
                          >
                            <Camera className="w-3 h-3 text-emerald-600" />
                            <span>Foto</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center p-1 rounded-full text-suka-gray-300"
                            title="Tidak ada foto bukti"
                          >
                            <CameraOff className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 sm:px-6 border-t border-suka-gray-100 bg-suka-cream/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-suka-gray-500 tabular-nums">
          {totalCount === 0 ? '0 insiden' : `Menampilkan ${firstOnPage}–${lastOnPage} dari ${totalCount} insiden disetujui`}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-white border border-suka-gray-200 shadow-2xs hover:bg-suka-cream disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
            </button>

            <span className="px-3 py-1 rounded-xl bg-white border border-suka-gray-200 text-suka-brown font-bold text-xs tabular-nums">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-white border border-suka-gray-200 shadow-2xs hover:bg-suka-cream disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
