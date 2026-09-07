'use client'

import { Camera, CameraOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { INCIDENTS_PER_PAGE, type WasteIncidentRow } from '@/hooks/useWasteIncidents'

interface WasteIncidentTableProps {
  rows: WasteIncidentRow[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  onSelect: (row: WasteIncidentRow) => void
  showOutletColumn: boolean
  loading: boolean
}

const fmtTanggal = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))

export function WasteIncidentTable({
  rows, totalCount, page, onPageChange, onSelect, showOutletColumn, loading,
}: WasteIncidentTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / INCIDENTS_PER_PAGE))
  const firstOnPage = totalCount === 0 ? 0 : (page - 1) * INCIDENTS_PER_PAGE + 1
  const lastOnPage = Math.min(page * INCIDENTS_PER_PAGE, totalCount)
  const colSpan = showOutletColumn ? 9 : 8

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Rincian Insiden</h3>
          <p className="text-[11px] text-suka-gray-500 mt-0.5">Satu baris = satu laporan waste yang sudah di-approve</p>
        </div>
        <span className="text-[11px] font-semibold text-suka-gray-500 tabular-nums">
          {totalCount === 0 ? '0 insiden' : `${firstOnPage}–${lastOnPage} dari ${totalCount} insiden`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
              <th className="py-3 px-6">Tanggal</th>
              {showOutletColumn && <th className="py-3 px-6">Outlet</th>}
              <th className="py-3 px-6">Bahan Baku</th>
              <th className="py-3 px-6 text-right">Qty</th>
              <th className="py-3 px-6">Alasan</th>
              <th className="py-3 px-6">Pelapor</th>
              <th className="py-3 px-6">Penyetuju</th>
              <th className="py-3 px-6 text-right">Nilai</th>
              <th className="py-3 px-6 text-center">Bukti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            {loading ? (
              <tr><td colSpan={colSpan} className="py-8 text-center text-suka-gray-400">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
            ) : rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r)}
                className="hover:bg-suka-cream/30 cursor-pointer transition-colors"
              >
                <td className="py-3 px-6 text-suka-gray-600 whitespace-nowrap">{fmtTanggal(r.created_at)}</td>
                {showOutletColumn && (
                  <td className="py-3 px-6 text-suka-gray-600">{r.outlet_name.replace('SUKA SHAWARMA ', '')}</td>
                )}
                <td className="py-3 px-6 text-suka-ink font-bold">{r.bahan_nama}</td>
                <td className="py-3 px-6 text-right text-suka-gray-600 whitespace-nowrap">
                  {r.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {r.satuan_kecil}
                </td>
                <td className="py-3 px-6 text-suka-gray-600">{r.reason}</td>
                <td className="py-3 px-6 text-suka-gray-600">{r.reporter_name ?? '—'}</td>
                <td className="py-3 px-6 text-suka-gray-600">{r.approver_name ?? '—'}</td>
                <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(r.nilai)}</td>
                <td className="py-3 px-6 text-center">
                  {r.photo_url ? (
                    <Camera className="w-4 h-4 text-suka-green inline" aria-label="Ada foto bukti" />
                  ) : (
                    <CameraOff className="w-4 h-4 text-suka-gray-300 inline" aria-label="Tidak ada foto bukti" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-suka-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suka-cream/70 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
          </button>
          <span className="text-[11px] font-semibold text-suka-gray-500 tabular-nums">
            Halaman {page} dari {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suka-cream/70 transition-colors"
          >
            Berikutnya <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
