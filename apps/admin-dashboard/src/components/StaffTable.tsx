'use client'
import { Avatar } from '@suka/design-system'
import { Edit, KeyRound, Trash2 } from 'lucide-react'
import { StatusToggle } from './StatusToggle'
import type { StaffRow, StaffStatus } from '@/lib/types'

function statusBadge(status: StaffStatus) {
  const map: Record<StaffStatus, string> = {
    active: 'bg-[#e1f5ee] text-[#085041]',
    inactive: 'bg-[#fcebeb] text-[#a32d2d]',
    on_leave: 'bg-amber-50 text-amber-700',
  }
  const label: Record<StaffStatus, string> = { active: 'Aktif', inactive: 'Nonaktif', on_leave: 'Cuti' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>{label[status]}</span>
}

export function StaffTable({
  rows, onEdit, onResetPassword, onToggleStatus, onDelete,
}: {
  rows: StaffRow[]
  onEdit: (s: StaffRow) => void
  onResetPassword: (s: StaffRow) => void
  onToggleStatus: (s: StaffRow, next: StaffStatus) => void
  onDelete: (s: StaffRow) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-suka-gray-200 bg-suka-gray-50/60 text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nama</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Outlet</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-suka-gray-200/70">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-suka-gray-50/50">
              <td className="px-4 py-3 font-medium text-suka-ink">
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.name} size={32} />
                  <div>
                    <div>{s.name}</div>
                    <div className="text-xs text-gray-400">@{s.username ?? '-'}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 capitalize text-gray-500">{s.role}</td>
              <td className="px-4 py-3 text-gray-500">{s.outlets?.name ?? '-'}</td>
              <td className="px-4 py-3">{statusBadge(s.status)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  <button onClick={() => onEdit(s)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" title="Edit"><Edit size={16} /></button>
                  <button onClick={() => onResetPassword(s)} className="rounded-lg p-2 text-suka-brown hover:bg-suka-cream" title="Reset Password"><KeyRound size={16} /></button>
                  <StatusToggle status={s.status} onToggle={(next) => onToggleStatus(s, next)} />
                  <button onClick={() => onDelete(s)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Hapus Permanen"><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Tidak ada staff yang cocok.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
