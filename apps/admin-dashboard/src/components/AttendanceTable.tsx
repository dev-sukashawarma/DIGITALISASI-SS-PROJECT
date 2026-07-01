'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { AttendanceLog, AttendanceStatus } from '@/lib/types'

/* ─── Badge color map ───────────────────────────────────────────────── */

const STATUS_BADGE: Record<AttendanceStatus, { bg: string; text: string; label: string }> = {
  hadir: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Hadir' },
  terlambat: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Terlambat' },
  izin: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Izin' },
  sakit: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Sakit' },
  alfa: { bg: 'bg-red-50', text: 'text-red-700', label: 'Alfa' },
  cuti: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Cuti' },
  libur: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Libur' },
}

/* ─── Formatters ────────────────────────────────────────────────────── */

/** Format ISO date string → DD/MM/YYYY */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Format time string (HH:MM:SS or HH:MM) → HH:MM */
function fmtTime(t: string | null): string {
  if (!t) return '—'
  return t.slice(0, 5)
}

/* ─── Role label ────────────────────────────────────────────────────── */

function roleBadge(role: string): string {
  const map: Record<string, string> = {
    crew: 'Crew',
    kitchen: 'Kitchen',
    kiosk: 'Kiosk',
    leader: 'Leader',
    spv: 'SPV',
    admin: 'Admin',
    admin_hr: 'Admin HR',
    owner: 'Owner',
    mitra: 'Mitra',
    staff_pusat: 'Staff Pusat',
  }
  return map[role] ?? role
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface Props {
  rows: AttendanceLog[]
  onEdit: (row: AttendanceLog) => void
  onDelete: (row: AttendanceLog) => void
}

export function AttendanceTable({ rows, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-suka-gray-400">Belum ada data absensi untuk filter ini.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-suka-gray-100 bg-suka-gray-50/60">
              <th className="px-4 py-3 text-left font-semibold text-suka-ink">Nama</th>
              <th className="px-4 py-3 text-left font-semibold text-suka-ink">Outlet</th>
              <th className="px-4 py-3 text-left font-semibold text-suka-ink">Tanggal</th>
              <th className="px-4 py-3 text-left font-semibold text-suka-ink">Clock In</th>
              <th className="px-4 py-3 text-left font-semibold text-suka-ink">Clock Out</th>
              <th className="px-4 py-3 text-left font-semibold text-suka-ink">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-suka-ink">Terlambat</th>
              <th className="px-4 py-3 text-center font-semibold text-suka-ink">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {rows.map((row) => {
              const badge = STATUS_BADGE[row.status]
              const staffName = row.outlet_staff?.name ?? '—'
              const staffRole = row.outlet_staff?.role ?? ''
              const outletName = row.outlets?.name ?? '—'

              return (
                <tr key={row.id} className="transition-colors hover:bg-suka-gray-50/50">
                  {/* Nama + role */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-suka-ink">{staffName}</div>
                    {staffRole && (
                      <span className="text-xs text-suka-gray-400">{roleBadge(staffRole)}</span>
                    )}
                  </td>

                  {/* Outlet */}
                  <td className="px-4 py-3 text-suka-gray-600">{outletName}</td>

                  {/* Tanggal */}
                  <td className="px-4 py-3 tabular-nums text-suka-gray-600">
                    {fmtDate(row.date)}
                  </td>

                  {/* Clock In */}
                  <td className="px-4 py-3 tabular-nums text-suka-gray-600">
                    {fmtTime(row.clock_in)}
                  </td>

                  {/* Clock Out */}
                  <td className="px-4 py-3 tabular-nums text-suka-gray-600">
                    {fmtTime(row.clock_out)}
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                  </td>

                  {/* Terlambat */}
                  <td className="px-4 py-3 text-right tabular-nums text-suka-gray-600">
                    {row.late_minutes > 0 ? `${row.late_minutes} mnt` : '—'}
                  </td>

                  {/* Aksi */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="rounded-lg p-1.5 text-suka-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="rounded-lg p-1.5 text-suka-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
