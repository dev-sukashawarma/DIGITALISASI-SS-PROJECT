'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, FileImage, X } from 'lucide-react'
import type { LeaveRequest, LeaveStatus } from '@/lib/types'

const leaveTypeLabel: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Lainnya',
}

function statusBadge(status: LeaveStatus) {
  const styles: Record<LeaveStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  }
  const labels: Record<LeaveStatus, string> = {
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  }
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return dateStr
  }
}

export function LeaveRequestTable({
  rows,
  onApprove,
  onReject,
}: {
  rows: LeaveRequest[]
  onApprove: (r: LeaveRequest) => void
  onReject: (r: LeaveRequest) => void
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nama & Sisa Kuota</th>
                <th className="px-4 py-3.5">Jenis Cuti</th>
                <th className="px-4 py-3.5">Periode Tanggal</th>
                <th className="px-4 py-3.5">Durasi</th>
                <th className="px-4 py-3.5">Alasan &amp; Bukti</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-suka-ink text-sm">
                        {r.outlet_staff?.name ?? '-'}
                      </span>
                      <span className="inline-flex w-fit mt-0.5 rounded-full bg-suka-cream px-2 py-0.5 text-[10px] font-bold text-suka-brown">
                        Sisa: {r.outlet_staff?.leave_quota ?? 0} hari
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                    {leaveTypeLabel[r.leave_type] ?? r.leave_type}
                  </td>

                  <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)}
                  </td>

                  <td className="px-4 py-3 text-xs font-bold text-suka-brown whitespace-nowrap">
                    {r.days} Hari
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate" title={r.reason ?? ''}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{r.reason || '-'}</span>
                      {r.attachment_url && (
                        <button
                          onClick={() => setSelectedImage(r.attachment_url || null)}
                          className="text-suka-orange hover:text-suka-brown transition-colors cursor-pointer p-1 rounded-md hover:bg-orange-50"
                          title="Lihat Surat Dokter / Bukti"
                        >
                          <FileImage size={16} />
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">{statusBadge(r.status)}</td>

                  <td className="px-4 py-3 text-right">
                    {r.status === 'pending' ? (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => onApprove(r)}
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer border border-emerald-200"
                          title="Setujui Pengajuan"
                        >
                          <CheckCircle size={17} />
                        </button>
                        <button
                          onClick={() => onReject(r)}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition-colors cursor-pointer border border-red-200"
                          title="Tolak Pengajuan"
                        >
                          <XCircle size={17} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-suka-gray-400 font-medium">Selesai</span>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                    Tidak ada pengajuan cuti/izin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-full max-w-full rounded-2xl bg-white p-3 shadow-2xl animate-in zoom-in-95">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedImage(null)
              }}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <img
              src={selectedImage}
              alt="Bukti Pengajuan Cuti / Surat Dokter"
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  )
}
