'use client'

import React, { useState } from 'react'
import {
  TrendingDown,
  AlertOctagon,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import type { WasteHistoryItem, WasteSummaryData } from '../actions/waste'

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatWIB = (ts: string) => {
  try {
    const d = new Date(ts)
    return (
      d.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) +
      ' ' +
      d.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    )
  } catch {
    return ts
  }
}

interface WasteHistoryTabProps {
  summary: WasteSummaryData
  historyItems: WasteHistoryItem[]
  loading: boolean
  totalCount: number
  page: number
  totalPages: number
  onPageChange: (newPage: number) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  dateRange: { from: string; to: string }
  onDateRangeChange: (range: { from: string; to: string }) => void
}

export default function WasteHistoryTab({
  summary,
  historyItems,
  loading,
  totalCount,
  page,
  totalPages,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onDateRangeChange,
}: WasteHistoryTabProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null)
  const [selectedRejection, setSelectedRejection] = useState<{
    bahan: string
    reason: string
    outlet: string
  } | null>(null)

  // Preset ranges
  const setPreset = (type: 'today' | '7d' | '30d') => {
    const now = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]
    const to = formatDate(now)

    if (type === 'today') {
      onDateRangeChange({ from: to, to })
    } else if (type === '7d') {
      const past = new Date(now)
      past.setDate(past.getDate() - 6)
      onDateRangeChange({ from: formatDate(past), to })
    } else if (type === '30d') {
      const past = new Date(now)
      past.setDate(past.getDate() - 29)
      onDateRangeChange({ from: formatDate(past), to })
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Kerugian Rp */}
        <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
              Total Kerugian Waste
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-red-600 tracking-tight">
              {formatRupiah(summary.totalNilaiWaste)}
            </h3>
            <p className="text-[11px] font-semibold text-suka-gray-400 mt-0.5">
              Dari laporan yang telah disetujui (Approved)
            </p>
          </div>
        </div>

        {/* Card 2: Total Insiden */}
        <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
              Insiden Dilaporkan
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-suka-brown tracking-tight">
              {summary.totalIncidents} <span className="text-sm font-bold text-suka-gray-400">Kejadian</span>
            </h3>
            <p className="text-[11px] font-semibold text-suka-gray-400 mt-0.5">
              Tercatat pada periode terpilih
            </p>
          </div>
        </div>

        {/* Card 3: Top Item Terbuang */}
        <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
              Bahan Paling Banyak Terbuang
            </span>
            <div className="w-8 h-8 rounded-xl bg-suka-cream text-suka-brown flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 space-y-1">
            {summary.topItems.length > 0 ? (
              summary.topItems.slice(0, 2).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-suka-brown truncate max-w-[150px]">
                    {idx + 1}. {item.nama}
                  </span>
                  <span className="font-semibold text-red-600">
                    {item.qty} {item.satuan} ({formatRupiah(item.nilai)})
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-suka-gray-400 italic pt-1">Belum ada data waste</p>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-suka-brown/10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Preset Date Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setPreset('today')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-suka-brown/15 text-suka-brown hover:bg-suka-cream transition-colors cursor-pointer"
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setPreset('7d')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-suka-brown/15 text-suka-brown hover:bg-suka-cream transition-colors cursor-pointer"
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => setPreset('30d')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-suka-brown/15 text-suka-brown hover:bg-suka-cream transition-colors cursor-pointer"
          >
            30 Hari
          </button>

          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
              className="text-xs p-1.5 rounded-xl border border-suka-brown/20 bg-white text-suka-brown font-semibold focus:outline-none focus:border-suka-orange"
            />
            <span className="text-xs text-suka-gray-400">-</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
              className="text-xs p-1.5 rounded-xl border border-suka-brown/20 bg-white text-suka-brown font-semibold focus:outline-none focus:border-suka-orange"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <label className="text-xs font-bold text-suka-gray-500">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-xl border border-suka-brown/20 bg-white text-suka-brown font-bold focus:outline-none focus:border-suka-orange cursor-pointer"
          >
            <option value="all">Semua Status (Approved & Rejected)</option>
            <option value="APPROVED">Hanya Approved</option>
            <option value="REJECTED">Hanya Rejected</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-suka-brown/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-suka-brown">
            <thead className="bg-suka-gray-50/80 border-b border-suka-brown/10 text-[11px] font-black uppercase text-suka-gray-500 tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Tanggal</th>
                <th className="px-4 py-3.5">Outlet</th>
                <th className="px-4 py-3.5">Bahan Baku</th>
                <th className="px-4 py-3.5 text-right">Kuantitas</th>
                <th className="px-4 py-3.5 text-right">Estimasi Kerugian</th>
                <th className="px-4 py-3.5">Alasan & Bukti</th>
                <th className="px-4 py-3.5">Pelapor</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Approver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-suka-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-suka-orange mb-2" />
                    <span>Memuat riwayat waste...</span>
                  </td>
                </tr>
              ) : historyItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-suka-gray-400 font-medium">
                    Tidak ada riwayat waste pada filter ini.
                  </td>
                </tr>
              ) : (
                historyItems.map((item) => (
                  <tr key={item.id} className="hover:bg-suka-cream/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-suka-gray-500 whitespace-nowrap">
                      {formatWIB(item.created_at)}
                    </td>
                    <td className="px-4 py-3 font-bold text-suka-brown whitespace-nowrap">
                      {item.outlet_name}
                    </td>
                    <td className="px-4 py-3 font-black text-suka-brown">
                      {item.bahan_nama}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-suka-brown whitespace-nowrap">
                      {item.qty} {item.satuan}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-red-600 whitespace-nowrap">
                      {formatRupiah(item.nilai_waste)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-suka-brown max-w-[150px] truncate block" title={item.reason}>
                          {item.reason}
                        </span>
                        {item.photo_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPhoto({
                                url: item.photo_url!,
                                title: `${item.bahan_nama} - ${item.outlet_name}`,
                              })
                            }
                            className="text-suka-orange hover:text-suka-orange/80 p-1 rounded hover:bg-suka-orange/10 cursor-pointer"
                            title="Lihat foto bukti"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-suka-gray-500 whitespace-nowrap">
                      {item.reporter_name}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {item.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          APPROVED
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedRejection({
                              bahan: item.bahan_nama,
                              outlet: item.outlet_name,
                              reason: item.rejection_reason || 'Tidak ada catatan penolakan',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3 h-3" />
                          REJECTED
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-suka-gray-500 font-medium whitespace-nowrap">
                      {item.approver_name || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-suka-brown/10 flex items-center justify-between text-xs font-bold text-suka-gray-500">
            <span>
              Halaman {page} dari {totalPages} ({totalCount} data)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-xl border border-suka-brown/10 text-suka-brown hover:bg-suka-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-xl border border-suka-brown/10 text-suka-brown hover:bg-suka-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Lightbox Foto */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/20">
            <div className="p-4 border-b border-suka-brown/10 flex items-center justify-between">
              <h4 className="text-sm font-black text-suka-brown truncate">
                {selectedPhoto.title}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="w-8 h-8 rounded-full bg-suka-gray-100 flex items-center justify-center text-suka-brown hover:bg-suka-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-suka-gray-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={selectedPhoto.url}
                alt="Bukti fisik waste"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Alasan Penolakan Viewer */}
      {selectedRejection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-sm w-full bg-white rounded-3xl p-6 shadow-2xl border border-suka-brown/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Catatan Penolakan
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRejection(null)}
                className="w-8 h-8 rounded-full bg-suka-gray-100 flex items-center justify-center text-suka-brown hover:bg-suka-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-suka-gray-50 rounded-xl text-xs space-y-1">
              <p><strong>Bahan:</strong> {selectedRejection.bahan}</p>
              <p><strong>Outlet:</strong> {selectedRejection.outlet}</p>
            </div>

            <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl">
              <p className="text-xs font-bold text-red-800">
                "{selectedRejection.reason}"
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRejection(null)}
              className="w-full py-2.5 rounded-xl bg-suka-brown text-white text-xs font-bold hover:bg-suka-brown/90 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
