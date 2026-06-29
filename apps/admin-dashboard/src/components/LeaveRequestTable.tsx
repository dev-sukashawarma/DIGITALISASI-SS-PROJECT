'use client'

import { CheckCircle, XCircle } from 'lucide-react'
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
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  const labels: Record<LeaveStatus, string> = {
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
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
  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-suka-gray-200 bg-suka-gray-50/60 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Jenis Cuti</th>
              <th className="px-4 py-3 font-semibold">Tanggal</th>
              <th className="px-4 py-3 font-semibold">Durasi</th>
              <th className="px-4 py-3 font-semibold">Alasan</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-200/70">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-suka-gray-50/40 transition-colors">
                {/* Name + quota badge */}
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-suka-ink">
                      {r.outlet_staff?.name ?? '-'}
                    </span>
                    <span className="inline-flex w-fit mt-0.5 rounded-full bg-suka-cream px-2 py-0.5 text-[10px] font-bold text-suka-brown">
                      Sisa: {r.outlet_staff?.leave_quota ?? 0} hari
                    </span>
                  </div>
                </td>

                {/* Leave type */}
                <td className="px-4 py-3 text-gray-600">
                  {leaveTypeLabel[r.leave_type] ?? r.leave_type}
                </td>

                {/* Date range */}
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(r.start_date)} – {formatDate(r.end_date)}
                </td>

                {/* Duration */}
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {r.days} hari
                </td>

                {/* Reason */}
                <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={r.reason ?? ''}>
                  {r.reason || '-'}
                </td>

                {/* Status */}
                <td className="px-4 py-3">{statusBadge(r.status)}</td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  {r.status === 'pending' ? (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onApprove(r)}
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Setujui"
                      >
                        <CheckCircle size={18} />
                      </button>
                      <button
                        onClick={() => onReject(r)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors"
                        title="Tolak"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada data pengajuan cuti.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
